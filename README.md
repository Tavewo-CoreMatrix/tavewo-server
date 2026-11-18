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

Every new enquiry is emailed to `LEADS_EMAIL_TO` (default
businessops@tavewo.com). Set these in Render, never in the code:

| Variable | Example |
|----------|---------|
| `SMTP_HOST` | the mail provider's SMTP server |
| `SMTP_PORT` | `465` (or `587`) |
| `SMTP_USER` | the mailbox that sends, e.g. a no-reply address |
| `SMTP_PASS` | that mailbox's password or app password |
| `LEADS_EMAIL_TO` | `businessops@tavewo.com` |
| `LEADS_EMAIL_FROM` | `TAVEWO Website <no-reply@tavewo.com>` |

If SMTP is not set the lead is still saved and shows on `/admin/contacts`;
only the email is skipped (the lead shows "Email not sent").

## Admin access

The frontend's `/admin/contacts` page prompts for a token and sends it as the
`x-admin-token` header on `GET /api/contact`. Set `ADMIN_TOKEN` in `.env` to
whatever value you want to gate access with — treat it like a password and
don't commit it.
