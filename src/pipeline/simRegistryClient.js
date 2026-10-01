'use strict';

/**
 * SIM Registry Client
 * ---------------------------------------------------------------------------
 * Rwanda requires SIM registration to be tied to a verified National ID
 * (RURA regulation), and by regulation the KYC captured at registration
 * already includes name, date of birth, and gender directly — RURA's own
 * site states SIM registration "includes the subscriber's name, and date
 * of birth, gender, address, ID number, and details of valid identification
 * documents," and a 2024 RURA regulation requires this KYC to match NIDA's
 * own records ("The SIM card registration shall have the same KYC as NIDA
 * database"), with periodic synchronization between operator databases and
 * NIDA. So a single MNO KYC lookup is sufficient — no separate NIDA call is
 * needed for these fields (an earlier version of this pipeline did a
 * two-hop MNO -> NIDA lookup; that's been simplified to one hop here).
 *
 * Reaching this data requires a data-sharing agreement with the MNO(s)
 * (MTN Rwanda / Airtel Rwanda) or their USSD aggregator, and the applicant's
 * explicit consent (screen 3 in the flow) before any lookup is triggered.
 *
 * This module is a mock/interface stand-in for that integration. Swap
 * `lookupByMsisdn` for a real HTTP call to the MNO's KYC/subscriber API
 * once the data-sharing agreement and credentials are in place.
 *
 * Expected real-world contract (to confirm with MNO/aggregator):
 *   GET {MNO_KYC_BASE_URL}/subscribers/{msisdn}
 *   Headers: Authorization: Bearer {MNO_API_KEY}
 *   Response: { nationalId, foreName, surName, dateOfBirth, gender, simRegisteredAt }
 */

const MOCK_SUBSCRIBERS = {
  // msisdn -> KYC record, for local/dev testing only
  '+250788000001': {
    nationalId: '1199080012345678',
    foreName: 'Uwase',
    surName: 'Claudine',
    dateOfBirth: '1998-03-14',
    gender: 'F',
  },
  '+250788000002': {
    nationalId: '1199085098765432',
    foreName: 'Ndayisenga',
    surName: 'Eric',
    dateOfBirth: '1996-11-02',
    gender: 'M',
  },
};

/**
 * @param {string} msisdn - E.164 formatted phone number (+2507XXXXXXXX)
 * @returns {Promise<{found:boolean, source:string, nationalId?:string, foreName?:string, surName?:string, dateOfBirth?:string, gender?:string}>}
 */
async function lookupByMsisdn(msisdn) {
  // --- Real integration would look roughly like: ---
  // const res = await fetch(`${process.env.MNO_KYC_BASE_URL}/subscribers/${msisdn}`, {
  //   headers: { Authorization: `Bearer ${process.env.MNO_API_KEY}` },
  // });
  // if (!res.ok) return { found: false, source: 'mno_kyc' };
  // const data = await res.json();
  // return { found: true, source: 'mno_kyc', ...data };

  const record = MOCK_SUBSCRIBERS[msisdn];
  if (!record) return { found: false, source: 'mno_kyc_mock' };
  return { found: true, source: 'mno_kyc_mock', ...record };
}

module.exports = { lookupByMsisdn };
