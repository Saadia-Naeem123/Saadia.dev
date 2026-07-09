# Saadia Naeem — AI Engineer Portfolio (Vercel-ready)

A single project you can deploy straight to Vercel: static site + a serverless
contact form that emails you via Nodemailer.

## Structure

```
index.html          → your portfolio (unchanged design/content)
api/contact.js       → serverless function: POST /api/contact (sends email)
api/health.js        → serverless function: GET  /api/health  (status check)
lib/mailer.js         → shared validation + Nodemailer logic used by both
server.js             → optional local dev server (Express) — not used on Vercel
package.json, vercel.json, .env.example, .gitignore
```

On Vercel, `api/*.js` files are automatically deployed as serverless
functions and everything else is served as static files — no extra config
needed beyond the environment variables below.

## 1. Deploy to Vercel

**Option A — Vercel CLI (fastest, no GitHub needed):**

```bash
npm install -g vercel     # if you don't have it already
cd saadia-portfolio        # this unzipped folder
vercel                     # first deploy → creates a preview URL
```

**Option B — GitHub:**
1. Push this folder to a new GitHub repo.
2. In the Vercel dashboard: **Add New → Project → Import** that repo.
3. Framework preset: "Other" (no build step needed) — click **Deploy**.

Either way, the site will build and deploy immediately — but the contact
form won't send real email until step 2 is done.

## 2. Add your email credentials

Go to **Vercel Dashboard → your project → Settings → Environment Variables**
and add these (apply to Production, and Preview if you want to test there too):

| Name | Example value |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | `you@gmail.com` |
| `SMTP_PASS` | your 16-character Gmail **App Password** |
| `CONTACT_TO` | `sadianaeem060@gmail.com` |
| `SEND_AUTOREPLY` | `false` |

**Getting a Gmail App Password:**
1. Turn on 2-Step Verification on the Gmail account.
2. Visit https://myaccount.google.com/apppasswords and create one.
3. Use that 16-character password as `SMTP_PASS` (not your normal password).

Any other SMTP provider (SendGrid, Mailgun, Zoho, Outlook, your host's SMTP)
works too — just fill in the matching `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER`
/ `SMTP_PASS`.

Or via CLI instead of the dashboard:
```bash
vercel env add SMTP_HOST
vercel env add SMTP_PORT
vercel env add SMTP_SECURE
vercel env add SMTP_USER
vercel env add SMTP_PASS
vercel env add CONTACT_TO
```

## 3. Redeploy

Environment variables only take effect on a new deployment:

```bash
vercel --prod
```

(If you used GitHub, just push a commit, or redeploy from the dashboard.)

## 4. Verify it's live

- Visit `https://your-project.vercel.app/api/health` → should show
  `{"ok":true,"mailConfigured":true}`.
- Submit the contact form on the live site → you should get an email at
  the `CONTACT_TO` address within a few seconds.

## Testing locally (optional)

```bash
npm install
cp .env.example .env      # fill in real SMTP values
npm start                  # http://localhost:3000
```

This runs `server.js`, a small Express server that mirrors the same
`lib/mailer.js` logic the Vercel functions use — handy for testing without
deploying every time.

## Notes

- The honeypot field and lightweight rate limiting (5 messages / 15 min per
  IP) cut down on casual spam. For serious abuse protection at scale, add a
  captcha (e.g. Cloudflare Turnstile) in front of the form.
- `mailConfigured: false` from `/api/health` means the SMTP environment
  variables aren't set yet — the form will return a clear error instead of
  failing silently until you add them.
