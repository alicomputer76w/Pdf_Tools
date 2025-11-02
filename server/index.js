import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const WABA_TOKEN = process.env.WABA_TOKEN;
const WABA_PHONE_NUMBER_ID = process.env.WABA_PHONE_NUMBER_ID;

if (!WABA_TOKEN || !WABA_PHONE_NUMBER_ID) {
  console.warn('Warning: WABA_TOKEN or WABA_PHONE_NUMBER_ID is not set. The verify endpoint will fail until configured.');
}

app.use(express.json());
app.use(cors({ origin: ALLOWED_ORIGIN, methods: ['POST'], allowedHeaders: ['Content-Type'] }));

app.get('/', (_req, res) => {
  res.json({ status: 'ok', message: 'WhatsApp verify server running' });
});

app.post('/api/verify-whatsapp', async (req, res) => {
  try {
    const { number } = req.body || {};
    if (!number) {
      return res.status(400).json({ error: 'Missing number' });
    }
    const digits = String(number).replace(/[^0-9]/g, '');
    if (digits.length < 8 || digits.length > 15) {
      return res.status(400).json({ error: 'Invalid number format (8–15 digits expected)' });
    }
    if (!WABA_TOKEN || !WABA_PHONE_NUMBER_ID) {
      return res.status(500).json({ error: 'Server not configured' });
    }

    const url = `https://graph.facebook.com/v20.0/${WABA_PHONE_NUMBER_ID}/contacts`;
    const payload = {
      blocking: 'wait',
      contacts: [`+${digits}`],
      force_check: true
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WABA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('WABA verify error:', data);
      return res.status(502).json({ error: 'Verification failed', details: data });
    }

    const contact = Array.isArray(data?.contacts) ? data.contacts[0] : null;
    if (contact?.status === 'valid') {
      return res.json({ status: 'valid', wa_id: contact.wa_id });
    }
    return res.json({ status: 'invalid' });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`WA verify server listening on port ${PORT}`);
});