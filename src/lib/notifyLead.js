import nodemailer from "nodemailer";

// Emails every new enquiry to the business operations mailbox.
//
// Settings (Render environment, never in the code):
//   LEADS_EMAIL_TO    who receives leads (default businessops@tavewo.com)
//   LEADS_EMAIL_FROM  sender shown on the email (default SMTP_USER)
//   SMTP_HOST, SMTP_PORT (465 or 587), SMTP_USER, SMTP_PASS
//
// If SMTP is not set, the lead is still saved and shows in the admin leads
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
  return Boolean(getTransporter());
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

export async function notifyLead(lead) {
  const t = getTransporter();
  if (!t) return { sent: false, error: "Email not configured (SMTP_HOST, SMTP_USER, SMTP_PASS)" };
  const { subject, text, html } = buildLeadEmail(lead);
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
