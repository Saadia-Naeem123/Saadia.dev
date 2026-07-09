const nodemailer = require('nodemailer');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let cachedTransporter;
function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: SMTP_SECURE === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
  }
  return cachedTransporter;
}

// Best-effort in-memory rate limit. On serverless platforms each warm
// instance keeps this state independently, so it throttles bursts on a
// single instance rather than guaranteeing a hard global cap. Good enough
// to stop casual abuse; put real protection (e.g. a captcha or a WAF rule)
// in front for production-grade defense.
const hits = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_HITS = 5;

function isRateLimited(key) {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    hits.set(key, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_HITS;
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

async function handleContact(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ error: 'Too many messages sent. Please try again later.' });
    return;
  }

  try {
    const body = req.body || {};
    const { name, email, message, company } = body;

    // Honeypot — real visitors never fill this hidden field.
    if (company) {
      res.status(200).json({ ok: true });
      return;
    }

    if (!name || !email || !message) {
      res.status(400).json({ error: 'Name, email and message are all required.' });
      return;
    }
    if (typeof name !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
      res.status(400).json({ error: 'Invalid input.' });
      return;
    }
    if (name.length > 120 || email.length > 200) {
      res.status(400).json({ error: 'Name or email is too long.' });
      return;
    }
    if (message.length < 10) {
      res.status(400).json({ error: 'Message is too short — add a few more details.' });
      return;
    }
    if (message.length > 5000) {
      res.status(400).json({ error: 'Message is too long (max 5000 characters).' });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const transporter = getTransporter();
    if (!transporter) {
      res.status(503).json({
        error: 'The contact form is not fully set up yet — email sending is not configured.'
      });
      return;
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

    if (process.env.SEND_AUTOREPLY === 'true') {
      await transporter.sendMail({
        from: `"Saadia Naeem" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'Thanks for reaching out',
        text: `Hi ${name},\n\nThanks for your message — I've received it and will get back to you soon.\n\n— Saadia`
      });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ error: 'Something went wrong while sending your message. Please try again.' });
  }
}

function mailStatus() {
  return { ok: true, mailConfigured: Boolean(getTransporter()) };
}

module.exports = { handleContact, mailStatus, getTransporter };
