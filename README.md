# Tavewo Ventures Website - Backend

The backend of the **Tavewo Ventures Website** is built using **Node.js**, **Express.js**, and **MongoDB Atlas**. It exposes RESTful APIs that power the website's dynamic functionality, including processing and storing contact form submissions.

The backend is designed with scalability, security, and maintainability in mind.

---

## Tech Stack

- Node.js
- Express.js
- MongoDB Atlas
- Mongoose
- CORS
- Dotenv
- Nodemon

---

## Features

- RESTful API architecture
- MongoDB Atlas integration
- Contact form processing
- Request validation
- Environment variable support
- CORS configuration
- Error handling middleware


Express + MongoDB API powering the Contact form and the admin leads view.
(News article is static content on the frontend and not backed by this API for now.)

## Setup

```bash
npm install
cp .env.example .env   # set MONGODB_URI and a strong ADMIN_TOKEN
npm run dev            # starts server on http://localhost:5000
```

## Endpoints

| Method | Route          | Auth                        | Description                                  |
|--------|----------------|------------------------------|-----------------------------------------------|
| GET    | `/api/health`  | none                         | Health check                                  |
| POST   | `/api/contact` | none                         | Submit contact form (fullName, workEmail, message required) |
| GET    | `/api/contact` | `x-admin-token` header       | List all submitted leads, newest first (`?source=corematrix-landing` to filter) |
| PATCH  | `/api/contact/:id` | `x-admin-token` header   | Set `status` (new / contacted / closed) and `notes` |
| DELETE | `/api/contact/:id` | `x-admin-token` header   | Remove a lead                                 |

## CoreMatrix landing page enquiries

`POST /api/contact` with `source: "corematrix-landing"` requires full name,
company, phone, email, what they need help with (`projectType`) and
`consent: true`. Message is optional. UTM fields and the ad click ID are
saved with the lead.

Every new enquiry is emailed to businessops@tavewo.com. Render's free plan
blocks SMTP, so on the free plan the email goes through a Google Apps Script
in the company Google Workspace, which also adds the lead to a Google Sheet.

**Free plan (current): Google Apps Script.** Follow the steps at the top of
`google-apps-script/leads.gs`, then set in Render:

| Variable | Value |
|----------|-------|
| `LEADS_WEBHOOK_URL` | the script's Web app URL (ends in `/exec`) |
| `LEADS_WEBHOOK_SECRET` | the same password as the script's `LEADS_SECRET` |

**Paid instance only: SMTP.** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`, `LEADS_EMAIL_TO`, `LEADS_EMAIL_FROM`. Used only when
`LEADS_WEBHOOK_URL` is not set.

If neither is set the lead is still saved and shows on `/admin/contacts`;
only the email is skipped (the lead shows "Email to businessops not sent").
Render Logs show `Lead <id>: email sent` or the reason it was not sent.

## Admin access

The frontend's `/admin/contacts` page prompts for a token and sends it as the
`x-admin-token` header on `GET /api/contact`. Set `ADMIN_TOKEN` in `.env` to
whatever value you want to gate access with — treat it like a password and
don't commit it.
