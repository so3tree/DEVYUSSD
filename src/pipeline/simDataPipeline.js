'use strict';

const simRegistryClient = require('./simRegistryClient');
const { isValidNationalId } = require('../engine/validators');

/**
 * SIM -> Identity pipeline (single hop)
 * ---------------------------------------------------------------------------
 * Runs immediately after the applicant grants consent (screen #3 = Yes).
 * "SIM card information" in practice means the MSISDN's SIM-registration
 * record held by the MNO — there is no direct handset/SIM-applet read over
 * USSD. Because Rwanda's SIM-registration KYC already captures name, date
 * of birth, and gender directly (see simRegistryClient.js for the RURA
 * regulation citations) and is required to match NIDA's own records, one
 * MNO KYC lookup is sufficient. An earlier version of this pipeline also
 * called NIDA separately to fill in these fields; that hop has been
 * removed as redundant (nidaClient.js is kept in the repo for reference/a
 * possible future standalone verification step, but nothing calls it now).
 *
 * Variables produced (attached to session.applicant.identity):
 *   nationalId        string|null   16-digit Rwandan National ID
 *   foreName          string|null   from MNO KYC
 *   surName           string|null   from MNO KYC
 *   dateOfBirth       string|null   ISO 8601 (YYYY-MM-DD)
 *   gender            'M'|'F'|null
 *   verified          boolean       true only if the KYC lookup succeeded
 *   source            string        'sim_kyc' | 'unresolved'
 *   lookupAttemptedAt string        ISO timestamp, for audit/logging
 */

const LOOKUP_TIMEOUT_MS = 4000; // keep USSD round-trip snappy

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * @param {string} msisdn - applicant phone number, as delivered by the USSD gateway
 * @returns {Promise<object>} identity object, always resolves (never throws) so a
 *   failed lookup degrades gracefully rather than blocking the application flow
 */
async function resolveIdentity(msisdn) {
  const lookupAttemptedAt = new Date().toISOString();
  const base = {
    nationalId: null,
    foreName: null,
    surName: null,
    dateOfBirth: null,
    gender: null,
    verified: false,
    source: 'unresolved',
    lookupAttemptedAt,
  };

  try {
    const result = await withTimeout(simRegistryClient.lookupByMsisdn(msisdn), LOOKUP_TIMEOUT_MS);
    if (!result || !result.found || !isValidNationalId(result.nationalId)) {
      return base; // MNO KYC lookup failed or msisdn not SIM-registered with a valid ID
    }
    return {
      nationalId: result.nationalId,
      foreName: result.foreName,
      surName: result.surName,
      dateOfBirth: result.dateOfBirth,
      gender: result.gender,
      verified: true,
      source: 'sim_kyc',
      lookupAttemptedAt,
    };
  } catch (err) {
    // Never let a pipeline failure crash the USSD session — applicant
    // proceeds, and the gap is visible to caseworkers via `source: unresolved`.
    return base;
  }
}

module.exports = { resolveIdentity };
