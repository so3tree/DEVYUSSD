'use strict';

/** True if `input` is one of the numeric keys defined in `options`. */
function isValidOption(input, options) {
  if (!options) return true; // free-text screens validate elsewhere
  return Object.prototype.hasOwnProperty.call(options, String(input).trim());
}

/** Reference-number format used to look up a submitted application: 6 alphanumeric characters, no prefix. */
function isValidReference(input) {
  return /^[A-Z0-9]{6}$/.test(String(input).trim().toUpperCase());
}

/** Rwandan National ID: 16 digits. */
function isValidNationalId(id) {
  return /^\d{16}$/.test(String(id || '').trim());
}

/** Basic MSISDN sanity check (Rwanda: +2507XXXXXXXX). */
function isValidRwandaMsisdn(msisdn) {
  return /^\+?2507\d{8}$/.test(String(msisdn || '').trim());
}

module.exports = {
  isValidOption,
  isValidReference,
  isValidNationalId,
  isValidRwandaMsisdn,
};
