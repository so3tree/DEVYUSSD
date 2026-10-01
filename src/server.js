'use strict';

const express = require('express');
const sessionStore = require('./engine/sessionStore');
const ussdEngine = require('./engine/ussdEngine');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/**
 * USSD gateway webhook.
 *
 * Written for the Africa's Talking USSD callback contract (the most common
 * aggregator pattern used by MTN/Airtel USSD integrations in East Africa),
 * which POSTs:
 *   sessionId    - unique per USSD dialogue
 *   phoneNumber  - MSISDN, e.g. +250788000001
 *   text         - the FULL accumulated input for the session, '*'-joined
 *                  (empty string on the very first request)
 *
 * Response body must start with "CON " to keep the session open (render
 * another menu) or "END " to terminate it (final message).
 *
 * If the deployment target is a different aggregator (e.g. a direct MNO
 * gateway, or Twilio-style), only this handler needs to change — swap the
 * request field names and the CON/END response convention; ussdEngine and
 * everything below it is gateway-agnostic.
 */
app.post('/ussd', async (req, res) => {
  try {
    const { sessionId, phoneNumber, text } = req.body;

    if (!sessionId || !phoneNumber) {
      return res.status(400).send('END Invalid request.');
    }

    // Africa's Talking sends the FULL input history each time; we only need
    // the newest segment because per-step state lives in sessionStore.
    const segments = String(text || '').split('*').filter(Boolean);
    const latestInput = segments.length ? segments[segments.length - 1] : '';

    let session = sessionStore.get(sessionId, phoneNumber);
    const isFirstHit = !session && segments.length === 0;

    const result = await ussdEngine.processInput(
      isFirstHit ? null : session,
      isFirstHit ? '' : latestInput,
      phoneNumber
    );

    if (result.continueSession) {
      sessionStore.set(sessionId, phoneNumber, result.session);
      return res.send(`CON ${result.text}`);
    }

    sessionStore.clear(sessionId, phoneNumber);
    return res.send(`END ${result.text}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('USSD handler error:', err);
    return res.status(500).send('END An error occurred. Please try again later.');
  }
});

app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`DEVY USSD app listening on port ${PORT}`);
});

module.exports = app;
