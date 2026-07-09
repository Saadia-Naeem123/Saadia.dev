// Optional — for testing on your own machine without the Vercel CLI.
// On Vercel itself, api/contact.js and api/health.js are what actually run.
require('dotenv').config();

const path = require('path');
const express = require('express');
const { handleContact, mailStatus } = require('./lib/mailer');

const app = express();
const START_PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10kb' }));
app.use(express.static(__dirname));

app.get('/api/health', (req, res) => res.json(mailStatus()));
app.post('/api/contact', (req, res) => handleContact(req, res));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

function startServer(port, attemptsLeft = 10) {
  const server = app.listen(port, () => {
    console.log(`Local dev server running at http://localhost:${port}`);
    console.log(mailStatus().mailConfigured
      ? '✓ SMTP configured — the contact form will send real emails.'
      : '⚠ SMTP not configured yet — see .env.example.');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
      console.warn(`Port ${port} is in use, trying ${port + 1}...`);
      startServer(port + 1, attemptsLeft - 1);
      return;
    }

    throw err;
  });
}

startServer(START_PORT);
