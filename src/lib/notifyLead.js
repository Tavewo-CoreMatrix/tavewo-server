import nodemailer from "nodemailer";

// Sends every new enquiry to the business operations mailbox.
//
// Two ways, set in the Render environment (never in the code):
//
// 1. Google Apps Script (works on Render's free plan, which blocks SMTP):
//      LEADS_WEBHOOK_URL     the script's Web app URL (ends in /exec)
//      LEADS_WEBHOOK_SECRET  the same password as the script's LEADS_SECRET
//    The script emails businessops@tavewo.com and adds a row to the Google
//    Sheet of leads. See google-apps-script/leads.gs.
//
// 2. SMTP (paid Render instances only):
//      SMTP_HOST, SMTP_PORT (465 or 587), SMTP_USER, SMTP_PASS
//      LEADS_EMAIL_TO (default businessops@tavewo.com), LEADS_EMAIL_FROM
//
// If neither is set, the lead is still saved and shows in the admin leads
// page; only the email is skipped. Sending never blocks saving.

const SOURCE_LABELS = {
  "corematrix-landing": "CoreMatrix landing page",
  contact: "Contact Us page",
};

let transporter;
function getTransporter() {
  if (transporter !== undefined) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    transporter = null;
    return null;
  }
  const port = Number(SMTP_PORT) || 465;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export function isEmailConfigured() {
  return Boolean(process.env.LEADS_WEBHOOK_URL || getTransporter());
}

const escape = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function buildLeadEmail(lead) {
  const source = SOURCE_LABELS[lead.source] || lead.source || "Website";
  const when = new Date(lead.createdAt || Date.now()).toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    dateStyle: "medium",
    timeStyle: "short",
  });
  const utm = lead.utm || {};
  const campaign = [utm.source, utm.medium, utm.campaign].filter(Boolean).join(" / ");

  const rows = [
    ["Name", lead.fullName],
    ["Company", lead.companyName],
    ["Phone", lead.phoneNumber],
    ["Email", lead.workEmail],
    ["Needs help with", lead.projectType],
    ["Message", lead.message],
    ["Received", `${when} (Nigerian time)`],
    ["Came from", source],
    ["Campaign", campaign],
  ].filter(([, v]) => v);

  const subject = `New enquiry: ${lead.fullName}${lead.companyName ? `, ${lead.companyName}` : ""} (${source})`;

  const text =
    rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
    "\n\nPlease contact this lead within 24 hours and mark it as contacted on the leads page.";

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#14213D">
<p style="margin:0 0 12px"><b>New enquiry from the ${escape(source)}</b></p>
<table cellpadding="6" style="border-collapse:collapse">
${rows
  .map(
    ([k, v]) =>
      `<tr><td style="color:#555;vertical-align:top;white-space:nowrap"><b>${escape(k)}</b></td><td style="white-space:pre-wrap">${escape(v)}</td></tr>`
  )
  .join("\n")}
</table>
<p style="margin:16px 0 0">Please contact this lead within 24 hours and mark it as contacted on the leads page.</p>
</div>`;

  return { subject, text, html };
}

async function sendViaWebhook(lead, email) {
  const utm = lead.utm || {};
  const res = await fetch(process.env.LEADS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: process.env.LEADS_WEBHOOK_SECRET,
      ...email,
      lead: {
        id: String(lead._id || ""),
        createdAt: lead.createdAt,
        fullName: lead.fullName,
        companyName: lead.companyName,
        phoneNumber: lead.phoneNumber,
        workEmail: lead.workEmail,
        projectType: lead.projectType,
        message: lead.message,
        sourceLabel: SOURCE_LABELS[lead.source] || lead.source || "Website",
        campaign: [utm.source, utm.medium, utm.campaign].filter(Boolean).join(" / "),
      },
    }),
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) return { sent: false, error: `Google script: ${body?.error || `HTTP ${res.status}`}` };
  return { sent: true };
}

export async function notifyLead(lead) {
  const email = buildLeadEmail(lead);
  if (process.env.LEADS_WEBHOOK_URL) {
    try {
      return await sendViaWebhook(lead, email);
    } catch (err) {
      return { sent: false, error: `Google script: ${err.message}` };
    }
  }
  const t = getTransporter();
  if (!t) return { sent: false, error: "Email not configured (LEADS_WEBHOOK_URL, or SMTP_HOST, SMTP_USER, SMTP_PASS)" };
  const { subject, text, html } = email;
  try {
    await t.sendMail({
      from: process.env.LEADS_EMAIL_FROM || process.env.SMTP_USER,
      to: process.env.LEADS_EMAIL_TO || "businessops@tavewo.com",
      replyTo: lead.workEmail,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err.message };
  }
}
