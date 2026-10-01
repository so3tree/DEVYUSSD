'use strict';

const { SCREENS } = require('../config/screens');
const { getDistricts, getSectors, getCells, nameOf } = require('../config/locations');
const { isValidOption, isValidReference } = require('./validators');
const simDataPipeline = require('../pipeline/simDataPipeline');
const applicationService = require('../services/applicationService');

/**
 * Max real options per USSD page for dynamically-sized menus (District /
 * Sector / Cell). Lowered from 8 to 5 so a full page (items + "9. Next")
 * fits within the ~7 lines many basic feature-phone USSD dialogs show
 * without requiring the handset's own scroll — see README for the
 * character-limit and device-display background on this.
 */
const PAGE_SIZE = 5;

function t(screenId, lang, vars = {}) {
  let text = SCREENS[screenId].prompt[lang];
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}

/** Slices a { code: entry } map into the requested page (0-indexed). */
function computePage(map, page) {
  const entries = Object.entries(map);
  const start = page * PAGE_SIZE;
  const pageEntries = entries.slice(start, start + PAGE_SIZE);
  return {
    pageEntries,
    hasNext: start + PAGE_SIZE < entries.length,
    hasPrev: page > 0,
  };
}

/**
 * Renders one page of a dynamic menu (District/Sector/Cell) with
 * page-relative numbering (always 1..N for this page), plus "9. Next" /
 * "0. Back" navigation lines when there are more entries than fit.
 * Note: on page 0, "0" doubles as "back to the previous screen" (see the
 * global back-handling in processInput) rather than "previous page".
 */
function renderPagedMenu(screenId, map, lang, page) {
  const { pageEntries, hasNext, hasPrev } = computePage(map, page);
  const lines = pageEntries.map(([, entry], idx) => `${idx + 1}. ${(entry.name || entry)[lang]}`);
  if (hasNext) lines.push(`9. ${lang === 'rw' ? 'Ibikurikira' : 'Next'}`);
  if (hasPrev) lines.push(`0. ${lang === 'rw' ? 'Inyuma' : 'Back'}`);
  return t(screenId, lang) + '\n' + lines.join('\n');
}

/**
 * Interprets one input against the current page of a dynamic menu:
 * paging (9/0), a valid page-relative selection, or invalid input.
 * On selection, `code` is the entry's ORIGINAL map key, not the
 * page-relative digit shown on screen.
 */
function resolvePagedChoice(map, page, input) {
  const { pageEntries, hasNext, hasPrev } = computePage(map, page);
  if (input === '9' && hasNext) return { action: 'next' };
  if (input === '0' && hasPrev) return { action: 'prev' };
  const n = Number(input);
  if (Number.isInteger(n) && n >= 1 && n <= pageEntries.length) {
    const [code, entry] = pageEntries[n - 1];
    return { action: 'select', code, entry };
  }
  return { action: 'invalid' };
}

/**
 * Renders the current screen's text purely from session.state (+
 * pagination + whatever ancestor selections are already in
 * session.applicant). Used both for normal forward navigation and to
 * redraw a screen after popping the history stack on 0=Back — the exact
 * same page the applicant was on before is restored, not a fresh page 0.
 */
function renderStateScreen(session, lang) {
  switch (session.state) {
    case 'MAIN_MENU': return t('MAIN_MENU', lang);
    case 'STATUS_CHECK': return t('STATUS_CHECK', lang);
    case 'CONSENT': return t('CONSENT', lang);
    case 'DISTRICT': return renderPagedMenu('DISTRICT', getDistricts(), lang, session.pagination.page);
    case 'SECTOR': return renderPagedMenu('SECTOR', getSectors(session.applicant.district.code), lang, session.pagination.page);
    case 'CELL': return renderPagedMenu('CELL', getCells(session.applicant.district.code, session.applicant.sector.code), lang, session.pagination.page);
    case 'EDUCATION': return t('EDUCATION', lang);
    case 'IS_WORKING': return t('IS_WORKING', lang);
    case 'WORKING_STATUS': return t('WORKING_STATUS', lang);
    case 'IS_STUDENT': return t('IS_STUDENT', lang);
    case 'OTHER_SPECIFY': return t('OTHER_SPECIFY', lang);
    case 'DISABILITY': return t('DISABILITY', lang);
    case 'CONFIRM': return summaryText(session.applicant, lang) + '\n' + t('CONFIRM', lang);
    default: return t('LANGUAGE', 'en');
  }
}

/** Screens with no valid "back" target (first screen, or 0 already means something else). */
const NO_BACK_STATES = new Set(['LANGUAGE', 'MAIN_MENU']);
const PAGED_LIST_STATES = new Set(['DISTRICT', 'SECTOR', 'CELL']);

function newSession() {
  return {
    state: 'LANGUAGE',
    pagination: { page: 0 }, // current page for whichever dynamic menu is active
    history: [], // stack of { state, pagination } for 0=Back
    applicant: {
      language: null,
      msisdn: null,
      district: null,
      sector: null,
      cell: null,
      education: null,
      is_working: null,
      working_status: null,
      is_student: null,
      other_specify: null,
      disability: null,
      identity: null, // populated by simDataPipeline after consent
    },
  };
}

/** Pushes the current screen onto the back-history stack before leaving it. */
function pushHistory(session) {
  session.history.push({ state: session.state, pagination: { ...session.pagination } });
}

/**
 * @param {object|null} session - existing session (null on first hit)
 * @param {string} rawInput - the latest single input segment from the applicant
 * @param {string} msisdn - applicant phone number (E.164)
 * @returns {Promise<{session:object, text:string, continueSession:boolean}>}
 */
async function processInput(session, rawInput, msisdn) {
  if (!session) {
    session = newSession();
    return { session, text: t('LANGUAGE', 'en'), continueSession: true };
  }

  const input = String(rawInput || '').trim();
  const lang = session.applicant.language || 'en';

  // --- Global 0=Back handling -----------------------------------------
  // On a paginated list mid-way through its pages, "0" still means
  // "previous page" (handled inside that state's own case via
  // resolvePagedChoice). Everywhere else, "0" pops the history stack and
  // redraws whatever screen the applicant was previously on.
  const onPagedListState = PAGED_LIST_STATES.has(session.state);
  const backEligible =
    input === '0' &&
    !NO_BACK_STATES.has(session.state) &&
    session.history.length > 0 &&
    (!onPagedListState || session.pagination.page === 0);

  if (backEligible) {
    const prev = session.history.pop();
    session.state = prev.state;
    session.pagination = prev.pagination;
    return { session, text: renderStateScreen(session, lang), continueSession: true };
  }

  switch (session.state) {
    // ---------------------------------------------------------------
    case 'LANGUAGE': {
      if (!isValidOption(input, SCREENS.LANGUAGE.options)) {
        return { session, text: `${t('LANGUAGE', 'en')}`, continueSession: true };
      }
      session.applicant.language = input === '1' ? 'rw' : 'en';
      session.state = 'MAIN_MENU';
      return { session, text: t('MAIN_MENU', session.applicant.language), continueSession: true };
    }

    // ---------------------------------------------------------------
    case 'MAIN_MENU': {
      if (!isValidOption(input, SCREENS.MAIN_MENU.options)) {
        return { session, text: invalid(lang) + t('MAIN_MENU', lang), continueSession: true };
      }
      if (input === '0') {
        return { session, text: byeMessage(lang), continueSession: false };
      }
      pushHistory(session);
      if (input === '2') {
        session.state = 'STATUS_CHECK';
        return { session, text: t('STATUS_CHECK', lang), continueSession: true };
      }
      // input === '1' -> Apply
      session.state = 'CONSENT';
      return { session, text: t('CONSENT', lang), continueSession: true };
    }

    // ---------------------------------------------------------------
    case 'STATUS_CHECK': {
      if (!isValidReference(input)) {
        return {
          session,
          text: (lang === 'rw'
            ? 'Nimero itariyo. Ongera ugerageze:\n'
            : 'Invalid reference number. Please try again:\n') + t('STATUS_CHECK', lang),
          continueSession: true,
        };
      }
      const record = applicationService.findByReference(input);
      const text = record
        ? statusMessage(record, lang)
        : (lang === 'rw' ? 'Ubusabe ntibwabonetse.' : 'Application not found.');
      return { session, text, continueSession: false };
    }

    // ---------------------------------------------------------------
    case 'CONSENT': {
      if (!isValidOption(input, SCREENS.CONSENT.options)) {
        return { session, text: invalid(lang) + t('CONSENT', lang), continueSession: true };
      }
      if (input === '2') {
        return {
          session,
          text: lang === 'rw'
            ? 'Ntibishoboka gukomeza kwiyandikisha utemeye amabwiriza. Murakoze.'
            : 'We cannot proceed with your application without consent. Thank you.',
          continueSession: false,
        };
      }
      // Consent granted -> record msisdn and trigger SIM/NIDA identity
      // pipeline before continuing.
      session.applicant.msisdn = msisdn;
      session.applicant.identity = await simDataPipeline.resolveIdentity(msisdn);
      pushHistory(session);
      session.state = 'DISTRICT';
      session.pagination = { page: 0 };
      return { session, text: renderPagedMenu('DISTRICT', getDistricts(), lang, 0), continueSession: true };
    }

    // ---------------------------------------------------------------
    case 'DISTRICT': {
      const districts = getDistricts();
      const page = session.pagination.page;
      const choice = resolvePagedChoice(districts, page, input);

      if (choice.action === 'next' || choice.action === 'prev') {
        session.pagination.page += choice.action === 'next' ? 1 : -1;
        return { session, text: renderPagedMenu('DISTRICT', districts, lang, session.pagination.page), continueSession: true };
      }
      if (choice.action === 'invalid') {
        return { session, text: invalid(lang) + renderPagedMenu('DISTRICT', districts, lang, page), continueSession: true };
      }

      pushHistory(session);
      session.applicant.district = { code: choice.code, name: nameOf(districts, choice.code, lang) };
      session.state = 'SECTOR';
      session.pagination = { page: 0 };
      const sectors = getSectors(choice.code);
      return { session, text: renderPagedMenu('SECTOR', sectors, lang, 0), continueSession: true };
    }

    // ---------------------------------------------------------------
    case 'SECTOR': {
      const sectors = getSectors(session.applicant.district.code);
      const page = session.pagination.page;
      const choice = resolvePagedChoice(sectors, page, input);

      if (choice.action === 'next' || choice.action === 'prev') {
        session.pagination.page += choice.action === 'next' ? 1 : -1;
        return { session, text: renderPagedMenu('SECTOR', sectors, lang, session.pagination.page), continueSession: true };
      }
      if (choice.action === 'invalid') {
        return { session, text: invalid(lang) + renderPagedMenu('SECTOR', sectors, lang, page), continueSession: true };
      }

      pushHistory(session);
      session.applicant.sector = { code: choice.code, name: nameOf(sectors, choice.code, lang) };
      session.state = 'CELL';
      session.pagination = { page: 0 };
      const cells = getCells(session.applicant.district.code, choice.code);
      return { session, text: renderPagedMenu('CELL', cells, lang, 0), continueSession: true };
    }

    // ---------------------------------------------------------------
    case 'CELL': {
      const cells = getCells(session.applicant.district.code, session.applicant.sector.code);
      const page = session.pagination.page;
      const choice = resolvePagedChoice(cells, page, input);

      if (choice.action === 'next' || choice.action === 'prev') {
        session.pagination.page += choice.action === 'next' ? 1 : -1;
        return { session, text: renderPagedMenu('CELL', cells, lang, session.pagination.page), continueSession: true };
      }
      if (choice.action === 'invalid') {
        return { session, text: invalid(lang) + renderPagedMenu('CELL', cells, lang, page), continueSession: true };
      }

      pushHistory(session);
      session.applicant.cell = { code: choice.code, name: nameOf(cells, choice.code, lang) };
      session.state = 'EDUCATION';
      return { session, text: t('EDUCATION', lang), continueSession: true };
    }

    // ---------------------------------------------------------------
    case 'EDUCATION': {
      if (!isValidOption(input, SCREENS.EDUCATION.options)) {
        return { session, text: invalid(lang) + t('EDUCATION', lang), continueSession: true };
      }
      pushHistory(session);
      session.applicant.education = { code: input, label: SCREENS.EDUCATION.options[input][lang] };
      session.state = 'IS_WORKING';
      return { session, text: t('IS_WORKING', lang), continueSession: true };
    }

    // ---------------------------------------------------------------
    case 'IS_WORKING': {
      if (!isValidOption(input, SCREENS.IS_WORKING.options)) {
        return { session, text: invalid(lang) + t('IS_WORKING', lang), continueSession: true };
      }
      pushHistory(session);
      session.applicant.is_working = { code: input, label: SCREENS.IS_WORKING.options[input][lang] };
      if (input === '1') {
        session.state = 'WORKING_STATUS';
        return { session, text: t('WORKING_STATUS', lang), continueSession: true };
      }
      // input === '2' -> No -> skip straight to Is-Student
      session.state = 'IS_STUDENT';
      return { session, text: t('IS_STUDENT', lang), continueSession: true };
    }

    // ---------------------------------------------------------------
    case 'WORKING_STATUS': {
      if (!isValidOption(input, SCREENS.WORKING_STATUS.options)) {
        return { session, text: invalid(lang) + t('WORKING_STATUS', lang), continueSession: true };
      }
      pushHistory(session);
      session.applicant.working_status = { code: input, label: SCREENS.WORKING_STATUS.options[input][lang] };
      if (input === '3') {
        session.state = 'OTHER_SPECIFY';
        return { session, text: t('OTHER_SPECIFY', lang), continueSession: true };
      }
      session.state = 'DISABILITY';
      return { session, text: t('DISABILITY', lang), continueSession: true };
    }

    // ---------------------------------------------------------------
    case 'IS_STUDENT': {
      if (!isValidOption(input, SCREENS.IS_STUDENT.options)) {
        return { session, text: invalid(lang) + t('IS_STUDENT', lang), continueSession: true };
      }
      pushHistory(session);
      session.applicant.is_student = { code: input, label: SCREENS.IS_STUDENT.options[input][lang] };
      session.state = 'DISABILITY';
      return { session, text: t('DISABILITY', lang), continueSession: true };
    }

    // ---------------------------------------------------------------
    case 'OTHER_SPECIFY': {
      // Free text, no length cap. Only guard against a blank submission
      // (an accidental empty CON send) — anything else is accepted as-is.
      // Note: a literal "0" here is swallowed by the global back-handler
      // above rather than saved as the answer; an edge case given the
      // field is a job description, not worth special-casing further.
      if (!input) {
        return { session, text: invalid(lang) + t('OTHER_SPECIFY', lang), continueSession: true };
      }
      pushHistory(session);
      session.applicant.other_specify = input;
      session.state = 'DISABILITY';
      return { session, text: t('DISABILITY', lang), continueSession: true };
    }

    // ---------------------------------------------------------------
    case 'DISABILITY': {
      if (!isValidOption(input, SCREENS.DISABILITY.options)) {
        return { session, text: invalid(lang) + t('DISABILITY', lang), continueSession: true };
      }
      pushHistory(session);
      session.applicant.disability = { code: input, label: SCREENS.DISABILITY.options[input][lang] };
      session.state = 'CONFIRM';
      return { session, text: summaryText(session.applicant, lang) + '\n' + t('CONFIRM', lang), continueSession: true };
    }

    // ---------------------------------------------------------------
    case 'CONFIRM': {
      if (!isValidOption(input, SCREENS.CONFIRM.options)) {
        return {
          session,
          text: invalid(lang) + summaryText(session.applicant, lang) + '\n' + t('CONFIRM', lang),
          continueSession: true,
        };
      }
      if (input === '2') {
        return { session, text: lang === 'rw' ? 'Ubusabe bwahagaritswe.' : 'Application cancelled.', continueSession: false };
      }
      // input === '1' -> Confirm & Submit
      const { reference } = applicationService.submit(session.applicant);
      session.state = 'SUBMISSION';
      return { session, text: t('SUBMISSION', lang, { ref: reference }), continueSession: false };
    }

    default: {
      const fresh = newSession();
      return { session: fresh, text: t('LANGUAGE', 'en'), continueSession: true };
    }
  }
}

// ---------------------------------------------------------------------------
function invalid(lang) {
  return lang === 'rw' ? 'Igisubizo ntabwo cyemewe.\n' : 'Invalid option.\n';
}

function byeMessage(lang) {
  return lang === 'rw' ? 'Murakoze gukoresha DEVY.' : 'Thank you for using DEVY.';
}

function statusMessage(record, lang) {
  const statusLabel = { RECEIVED: { en: 'Received', rw: 'Bwakiriwe' } };
  const label = (statusLabel[record.status] || { en: record.status, rw: record.status })[lang];
  return lang === 'rw'
    ? `Uko ubusabe bugeze: ${label} (${record.reference})`
    : `Application status: ${label} (${record.reference})`;
}

function summaryText(applicant, lang) {
  const L = (en, rw) => (lang === 'rw' ? rw : en);
  const rows = [
    `${L('District', 'Akarere')}: ${applicant.district?.name}`,
    `${L('Sector', 'Umurenge')}: ${applicant.sector?.name}`,
    `${L('Cell', 'Akagari')}: ${applicant.cell?.name}`,
    `${L('Education', 'Amashuri')}: ${applicant.education?.label}`,
    `${L('Working', 'Akazi')}: ${applicant.is_working?.label}`,
  ];
  if (applicant.working_status) rows.push(`${L('Employment', 'Imimerere')}: ${applicant.working_status.label}`);
  if (applicant.other_specify) rows.push(`${L('Specify', 'Sobanura')}: ${applicant.other_specify}`);
  if (applicant.is_student) rows.push(`${L('Student', 'Umunyeshuri')}: ${applicant.is_student.label}`);
  rows.push(`${L('Disability', 'Ubumuga')}: ${applicant.disability?.label}`);
  return rows.join('\n');
}

module.exports = { processInput, newSession };
