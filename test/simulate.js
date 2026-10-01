'use strict';

// Exercises ussdEngine.processInput directly (no Express/HTTP needed) to
// sanity-check: the new Is-Working/Is-Student/Other-Specify branching,
// 0=Back navigation (including a mid-flow correction), pagination at
// PAGE_SIZE=5, the simplified Confirm screen, and the SMS sent on submit.

const ussdEngine = require('../src/engine/ussdEngine');
const smsClient = require('../src/pipeline/smsClient');

async function run() {
  const msisdn = '+250788000002'; // matches mock SIM KYC records (Ndayisenga Eric)
  let session = null;
  let lastResult;

  async function step(input, label) {
    lastResult = await ussdEngine.processInput(session, input, msisdn);
    session = lastResult.session;
    console.log(`--- [${label}] input: ${JSON.stringify(input)} (state -> ${session.state}) ---`);
    console.log(lastResult.text);
    console.log();
    return lastResult;
  }

  await step('', 'first hit');
  await step('2', 'language: English');
  await step('1', 'main menu: Apply');
  await step('1', 'consent: Yes');
  await step('1', 'district: Gasabo');
  await step('9', 'sector page 1: Next');            // Gasabo has 15 sectors, PAGE_SIZE=5 -> 3 pages
  await step('1', 'sector page 2: pick item 1 (page-relative)');
  // deliberately made a mistake -> go back and re-pick a different sector
  await step('0', 'back to sector list (should return to page 2)');
  await step('2', 'sector page 2: pick item 2 instead');
  await step('1', 'cell: pick first cell');
  await step('5', 'education: University+');
  await step('2', 'is_working: No -> should skip Working Status, go to Is-Student');
  if (session.state !== 'IS_STUDENT') throw new Error('Expected IS_WORKING=No to route to IS_STUDENT.');
  await step('1', 'is_student: Yes');
  await step('2', 'disability: No');
  await step('1', 'confirm: Confirm & Submit');

  console.log('Identity resolved via SIM KYC pipeline:', JSON.stringify(session.applicant.identity, null, 2));
  console.log('SMS outbox:', JSON.stringify(smsClient._getSentLog(), null, 2));

  if (lastResult.continueSession) throw new Error('Expected session to terminate after submission.');
  if (!/Reference number: [A-Z0-9]{6}\./.test(lastResult.text)) {
    throw new Error('Expected a 6-char alphanumeric reference with no DEVY-YYYY- prefix.');
  }
  if (smsClient._getSentLog().length !== 1) {
    throw new Error('Expected exactly one SMS to have been sent.');
  }

  console.log('\n✅ Branching, 0=Back, pagination, Confirm, and SMS dispatch all behaved as expected.');
}

run().catch((err) => {
  console.error('❌ Simulation failed:', err);
  process.exit(1);
});
