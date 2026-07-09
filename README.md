# Portfolio Backend (Express + Nodemailer)

Turns the contact form on your portfolio into a real, working "send an email" form. Everything else on the page is untouched.

## What was added

- `server.js` — a small Express server that serves the root `index.html` (your site, unchanged) and exposes `POST /api/contact`, which validates the submission and emails it to you via Nodemailer.
- Spam protection: rate limiting (5 messages / 15 min per IP) + a hidden honeypot field.
- `index.html` — same page as before, except the contact form now does a real `fetch('/api/contact', ...)` on submit, shows a loading/success/error state, and clears itself on success.

## 1. Install

```bash
npm install
```

## 2. Configure email

Copy `.env.example` to `.env` and fill in real values:

```bash
cp .env.example .env
```

**Easiest option — Gmail:**
1. Turn on 2‑Step Verification on the Gmail account you want to send from.
2. Create an App Password: https://myaccount.google.com/apppasswords
3. Put that address in `SMTP_USER` and the 16‑character app password in `SMTP_PASS`.

Any other SMTP provider (SendGrid, Mailgun, Zoho, Outlook, your web host) works too — just fill in `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`.

`CONTACT_TO` is the inbox that receives messages — defaults to sadianaeem060@gmail.com.

## 3. Run it

```bash
npm start
```

Visit **http://localhost:3000** — that's your full site now served by Node, with a working contact form.

## 4. Deploy

Works on any Node host (Render, Railway, Fly.io, a VPS, etc.). On Vercel, deploy it as a serverless function or a small Node service — the static frontend + `/api/contact` route both need to run somewhere with the `.env` variables set as environment variables (never commit `.env`).

## Notes

- Until `.env` is configured, `/api/contact` responds with a clear "email sending is not configured" error instead of failing silently — so you'll always know the real status.
- Check `GET /api/health` any time to confirm whether mail is configured (`mailConfigured: true/false`).
