'use strict';

/**
 * SMS Client
 * ---------------------------------------------------------------------------
 * Sends the post-submission confirmation SMS (reference number) to the
 * applicant's MSISDN. In most deployments the same aggregator/gateway that
 * carries the USSD session also exposes an SMS API under the same
 * commercial agreement, so this is typically not a separate integration
 * to negotiate.
 *
 * This module is a mock stand-in — swap `sendSms` for a real HTTP call
 * once the SMS gateway/aggregator is confirmed.
 *
 * Expected real-world contract (to confirm with the aggregator/MNO):
 *   POST {SMS_GATEWAY_BASE_URL}/messages
 *   Headers: Authorization: Bearer {SMS_API_KEY}
 *   Body: { to: msisdn, message }
 */

const SENT_LOG = []; // mock outbox — inspect via _getSentLog() in tests/dev only

/**
 * @param {string} msisdn - E.164 destination phone number
 * @param {string} message - rendered SMS body (see SCREENS.SMS_SUBMISSION)
 * @returns {Promise<{status:string, msisdn:string, message:string}>}
 * @throws if msisdn is missing — callers should catch and log, never let
 *   an SMS failure block or fail the USSD submission itself.
 */
async function sendSms(msisdn, message) {
  // --- Real integration would look roughly like: ---
  // const res = await fetch(`${process.env.SMS_GATEWAY_BASE_URL}/messages`, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     Authorization: `Bearer ${process.env.SMS_API_KEY}`,
  //   },
  //   body: JSON.stringify({ to: msisdn, message }),
  // });
  // if (!res.ok) throw new Error(`SMS gateway responded ${res.status}`);
  // return res.json();

  if (!msisdn) throw new Error('sendSms called without a destination MSISDN');
  const record = { msisdn, message, sentAt: new Date().toISOString() };
  SENT_LOG.push(record);
  return { status: 'sent', msisdn, message };
}

/** Test/debug helper only — not part of the real gateway contract. */
function _getSentLog() {
  return SENT_LOG;
}

module.exports = { sendSms, _getSentLog };
