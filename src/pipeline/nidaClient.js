'use strict';

/**
 * NOTE: no longer called by simDataPipeline.js. The pipeline was
 * simplified to a single MNO-KYC hop (see simRegistryClient.js and
 * simDataPipeline.js for why) because Rwanda's SIM-registration KYC
 * already carries name/DOB/gender and must match NIDA's own records. This
 * file is kept in place in case a standalone NIDA verification step is
 * reintroduced later (e.g. as an extra trust check independent of the MNO).
 *
 * NIDA Client
 * ---------------------------------------------------------------------------
 * Wraps Rwanda's National Identification Agency (NIDA) verification API,
 * used to resolve a National ID number into verified demographic data:
 * Name, Date of Birth, Gender. This is the same integration pattern used by
 * Ejo Heza and other GoR digital programs for identity verification.
 *
 * Access requires an integration agreement with NIDA/RISA (often brokered
 * via Irembo or the Rwanda government's central data exchange / eGA
 * platform) plus an API key scoped to DEVY. This module mocks that contract
 * so the USSD engine and application service can be built and tested against
 * a stable interface ahead of the real integration.
 *
 * Expected real-world contract (to confirm with NIDA/RISA):
 *   POST {NIDA_BASE_URL}/verify
 *   Body: { nationalId }
 *   Headers: Authorization: Bearer {NIDA_API_KEY}
 *   Response: { nationalId, foreName, surname, dateOfBirth, gender, photoUrl, status }
 */

const MOCK_RECORDS = {
  '1199080012345678': {
    foreName: 'Uwase',
    surname: 'Claudine',
    dateOfBirth: '1998-03-14',
    gender: 'F',
    status: 'ACTIVE',
  },
  '1199085098765432': {
    foreName: 'Ndayisenga',
    surname: 'Eric',
    dateOfBirth: '1996-11-02',
    gender: 'M',
    status: 'ACTIVE',
  },
};

/**
 * @param {string} nationalId - 16-digit Rwandan National ID
 * @returns {Promise<{found:boolean, fullName:?string, dateOfBirth:?string, gender:?string, status:?string}>}
 */
async function verifyByNationalId(nationalId) {
  // --- Real integration would look roughly like: ---
  // const res = await fetch(`${process.env.NIDA_BASE_URL}/verify`, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     Authorization: `Bearer ${process.env.NIDA_API_KEY}`,
  //   },
  //   body: JSON.stringify({ nationalId }),
  // });
  // if (!res.ok) return { found: false, fullName: null, dateOfBirth: null, gender: null, status: null };
  // const data = await res.json();
  // return {
  //   found: true,
  //   fullName: `${data.foreName} ${data.surname}`.trim(),
  //   dateOfBirth: data.dateOfBirth,
  //   gender: data.gender,
  //   status: data.status,
  // };

  const record = MOCK_RECORDS[nationalId];
  if (!record) {
    return { found: false, fullName: null, dateOfBirth: null, gender: null, status: null };
  }
  return {
    found: true,
    fullName: `${record.foreName} ${record.surname}`.trim(),
    dateOfBirth: record.dateOfBirth,
    gender: record.gender,
    status: record.status,
  };
}

module.exports = { verifyByNationalId };
