'use strict';

const { randomBytes } = require('crypto');

/** Generates a 6-character alphanumeric reference, e.g. 7K2QRP */
function generateReference() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity
  const bytes = randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

module.exports = { generateReference };
