'use strict';

/**
 * DEVY USSD Intake Journey — screen definitions.
 * Each screen carries:
 *   - id: internal state name (matches ussdEngine STATES)
 *   - variable: the applicant data field this screen collects
 *   - prompt: { en, rw } prompt text
 *   - options: static menu options (value -> { en, rw }), or null if the
 *              screen is dynamically populated (sector/cell) or free-text.
 *
 * NOTE: MNOs typically cap a single USSD page at ~182 characters (varies by
 * handset/network). Confirm this against whichever aggregator/MNO gateway
 * DEVY's shortcode (*194#) is actually routed through before launch.
 */

const SCREENS = {
  LANGUAGE: {
    id: 'LANGUAGE',
    variable: 'language',
    prompt: {
      en: 'Welcome to DEVY. Choose language:\n1. Kinyarwanda\n2. English',
      rw: 'Murakaza neza kuri DEVY. Hitamo ururimi:\n1. Kinyarwanda\n2. English',
    },
    options: {
      1: { en: 'Kinyarwanda', rw: 'Kinyarwanda' },
      2: { en: 'English', rw: 'Icyongereza' },
    },
  },

  MAIN_MENU: {
    id: 'MAIN_MENU',
    variable: 'main_menu',
    prompt: {
      en: 'Application for DEVY:\n1. Apply\n2. Check application status\n0. Exit',
      rw: 'Saba kwinjira muri DEVY:\n1. Kwiyandikisha\n2. Kureba uko ubusabe bugeze\n0. Gusohoka',
    },
    options: {
      1: { en: 'Apply', rw: 'Kwiyandikisha' },
      2: { en: 'Check application status', rw: 'Kureba uko ubusabe bugeze' },
      0: { en: 'Exit', rw: 'Gusohoka' },
    },
  },

  // Separate branch: application-status lookup (referenced in main_menu notes)
  STATUS_CHECK: {
    id: 'STATUS_CHECK',
    variable: 'status_reference',
    prompt: {
      en: 'Enter your reference number to check status:',
      rw: 'Andika nimero yo kwibuka kugira ngo urebe uko bugeze:',
    },
    options: null, // free text
  },

  CONSENT: {
    id: 'CONSENT',
    variable: 'consent',
    prompt: {
      en: "Do you consent to your data being used for DEVY and cross-checked against Imibereho and other government registries?\n1. Yes, I agree\n2. No, I do not agree",
      rw: "Wemeye ko amakuru yawe akoreshwa muri DEVY kandi agenzurwa muri Imibereho n'ubundi bubiko bwa Leta?\n1. Yego, Nemeye\n2. Oya",
    },
    options: {
      1: { en: 'Yes, I agree', rw: 'Yego, Nemeye' },
      2: { en: 'No, I do not agree', rw: 'Oya' },
    },
    // MNO to publish the T&C link; USSD only carries the yes/no gate. The
    // Imibereho cross-check disclosed here still happens — this application
    // just doesn't perform that call itself; it's wired up through a
    // separate integration outside this codebase (see applicationService.js).
    note: 'This application does not call Imibereho directly. The consent text stays accurate because the cross-check itself still happens, just via a separate integration.',
  },

  DISTRICT: {
    id: 'DISTRICT',
    variable: 'district',
    prompt: { en: 'Select District:', rw: 'Hitamo Akarere:' },
    options: null, // rendered from config/locations.js
  },

  SECTOR: {
    id: 'SECTOR',
    variable: 'sector',
    prompt: { en: 'Select Sector:', rw: 'Hitamo Umurenge:' },
    options: null, // auto-populated based on district
  },

  CELL: {
    id: 'CELL',
    variable: 'cell',
    prompt: { en: 'Select Cell:', rw: 'Hitamo Akagari:' },
    options: null, // auto-populated based on sector
  },

  EDUCATION: {
    id: 'EDUCATION',
    variable: 'education',
    prompt: {
      en: "Select your highest education level:\n1. No formal education\n2. Primary\n3. O-Level\n4. A-Level / TVET\n5. University or higher",
      rw: "Hitamo urwego rwo hejuru rw'amashuri wize:\n1. Nta mashuri\n2. Abanza\n3. Ayisumbuye ashingiye\n4. Ayisumbuye ntoya / TVET\n5. Kaminuza+",
    },
    options: {
      1: { en: 'No formal education', rw: 'Nta mashuri' },
      2: { en: 'Primary', rw: 'Abanza' },
      3: { en: 'O-Level', rw: 'Ayisumbuye ashingiye' },
      4: { en: 'A-Level / TVET', rw: 'Ayisumbuye ntoya / TVET' },
      5: { en: 'University or higher', rw: 'Kaminuza+' },
    },
  },

  // Renamed from WORKING -> IS_WORKING (screen id, engine state, and the
  // applicant field it writes are all consistently IS_WORKING / is_working).
  IS_WORKING: {
    id: 'IS_WORKING',
    variable: 'is_working',
    prompt: {
      en: 'Are you currently working?\n1. Yes\n2. No',
      rw: 'Ubu urakora?\n1. Yego\n2. Oya',
    },
    options: {
      1: { en: 'Yes', rw: 'Yego' },
      2: { en: 'No', rw: 'Oya' },
    },
  },

  // Only reached when IS_WORKING = No. Uses the same "Ubu" (currently)
  // construction as IS_WORKING for consistency.
  IS_STUDENT: {
    id: 'IS_STUDENT',
    variable: 'is_student',
    prompt: {
      en: 'Are you currently a student?\n1. Yes\n2. No',
      rw: 'Ubu uri umunyeshuri?\n1. Yego\n2. Oya',
    },
    options: {
      1: { en: 'Yes', rw: 'Yego' },
      2: { en: 'No', rw: 'Oya' },
    },
  },

  // Only reached when IS_WORKING = Yes. "Student" removed (now covered by
  // IS_STUDENT on the No-branch); remaining options renumbered 1-3.
  WORKING_STATUS: {
    id: 'WORKING_STATUS',
    variable: 'working_status',
    prompt: {
      en: 'Select your current employment status:\n1. Self-employed / entrepreneur\n2. Wage-employed\n3. Other',
      rw: "Hitamo imimerere y'akazi kawe:\n1. Nifitiye ubucuruzi\n2. Mfite akazi k'umushahara\n3. Ibindi",
    },
    options: {
      1: { en: 'Self-employed / entrepreneur', rw: 'Nifitiye ubucuruzi' },
      2: { en: 'Wage-employed', rw: "Mfite akazi k'umushahara" },
      3: { en: 'Other', rw: 'Ibindi' },
    },
  },

  // Only reached when WORKING_STATUS = Other (3). Free text, no length cap.
  OTHER_SPECIFY: {
    id: 'OTHER_SPECIFY',
    variable: 'other_specify',
    prompt: {
      en: 'Please specify your work:',
      rw: 'Sobanura akazi ukora:',
    },
    options: null, // free text
  },

  DISABILITY: {
    id: 'DISABILITY',
    variable: 'disability',
    prompt: {
      en: 'Do you have a disability?\n1. Yes\n2. No',
      rw: 'Ufite ubumuga?\n1. Yego\n2. Oya',
    },
    options: {
      1: { en: 'Yes', rw: 'Yego' },
      2: { en: 'No', rw: 'Oya' },
    },
  },

  // "Edit" removed in favor of 0=Back (see ussdEngine's history stack) —
  // only Confirm & Submit / Cancel & Exit remain.
  CONFIRM: {
    id: 'CONFIRM',
    variable: 'confirm',
    prompt: {
      en: 'Confirm your application?\n1. Confirm & Submit\n2. Cancel & Exit',
      rw: "Emeza ubusabe bwawe?\n1. Emeza n'Ohereza\n2. Reka",
    },
    options: {
      1: { en: 'Confirm & Submit', rw: "Emeza n'Ohereza" },
      2: { en: 'Cancel & Exit', rw: 'Reka' },
    },
  },

  SUBMISSION: {
    id: 'SUBMISSION',
    variable: 'submission',
    // {ref} is interpolated at render time
    prompt: {
      en: 'Thank you! Your application has been received. Reference number: {ref}.\nYou will be notified by SMS.',
      rw: 'Murakoze! Ubusabe bwanyu bwakiriwe. Nimero yo kwibuka: {ref}.\nUzamenyeshwa binyuze kuri SMS.',
    },
    options: null,
    terminal: true,
  },

  // Not a USSD screen — reused by applicationService.js to render the SMS
  // sent immediately after a successful submission. Kept here so every
  // user-facing string in the app lives in one bilingual place.
  SMS_SUBMISSION: {
    id: 'SMS_SUBMISSION',
    prompt: {
      en: 'DEVY: Your application was received. Reference number: {ref}. Keep it to check your status anytime.',
      rw: 'DEVY: Ubusabe bwanyu bwakiriwe. Nimero yo kwibuka: {ref}. Yibuke iyi nimero kugira ngo urebe uko bugeze igihe cyose.',
    },
    options: null,
  },
};

module.exports = { SCREENS };
