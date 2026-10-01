'use strict';

const { generateReference } = require('./referenceGenerator');
const smsClient = require('../pipeline/smsClient');
const { SCREENS } = require('../config/screens');

/**
 * Mock persistence layer. Replace with a real datastore (e.g. Postgres)
 * behind the same two functions: submit, findByReference.
 *
 * NOTE: this application no longer performs the Imibereho eligibility
 * cross-check itself (removed along with pipeline/imibereho.js). That
 * cross-check, disclosed on the consent screen, still happens — via a
 * separate integration outside this codebase — so there's no `eligibility`
 * field on the record here anymore.
 */
const APPLICATIONS = new Map(); // reference -> application record

function renderSms(lang, vars) {
  let text = SCREENS.SMS_SUBMISSION.prompt[lang];
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}

/**
 * @param {object} applicant - collected session.applicant object
 * @returns {{reference: string, status: string}}
 */
function submit(applicant) {
  const reference = generateReference();
  const record = {
    reference,
    status: 'RECEIVED',
    submittedAt: new Date().toISOString(),
    applicant, // includes identity {nationalId, foreName, surName, dateOfBirth, gender, verified, source}
  };
  APPLICATIONS.set(reference, record);

  // Fire-and-forget: an SMS failure never blocks or fails the submission
  // itself — same "degrade gracefully" principle as the SIM/NIDA pipeline.
  const lang = applicant.language || 'en';
  const message = renderSms(lang, { ref: reference });
  smsClient.sendSms(applicant.msisdn, message).catch((err) => {
    // eslint-disable-next-line no-console
    console.error(`Failed to send submission SMS for ${reference}:`, err.message);
  });

  return { reference, status: record.status };
}

function findByReference(reference) {
  return APPLICATIONS.get(String(reference).trim().toUpperCase()) || null;
}

module.exports = { submit, findByReference };
