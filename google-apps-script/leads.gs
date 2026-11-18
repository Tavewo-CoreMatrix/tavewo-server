/**
 * TAVEWO website leads: Google Apps Script
 *
 * Receives each new enquiry from tavewo-server (api.tavewo.com), adds it as a
 * row in this Google Sheet (the lead sheet Deborah tracks) and emails it to
 * businessops@tavewo.com. Works on Render's free plan because it uses HTTPS,
 * not SMTP.
 *
 * Setup (once), signed in as tavewo@tavewo.com:
 *   1. Create a Google Sheet called "TAVEWO Website Leads".
 *   2. Extensions > Apps Script. Replace the code with this file. Save.
 *   3. Project Settings (gear) > Script Properties > Add property:
 *        LEADS_SECRET = a long random password (also goes in Render).
 *   4. Deploy > New deployment > type "Web app".
 *        Execute as: Me.   Who has access: Anyone.   Deploy, allow access.
 *   5. Copy the Web app URL (ends in /exec) into Render as LEADS_WEBHOOK_URL,
 *      and the same password as LEADS_WEBHOOK_SECRET.
 */

const LEADS_TO = 'businessops@tavewo.com';
const SHEET_NAME = 'Leads';
const HEADERS = [
  'Received (Nigerian time)', 'Name', 'Company', 'Phone', 'Email',
  'Needs help with', 'Message', 'Came from', 'Campaign',
  'Status', 'Contacted by', 'Date contacted', 'Notes', 'Lead ID',
];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const secret = PropertiesService.getScriptProperties().getProperty('LEADS_SECRET');
    if (!secret || data.secret !== secret) return reply({ ok: false, error: 'unauthorised' });

    const lead = data.lead || {};
    addRow(lead);

    MailApp.sendEmail({
      to: LEADS_TO,
      subject: data.subject,
      body: data.text,
      htmlBody: data.html,
      replyTo: lead.workEmail || '',
      name: 'TAVEWO Website',
    });
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

function addRow(lead) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = book.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = book.insertSheet(SHEET_NAME);
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#E8F0FB');
      sheet.setFrozenRows(1);
    }
    const received = Utilities.formatDate(new Date(lead.createdAt || Date.now()), 'Africa/Lagos', 'dd MMM yyyy, HH:mm');
    sheet.appendRow([
      received, lead.fullName || '', lead.companyName || '', "'" + (lead.phoneNumber || ''),
      lead.workEmail || '', lead.projectType || '', lead.message || '',
      lead.sourceLabel || '', lead.campaign || '',
      'New', '', '', '', lead.id || '',
    ]);
  } finally {
    lock.releaseLock();
  }
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
