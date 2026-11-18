import { Router } from "express";
import ContactSubmission from "../models/ContactSubmission.js";
import { notifyLead } from "../lib/notifyLead.js";

const router = Router();

// Simple shared-secret gate for the admin leads view.
// Set ADMIN_TOKEN in .env — the frontend sends it back as the x-admin-token header.
function requireAdmin(req, res, next) {
  const token = req.headers["x-admin-token"];
  if (!process.env.ADMIN_TOKEN) {
    return res.status(500).json({ error: "ADMIN_TOKEN is not configured on the server." });
  }
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Invalid or missing admin token." });
  }
  next();
}

// A light limit on enquiries per IP, so a bot can't flood the lead sheet.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 8;
const hits = new Map();
function rateLimit(req, res, next) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.ip || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return res.status(429).json({ error: "Too many enquiries from this connection. Please email businessops@tavewo.com." });
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  next();
}

const SOURCES = new Set(["contact", "corematrix-landing"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const str = (v, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

// Nigerian numbers (080…, +234…, 234…) or any international number of 7–15 digits.
export function isValidPhone(phone) {
  const digits = String(phone || "").replace(/[^\d]/g, "");
  if (/^0[789][01]\d{8}$/.test(digits)) return true;
  if (/^234[789][01]\d{8}$/.test(digits)) return true;
  return String(phone || "").trim().startsWith("+") && digits.length >= 7 && digits.length <= 15;
}

export function validateEnquiry(body) {
  const source = SOURCES.has(body.source) ? body.source : "contact";
  const data = {
    fullName: str(body.fullName, 120),
    companyName: str(body.companyName, 160),
    workEmail: str(body.workEmail, 160)?.toLowerCase(),
    phoneNumber: str(body.phoneNumber, 40),
    projectType: str(body.projectType, 120),
    message: str(body.message, 4000) || "",
    source,
    consent: body.consent === true,
    pageUrl: str(body.pageUrl, 500),
    clickId: str(body.clickId, 300),
    utm: {
      source: str(body.utm?.source, 120),
      medium: str(body.utm?.medium, 120),
      campaign: str(body.utm?.campaign, 160),
      content: str(body.utm?.content, 160),
      term: str(body.utm?.term, 160),
    },
  };

  if (!data.fullName || !data.workEmail) return { error: "Please enter your name and email." };
  if (!EMAIL_RE.test(data.workEmail)) return { error: "Please enter a valid email address." };

  if (source === "corematrix-landing") {
    if (!data.companyName) return { error: "Please enter your company or business name." };
    if (!data.phoneNumber || !isValidPhone(data.phoneNumber)) {
      return { error: "Please enter a valid phone number, for example 0803 123 4567." };
    }
    if (!data.projectType) return { error: "Please tell us what you need help with." };
    if (!data.consent) return { error: "Please agree to be contacted about your enquiry." };
  } else if (!data.message) {
    return { error: "Full name, work email and message are required." };
  }
  return { data };
}

// POST /api/contact — public, used by the Contact Us form and the CoreMatrix landing page
router.post("/", rateLimit, async (req, res) => {
  try {
    // Hidden "website" field: people never see it, bots fill it in.
    if (req.body?.website) return res.status(201).json({ success: true });

    const { data, error } = validateEnquiry(req.body || {});
    if (error) return res.status(400).json({ error });

    const submission = await ContactSubmission.create(data);

    // Email businessops@ in the background; the lead is already saved.
    notifyLead(submission)
      .then((r) => {
        console.log(`Lead ${submission._id}: email ${r.sent ? "sent" : `not sent (${r.error})`}`);
        return ContactSubmission.updateOne(
          { _id: submission._id },
          r.sent ? { notifiedAt: new Date(), $unset: { notifyError: 1 } } : { notifyError: r.error }
        );
      })
      .catch((err) => console.error("Lead email failed:", err.message));

    res.status(201).json({ success: true, id: submission._id });
  } catch (err) {
    console.error("Contact submit failed:", err.message);
    res.status(500).json({ error: "Failed to submit message. Please email businessops@tavewo.com." });
  }
});

// GET /api/contact — admin only, powers the /admin/contacts leads view.
// Optional ?source=corematrix-landing to show only landing page leads.
router.get("/", requireAdmin, async (req, res) => {
  try {
    const filter = SOURCES.has(req.query.source) ? { source: req.query.source } : {};
    const submissions = await ContactSubmission.find(filter).sort({ createdAt: -1 });
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch submissions", details: err.message });
  }
});

// PATCH /api/contact/:id — admin only, update status (new / contacted / closed) and notes
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const update = {};
    if (req.body.status !== undefined) {
      if (!["new", "contacted", "closed"].includes(req.body.status)) {
        return res.status(400).json({ error: "Status must be new, contacted or closed." });
      }
      update.status = req.body.status;
      if (req.body.status === "contacted") update.contactedAt = new Date();
    }
    if (typeof req.body.notes === "string") update.notes = req.body.notes.trim().slice(0, 2000);
    if (!Object.keys(update).length) return res.status(400).json({ error: "Nothing to update." });

    const updated = await ContactSubmission.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!updated) return res.status(404).json({ error: "Submission not found." });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update submission", details: err.message });
  }
});

// DELETE /api/contact/:id — admin only, removes a single lead
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const deleted = await ContactSubmission.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Submission not found." });
    }
    res.json({ success: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete submission", details: err.message });
  }
});

export default router;
