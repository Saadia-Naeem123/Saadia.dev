require('dotenv').config();

const path = require('path');
const dns = require('dns');
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const siteIndex = path.join(__dirname, 'index.html');

// ---------- Middleware ----------
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// Limit contact form abuse: 5 requests per 15 minutes per IP
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages sent. Please try again later.' }
});

// ---------- Mail transport ----------
// Works with Gmail (use an App Password, not your normal password) or any
// SMTP provider (SendGrid, Mailgun, Zoho, Outlook, etc). Configure via .env.
function buildTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null; // not configured yet
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === 'true', // true for port 465, false for 587/25
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

const transporter = buildTransporter();

if (transporter) {
  transporter.verify((err) => {
    if (err) {
      console.error('✗ SMTP connection failed:', err.message);
    } else {
      console.log('✓ SMTP transporter ready — contact form will send real emails.');
    }
  });
} else {
  console.warn(
    '⚠ SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS (and SMTP_PORT/SMTP_SECURE) ' +
    'in a .env file — see .env.example. The /api/contact endpoint will return an error until then.'
  );
}

// ---------- Helpers ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dnsPromises = dns.promises;

async function hasMailRouting(domain) {
  try {
    const mxRecords = await dnsPromises.resolveMx(domain);
    return Array.isArray(mxRecords) && mxRecords.length > 0;
  } catch (mxError) {
    if (mxError.code !== 'ENODATA' && mxError.code !== 'ENOTFOUND' && mxError.code !== 'ENODOMAIN') {
      throw mxError;
    }

    try {
      await dnsPromises.resolveAny(domain);
      return true;
    } catch (fallbackError) {
      if (fallbackError.code === 'ENODATA' || fallbackError.code === 'ENOTFOUND' || fallbackError.code === 'ENODOMAIN') {
        return false;
      }
      throw fallbackError;
    }
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Routes ----------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, mailConfigured: Boolean(transporter) });
});

app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const { name, email, message, company } = req.body || {};

    // Honeypot: real users never fill this hidden field — bots often do.
    if (company) {
      return res.status(200).json({ ok: true }); // silently accept, do nothing
    }

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email and message are all required.' });
    }
    if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
      return res.status(400).json({ error: 'Invalid input.' });
    }
    if (name.length > 120 || email.length > 200) {
      return res.status(400).json({ error: 'Name or email is too long.' });
    }
    if (message.length < 10) {
      return res.status(400).json({ error: 'Message is too short — add a few more details.' });
    }
    if (message.length > 5000) {
      return res.status(400).json({ error: 'Message is too long (max 5000 characters).' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const emailDomain = email.split('@').pop();
    if (!emailDomain || !(await hasMailRouting(emailDomain))) {
      return res.status(400).json({
        error: 'That email domain does not appear to accept mail. Please use a real inbox.'
      });
    }

    if (!transporter) {
      return res.status(503).json({
        error: 'The contact form is not fully set up yet — email sending is not configured.'
      });
    }

    const toAddress = process.env.CONTACT_TO || 'sadianaeem060@gmail.com';

    await transporter.sendMail({
      from: `"Portfolio Contact Form" <${process.env.SMTP_USER}>`,
      to: toAddress,
      replyTo: `"${name}" <${email}>`,
      subject: `New portfolio message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      html: `
        <div style="font-family:Arial,sans-serif; font-size:14px; color:#111;">
          <h2 style="margin:0 0 12px;">New message from your portfolio</h2>
          <p><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Message:</strong></p>
          <p style="white-space:pre-wrap; padding:12px; background:#f5f5f5; border-radius:8px;">${escapeHtml(message)}</p>
        </div>
      `
    });

    // Optional: send the visitor a short confirmation email too.
    if (process.env.SEND_AUTOREPLY === 'true') {
      await transporter.sendMail({
        from: `"Saadia Naeem" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Thanks for reaching out',
        text: `Hi ${name},\n\nThanks for your message — I've received it and will get back to you soon.\n\n— Saadia`
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Contact form error:', err);
    return res.status(500).json({ error: 'Something went wrong while sending your message. Please try again.' });
  }
});

// Fallback to index.html for any other GET route (simple SPA-style serving)
app.get('*', (req, res) => {
  res.sendFile(siteIndex);
});

app.listen(PORT, () => {
  console.log(`Portfolio server running at http://localhost:${PORT}`);
});
