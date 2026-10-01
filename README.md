# DEVY USSD Application

USSD intake application for **DEVY (Digital Entrepreneurship for Vulnerable
Urban Youth)** — City of Kigali / MIFOTRA, World Bank-financed. Assigned
shortcode: **\*194#** (RURA requires this to work across MTN Rwanda, Airtel
Rwanda, and KTRN — see §6).

## 1. Architecture

```
USSD Gateway (MNO/aggregator)
        │  POST /ussd  { sessionId, phoneNumber, text }
        ▼
  src/server.js            Express webhook — gateway-specific glue only
        │
        ▼
  src/engine/ussdEngine.js State machine + 0=Back history stack
        │            │
        │            └── src/config/screens.js    bilingual prompts/options
        │            └── src/config/locations.js  District→Sector→Cell tree
        │                                         (OFFICIAL: 35 sectors, 161 cells)
        │            └── src/engine/validators.js input validation
        │            └── src/engine/sessionStore.js per-session state (TTL)
        │
        ├── src/pipeline/simDataPipeline.js   single-hop identity lookup
        │        └── simRegistryClient.js     MSISDN -> National ID + Name/DOB/Gender
        │
        └── src/services/applicationService.js   submit / status / reference #
                 └── src/pipeline/smsClient.js    post-submission confirmation SMS
```

Design choices:
- **Gateway-agnostic core.** Only `server.js` knows about the Africa's
  Talking-style `CON `/`END ` contract. Swapping aggregators (or a direct
  MNO gateway) means changing that one file; `ussdEngine` and everything it
  calls stays the same. Confirm this exact contract against whichever
  aggregator *194# actually routes through before launch — see §6.
- **Stateless-per-request engine.** `ussdEngine.processInput(session, input,
  msisdn)` is a pure-ish async function: given the current session and the
  newest keypress, it returns the next session + screen text. `sessionStore`
  persists that between HTTP requests (in-memory here; swap for Redis behind
  a load balancer — see comments in that file).
- **Bilingual by construction.** Every prompt lives in `screens.js` as
  `{ en, rw }`; the engine just picks `session.applicant.language`.
- **0=Back everywhere.** Every screen after Language/Main Menu pushes
  itself onto `session.history` before advancing; pressing 0 pops that
  stack and redraws the exact previous screen (same pagination page, if
  applicable) rather than forcing a restart. See §4.

## 2. Screen-to-code map

| Screen | Engine state | Variable | Notes |
|---|---|---|---|
| Language | `LANGUAGE` | `language` | |
| Main menu | `MAIN_MENU` | `main_menu` | `0` here means Exit, not Back |
| Status check | `STATUS_CHECK` | `status_reference` | free text, 6-char alphanumeric ref |
| Consent | `CONSENT` | `consent` | |
| District | `DISTRICT` | `district` | paginated, 3 items (no paging needed) |
| Sector | `SECTOR` | `sector` | paginated, up to 15 items (Gasabo) |
| Cell | `CELL` | `cell` | paginated, up to 8 items (Rusororo) |
| Education | `EDUCATION` | `education` | |
| Are you working? | `IS_WORKING` | `is_working` | branches — see below |
| Employment status | `WORKING_STATUS` | `working_status` | only if `is_working` = Yes |
| Specify your work | `OTHER_SPECIFY` | `other_specify` | only if `working_status` = Other; free text, no length cap |
| Are you a student? | `IS_STUDENT` | `is_student` | only if `is_working` = No |
| Disability | `DISABILITY` | `disability` | |
| Confirm | `CONFIRM` | `confirm` | Confirm & Submit / Cancel & Exit only |
| Submission | `SUBMISSION` | `submission` | shows the reference number |

**Employment branch:**
```
IS_WORKING
 ├─ 1.Yes → WORKING_STATUS (1.Self-employed / 2.Wage-employed / 3.Other)
 │            └─ 3.Other → OTHER_SPECIFY (free text) → DISABILITY
 │            └─ 1 or 2  → DISABILITY
 └─ 2.No  → IS_STUDENT (Yes/No) → DISABILITY
```

## 3. Data pipeline — SIM/NIDA identity resolution (single hop)

There is no way to read a handset's physical SIM applet over a USSD
session. What the requirement maps to operationally is: Rwanda requires SIM
registration to be tied to a verified National ID (RURA regulation), and —
per RURA's own site and a 2024 RURA regulation — that KYC capture already
includes **name, date of birth, and gender directly**, and must match
NIDA's own records ("The SIM card registration shall have the same KYC as
NIDA database"). So a single MNO KYC lookup is enough:

```
MSISDN (from USSD gateway request)
   │
   ▼
simRegistryClient.lookupByMsisdn(msisdn)   — MNO SIM-registration KYC
   │  -> nationalId, foreName, surName, dateOfBirth, gender
   ▼
session.applicant.identity = {
  nationalId, foreName, surName, dateOfBirth, gender,
  verified,        // true only if the KYC lookup succeeded
  source,          // 'sim_kyc' | 'unresolved'
  lookupAttemptedAt
}
```

An earlier version of this pipeline also called NIDA separately to fill in
name/DOB/gender; that hop was removed as redundant. `pipeline/nidaClient.js`
is kept in the repo (unused by the pipeline) in case a standalone NIDA
verification step is reintroduced later as an independent trust check.

**Trigger point:** immediately after the applicant answers "Yes" on the
consent screen — that screen is the disclosure/authorization point.

**Failure handling:** the lookup runs with a 4s timeout and never throws —
if it fails, `identity.source` is `'unresolved'` and the applicant's
session **continues uninterrupted**.

**National ID format:** Rwanda's National ID, Refugee ID, and Foreigner ID
all share the same 16-digit structure (first digit = status: 1 citizen / 2
foreigner / 3 refugee; next 4 = birth year; next 1 = gender; next 7 = birth
order; next 1 = reissue count; last 2 = security code). `isValidNationalId`
therefore accepts all three by design (`/^\d{16}$/`) — narrow it to
`/^1\d{15}$/` only if DEVY decides to exclude non-citizens.

**Imibereho is out of scope for this application.** The consent screen
still discloses cross-checking against Imibereho (Rwanda's social registry,
used for Ubudehe/bottom-60%-income eligibility) — that cross-check still
happens, just through a **separate integration outside this codebase**, so
the consent text needed no change. This app used to call Imibereho itself
post-submission (`pipeline/imibereho.js` + `applicationService.
enrichApplication()`); both were removed.

### What's mocked vs. real

`simRegistryClient.js` and `pipeline/smsClient.js` each contain a small
in-memory mock (clearly marked) **and** a commented-out real HTTP call
showing the expected request shape. Neither integration exists yet — each
requires its own agreement (MNO KYC access; an SMS gateway, likely the same
aggregator carrying the USSD session itself). Swapping the mock body for a
real `fetch()` call is a self-contained change.

Two demo phone numbers are wired to mock records end-to-end for testing:

| MSISDN | National ID | Name | DOB | Gender |
|---|---|---|---|---|
| `+250788000001` | `1199080012345678` | Uwase Claudine | 1998-03-14 | F |
| `+250788000002` | `1199085098765432` | Ndayisenga Eric | 1996-11-02 | M |

## 4. Confirm screen, 0=Back, and the removed Edit option

The Confirm screen used to offer `1.Confirm & Submit / 2.Edit / 3.Cancel`,
where Edit fully restarted the District→Disability question sequence. Edit
has been removed — Confirm now only offers `1.Confirm & Submit /
2.Cancel & Exit`. In its place, **every screen supports 0=Back**: a
`session.history` stack records each screen (and, for District/Sector/Cell,
which page) before advancing, and pressing 0 pops it and redraws exactly
where the applicant was — so a mistake three screens back can be corrected
by pressing 0 repeatedly, without losing anything already answered.

Two exceptions: `LANGUAGE` (nothing to go back to) and `MAIN_MENU` (`0`
already means Exit there). On a paginated District/Sector/Cell list, `0`
means "previous page" while `page > 0`, and only falls through to "back to
the previous screen" once back on page 0 — so the two behaviors never
collide.

**Known, accepted overflow risk:** `OTHER_SPECIFY` has no character cap (an
explicit decision — see `test/pagination.js`'s comments). Since the Confirm
summary echoes it back verbatim alongside every other answer, a long "Other"
description can push that one screen well past the ~182-char USSD ceiling
(measured up to 254 chars in testing). This is flagged in
`test/pagination.js` as a known risk rather than a blocking test failure.

## 5. USSD page-length limits and pagination

Most MNO/aggregator gateways cap a single USSD page at roughly 160-182
characters (GSM 7-bit encoding), and low-end feature-phone screens
typically show only ~7 lines before requiring an on-device scroll (which
industry guidance recommends not relying on). `ussdEngine.js` therefore
paginates any District/Sector/Cell menu with more than **5** entries
(`PAGE_SIZE = 5`, lowered from an earlier 8): each page shows up to 5 items
numbered 1-5 (page-relative, not the underlying data's own codes), plus
`9. Next` and/or `0. Back` when there are more entries. The applicant's
actual selection is still recorded using the real location code underneath
— pagination only changes what's *displayed*.

`test/pagination.js` exercises this (paging through Gasabo's 15-sector list
across 3 pages, going back mid-list, and picking an item) and asserts every
rendered screen in that run stays under 182 chars except the known
Other-Specify risk noted above.

## 6. Shortcode & cross-network compatibility (MTN / Airtel / KTRN)

DEVY's shortcode is **\*194#**. As of a RURA directive dated 14 January
2026, any approved shortcode **must work across all licensed operators in
Rwanda — MTN Rwanda, Airtel Rwanda, and KT Rwanda Network (KTRN)** — this
is now a regulatory requirement, not an optional integration choice.

`ussdEngine.js` is gateway-agnostic (see §1) so the screen logic itself
needs no per-network changes. What does need confirming is `server.js`'s
request/response contract: it's currently written for one aggregator style
(Africa's Talking-like `sessionId`/`phoneNumber`/`text` + `CON`/`END`).
Whether that's what *194# actually receives from all three networks depends
on whether DEVY goes through a multi-network aggregator (which normalizes
this for you) or direct per-operator integration (which may need a
per-operator adapter in `server.js`). Character limits and session
timeouts can also differ by operator even under the same shortcode — the
160-char design target in §5 is deliberately conservative for exactly this
reason, but should be re-confirmed against the actual aggregator/operator
contracts once known.

## 7. Post-submission SMS

Immediately after a successful Confirm & Submit, `applicationService.
submit()` sends a confirmation SMS (reference number) to the applicant's
MSISDN via `pipeline/smsClient.js`, mirroring the same mock/real pattern as
the identity pipeline. Sending is fire-and-forget — a failure is logged but
never blocks or fails the submission itself (same "degrade gracefully"
principle as the SIM KYC lookup). Most aggregators that carry a USSD
session also expose an SMS API under the same commercial agreement, so this
is typically not a separate integration to negotiate.

## 8. Reference numbers

Submitted applications get a 6-character alphanumeric reference (e.g.
`7K2QRP` — no `DEVY-{year}-` prefix, changed from an earlier version).
`isValidReference` in `validators.js` matches this exactly
(`/^[A-Z0-9]{6}$/i`).

## 9. Running it

```bash
npm install
npm start          # listens on :3000, POST /ussd
```

Test without a real gateway:

```bash
curl -X POST http://localhost:3000/ussd \
  -d "sessionId=sess1" -d "phoneNumber=+250788000001" -d "text="
curl -X POST http://localhost:3000/ussd \
  -d "sessionId=sess1" -d "phoneNumber=+250788000001" -d "text=2"
curl -X POST http://localhost:3000/ussd \
  -d "sessionId=sess1" -d "phoneNumber=+250788000001" -d "text=2*1"
# ...continue appending *<next input> to walk the flow
```

Or run the included end-to-end tests (no HTTP/Express needed):

```bash
node test/simulate.js   # happy-path walkthrough incl. branching, 0=Back, SMS
node test/pagination.js # pagination / char-limit check
```

## 10. Known follow-ups before production

- Replace the in-memory `sessionStore` and `applicationService` with Redis
  and a real database respectively.
- Confirm the real MNO KYC and SMS gateway API contracts (see §3, §7) and
  swap the mocked pipeline clients for live HTTP calls.
- Confirm *194#'s actual aggregator/gateway contract against `server.js`
  (see §6) — including per-operator character limits and session timeouts.
- Decide whether to cap `OTHER_SPECIFY`'s length given the Confirm-screen
  overflow risk noted in §4, or accept it and handle overflow at the
  gateway/display level instead.
- `locations.js` carries the full official District→Sector→Cell list for
  Gasabo, Kicukiro, and Nyarugenge (35 sectors, 161 cells — sourced from
  Rwanda Energy Group's national village registry and the Nyarugenge
  district government site). Re-verify against NISR/MINALOC before
  production if the administrative boundaries have changed since.
