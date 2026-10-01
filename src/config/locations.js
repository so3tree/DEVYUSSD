'use strict';

/**
 * Kigali administrative hierarchy: District -> Sector -> Cell.
 * DEVY targets vulnerable urban youth in the City of Kigali, so the three
 * districts match the PAD/PIM scope (Gasabo, Kicukiro, Nyarugenge).
 *
 * OFFICIAL DATA — replaces the earlier sample/placeholder set. Sourced from:
 *   - Gasabo & Kicukiro: Rwanda Energy Group's national village registry
 *     (Province/District/Sector/Cell/Village listing), cross-checked against
 *     Wikipedia sector pages.
 *   - Nyarugenge: the district's own government site
 *     (nyarugenge.gov.rw/en/district/sectors-and-cells).
 * Totals match the City of Kigali's published figures: Gasabo 15 sectors /
 * 73 cells, Kicukiro 10 sectors / 41 cells, Nyarugenge 10 sectors / 47 cells
 * (161 cells total). Village level is intentionally not included — the
 * USSD spec only goes down to Cell.
 *
 * Sector/Cell codes are local to their parent (Sector "1" means a different
 * place under each District; Cell "1" means a different place under each
 * Sector) — that's how the cascading USSD menu is meant to work, but it's
 * worth flagging to whoever wires this into a flat lookup table downstream.
 */

const LOCATIONS = {
  1: {
    name: { en: 'Gasabo', rw: 'Gasabo' },
    sectors: {
      1: { name: { en: 'Bumbogo', rw: 'Bumbogo' }, cells: {
        1: { en: 'Kinyaga', rw: 'Kinyaga' }, 2: { en: 'Musave', rw: 'Musave' }, 3: { en: 'Mvuzo', rw: 'Mvuzo' },
        4: { en: 'Ngara', rw: 'Ngara' }, 5: { en: 'Nkuzuzu', rw: 'Nkuzuzu' }, 6: { en: 'Nyabikenke', rw: 'Nyabikenke' },
        7: { en: 'Nyagasozi', rw: 'Nyagasozi' },
      } },
      2: { name: { en: 'Gatsata', rw: 'Gatsata' }, cells: {
        1: { en: 'Karuruma', rw: 'Karuruma' }, 2: { en: 'Nyamabuye', rw: 'Nyamabuye' }, 3: { en: 'Nyamugari', rw: 'Nyamugari' },
      } },
      3: { name: { en: 'Gikomero', rw: 'Gikomero' }, cells: {
        1: { en: 'Gasagara', rw: 'Gasagara' }, 2: { en: 'Gicaca', rw: 'Gicaca' }, 3: { en: 'Kibara', rw: 'Kibara' },
        4: { en: 'Munini', rw: 'Munini' }, 5: { en: 'Murambi', rw: 'Murambi' },
      } },
      4: { name: { en: 'Gisozi', rw: 'Gisozi' }, cells: {
        1: { en: 'Musezero', rw: 'Musezero' }, 2: { en: 'Ruhango', rw: 'Ruhango' },
      } },
      5: { name: { en: 'Jabana', rw: 'Jabana' }, cells: {
        1: { en: 'Akamatamu', rw: 'Akamatamu' }, 2: { en: 'Bweramvura', rw: 'Bweramvura' }, 3: { en: 'Kabuye', rw: 'Kabuye' },
        4: { en: 'Kidashya', rw: 'Kidashya' }, 5: { en: 'Ngiryi', rw: 'Ngiryi' },
      } },
      6: { name: { en: 'Jali', rw: 'Jali' }, cells: {
        1: { en: 'Agateko', rw: 'Agateko' }, 2: { en: 'Buhiza', rw: 'Buhiza' }, 3: { en: 'Muko', rw: 'Muko' },
        4: { en: 'Nkusi', rw: 'Nkusi' }, 5: { en: 'Nyabuliba', rw: 'Nyabuliba' }, 6: { en: 'Nyakabungo', rw: 'Nyakabungo' },
        7: { en: 'Nyamitanga', rw: 'Nyamitanga' },
      } },
      7: { name: { en: 'Kacyiru', rw: 'Kacyiru' }, cells: {
        1: { en: 'Kamatamu', rw: 'Kamatamu' }, 2: { en: 'Kamutwa', rw: 'Kamutwa' }, 3: { en: 'Kibaza', rw: 'Kibaza' },
      } },
      8: { name: { en: 'Kimihurura', rw: 'Kimihurura' }, cells: {
        1: { en: 'Kamukina', rw: 'Kamukina' }, 2: { en: 'Kimihurura', rw: 'Kimihurura' }, 3: { en: 'Rugando', rw: 'Rugando' },
      } },
      9: { name: { en: 'Kimironko', rw: 'Kimironko' }, cells: {
        1: { en: 'Bibare', rw: 'Bibare' }, 2: { en: 'Kibagabaga', rw: 'Kibagabaga' }, 3: { en: 'Nyagatovu', rw: 'Nyagatovu' },
      } },
      10: { name: { en: 'Kinyinya', rw: 'Kinyinya' }, cells: {
        1: { en: 'Gacuriro', rw: 'Gacuriro' }, 2: { en: 'Gasharu', rw: 'Gasharu' }, 3: { en: 'Kagugu', rw: 'Kagugu' },
        4: { en: 'Murama', rw: 'Murama' },
      } },
      11: { name: { en: 'Ndera', rw: 'Ndera' }, cells: {
        1: { en: 'Bwiza', rw: 'Bwiza' }, 2: { en: 'Cyaruzinge', rw: 'Cyaruzinge' }, 3: { en: 'Kibenga', rw: 'Kibenga' },
        4: { en: 'Masoro', rw: 'Masoro' }, 5: { en: 'Mukuyu', rw: 'Mukuyu' }, 6: { en: 'Rudashya', rw: 'Rudashya' },
      } },
      12: { name: { en: 'Nduba', rw: 'Nduba' }, cells: {
        1: { en: 'Butare', rw: 'Butare' }, 2: { en: 'Gasanze', rw: 'Gasanze' }, 3: { en: 'Gasura', rw: 'Gasura' },
        4: { en: 'Gatunga', rw: 'Gatunga' }, 5: { en: 'Muremure', rw: 'Muremure' }, 6: { en: 'Sha', rw: 'Sha' },
        7: { en: 'Shango', rw: 'Shango' },
      } },
      13: { name: { en: 'Remera', rw: 'Remera' }, cells: {
        1: { en: 'Nyabisindu', rw: 'Nyabisindu' }, 2: { en: 'Nyarutarama', rw: 'Nyarutarama' },
        3: { en: 'Rukiri I', rw: 'Rukiri I' }, 4: { en: 'Rukiri II', rw: 'Rukiri II' },
      } },
      14: { name: { en: 'Rusororo', rw: 'Rusororo' }, cells: {
        1: { en: 'Bisenga', rw: 'Bisenga' }, 2: { en: 'Gasagara', rw: 'Gasagara' }, 3: { en: 'Kabuga I', rw: 'Kabuga I' },
        4: { en: 'Kabuga II', rw: 'Kabuga II' }, 5: { en: 'Kinyana', rw: 'Kinyana' }, 6: { en: 'Mbandazi', rw: 'Mbandazi' },
        7: { en: 'Nyagahinga', rw: 'Nyagahinga' }, 8: { en: 'Ruhanga', rw: 'Ruhanga' },
      } },
      15: { name: { en: 'Rutunga', rw: 'Rutunga' }, cells: {
        1: { en: 'Gasabo', rw: 'Gasabo' }, 2: { en: 'Indatemwa', rw: 'Indatemwa' }, 3: { en: 'Kabaliza', rw: 'Kabaliza' },
        4: { en: 'Kacyatwa', rw: 'Kacyatwa' }, 5: { en: 'Kibenga', rw: 'Kibenga' }, 6: { en: 'Kigabiro', rw: 'Kigabiro' },
      } },
    },
  },
  2: {
    name: { en: 'Kicukiro', rw: 'Kicukiro' },
    sectors: {
      1: { name: { en: 'Gahanga', rw: 'Gahanga' }, cells: {
        1: { en: 'Gahanga', rw: 'Gahanga' }, 2: { en: 'Kagasa', rw: 'Kagasa' }, 3: { en: 'Karembure', rw: 'Karembure' },
        4: { en: 'Murinja', rw: 'Murinja' }, 5: { en: 'Nunga', rw: 'Nunga' }, 6: { en: 'Rwabutenge', rw: 'Rwabutenge' },
      } },
      2: { name: { en: 'Gatenga', rw: 'Gatenga' }, cells: {
        1: { en: 'Gatenga', rw: 'Gatenga' }, 2: { en: 'Karambo', rw: 'Karambo' }, 3: { en: 'Nyanza', rw: 'Nyanza' },
        4: { en: 'Nyarurama', rw: 'Nyarurama' },
      } },
      3: { name: { en: 'Gikondo', rw: 'Gikondo' }, cells: {
        1: { en: 'Kagunga', rw: 'Kagunga' }, 2: { en: 'Kanserege', rw: 'Kanserege' }, 3: { en: 'Kinunga', rw: 'Kinunga' },
      } },
      4: { name: { en: 'Kagarama', rw: 'Kagarama' }, cells: {
        1: { en: 'Kanserege', rw: 'Kanserege' }, 2: { en: 'Muyange', rw: 'Muyange' }, 3: { en: 'Rukatsa', rw: 'Rukatsa' },
      } },
      5: { name: { en: 'Kanombe', rw: 'Kanombe' }, cells: {
        1: { en: 'Busanza', rw: 'Busanza' }, 2: { en: 'Kabeza', rw: 'Kabeza' }, 3: { en: 'Karama', rw: 'Karama' },
        4: { en: 'Rubirizi', rw: 'Rubirizi' },
      } },
      6: { name: { en: 'Kicukiro', rw: 'Kicukiro' }, cells: {
        1: { en: 'Gasharu', rw: 'Gasharu' }, 2: { en: 'Kagina', rw: 'Kagina' }, 3: { en: 'Kicukiro', rw: 'Kicukiro' },
        4: { en: 'Ngoma', rw: 'Ngoma' },
      } },
      7: { name: { en: 'Kigarama', rw: 'Kigarama' }, cells: {
        1: { en: 'Bwerankori', rw: 'Bwerankori' }, 2: { en: 'Karugira', rw: 'Karugira' }, 3: { en: 'Kigarama', rw: 'Kigarama' },
        4: { en: 'Nyarurama', rw: 'Nyarurama' }, 5: { en: 'Rwampara', rw: 'Rwampara' },
      } },
      8: { name: { en: 'Masaka', rw: 'Masaka' }, cells: {
        1: { en: 'Ayabaraya', rw: 'Ayabaraya' }, 2: { en: 'Cyimo', rw: 'Cyimo' }, 3: { en: 'Gako', rw: 'Gako' },
        4: { en: 'Gitaraga', rw: 'Gitaraga' }, 5: { en: 'Mbabe', rw: 'Mbabe' }, 6: { en: 'Rusheshe', rw: 'Rusheshe' },
      } },
      9: { name: { en: 'Niboye', rw: 'Niboye' }, cells: {
        1: { en: 'Gatare', rw: 'Gatare' }, 2: { en: 'Niboye', rw: 'Niboye' }, 3: { en: 'Nyakabanda', rw: 'Nyakabanda' },
      } },
      10: { name: { en: 'Nyarugunga', rw: 'Nyarugunga' }, cells: {
        1: { en: 'Kamashashi', rw: 'Kamashashi' }, 2: { en: 'Nonko', rw: 'Nonko' }, 3: { en: 'Rwimbogo', rw: 'Rwimbogo' },
      } },
    },
  },
  3: {
    name: { en: 'Nyarugenge', rw: 'Nyarugenge' },
    sectors: {
      1: { name: { en: 'Gitega', rw: 'Gitega' }, cells: {
        1: { en: 'Akabahizi', rw: 'Akabahizi' }, 2: { en: 'Akabeza', rw: 'Akabeza' }, 3: { en: 'Gacyamo', rw: 'Gacyamo' },
        4: { en: 'Kora', rw: 'Kora' }, 5: { en: 'Kigarama', rw: 'Kigarama' }, 6: { en: 'Kinyange', rw: 'Kinyange' },
      } },
      2: { name: { en: 'Kanyinya', rw: 'Kanyinya' }, cells: {
        1: { en: 'Nyamweru', rw: 'Nyamweru' }, 2: { en: 'Nzove', rw: 'Nzove' }, 3: { en: 'Taba', rw: 'Taba' },
      } },
      3: { name: { en: 'Kigali', rw: 'Kigali' }, cells: {
        1: { en: 'Kigali', rw: 'Kigali' }, 2: { en: 'Mwendo', rw: 'Mwendo' }, 3: { en: 'Nyabugogo', rw: 'Nyabugogo' },
        4: { en: 'Ruriba', rw: 'Ruriba' }, 5: { en: 'Rwesero', rw: 'Rwesero' },
      } },
      4: { name: { en: 'Kimisagara', rw: 'Kimisagara' }, cells: {
        1: { en: 'Kamuhoza', rw: 'Kamuhoza' }, 2: { en: 'Katabaro', rw: 'Katabaro' }, 3: { en: 'Kimisagara', rw: 'Kimisagara' },
      } },
      5: { name: { en: 'Mageragere', rw: 'Mageragere' }, cells: {
        1: { en: 'Kankuba', rw: 'Kankuba' }, 2: { en: 'Kavumu', rw: 'Kavumu' }, 3: { en: 'Mataba', rw: 'Mataba' },
        4: { en: 'Ntungamo', rw: 'Ntungamo' }, 5: { en: 'Nyarufunzo', rw: 'Nyarufunzo' }, 6: { en: 'Nyarurenzi', rw: 'Nyarurenzi' },
        7: { en: 'Runzenze', rw: 'Runzenze' },
      } },
      6: { name: { en: 'Muhima', rw: 'Muhima' }, cells: {
        1: { en: 'Amahoro', rw: 'Amahoro' }, 2: { en: 'Kabasengerezi', rw: 'Kabasengerezi' }, 3: { en: 'Kabeza', rw: 'Kabeza' },
        4: { en: 'Nyabugogo', rw: 'Nyabugogo' }, 5: { en: 'Rugenge', rw: 'Rugenge' }, 6: { en: 'Tetero', rw: 'Tetero' },
        7: { en: 'Ubumwe', rw: 'Ubumwe' },
      } },
      7: { name: { en: 'Nyakabanda', rw: 'Nyakabanda' }, cells: {
        1: { en: 'Munanira I', rw: 'Munanira I' }, 2: { en: 'Munanira II', rw: 'Munanira II' },
        3: { en: 'Nyakabanda I', rw: 'Nyakabanda I' }, 4: { en: 'Nyakabanda II', rw: 'Nyakabanda II' },
      } },
      8: { name: { en: 'Nyamirambo', rw: 'Nyamirambo' }, cells: {
        1: { en: 'Cyivugiza', rw: 'Cyivugiza' }, 2: { en: 'Gasharu', rw: 'Gasharu' }, 3: { en: 'Mumena', rw: 'Mumena' },
        4: { en: 'Rugarama', rw: 'Rugarama' },
      } },
      9: { name: { en: 'Nyarugenge', rw: 'Nyarugenge' }, cells: {
        1: { en: 'Agatare', rw: 'Agatare' }, 2: { en: 'Biryogo', rw: 'Biryogo' }, 3: { en: 'Kiyovu', rw: 'Kiyovu' },
        4: { en: 'Rwampara', rw: 'Rwampara' },
      } },
      10: { name: { en: 'Rwezamenyo', rw: 'Rwezamenyo' }, cells: {
        1: { en: 'Kabuguru I', rw: 'Kabuguru I' }, 2: { en: 'Kabuguru II', rw: 'Kabuguru II' },
        3: { en: 'Rwezamenyo I', rw: 'Rwezamenyo I' }, 4: { en: 'Rwezamenyo II', rw: 'Rwezamenyo II' },
      } },
    },
  },
};

function getDistricts() {
  return LOCATIONS;
}

function getSectors(districtCode) {
  const district = LOCATIONS[districtCode];
  return district ? district.sectors : null;
}

function getCells(districtCode, sectorCode) {
  const sectors = getSectors(districtCode);
  const sector = sectors ? sectors[sectorCode] : null;
  return sector ? sector.cells : null;
}

function nameOf(map, code, lang) {
  const entry = map && map[code];
  if (!entry) return null;
  return entry.name ? entry.name[lang] : entry[lang];
}

module.exports = { LOCATIONS, getDistricts, getSectors, getCells, nameOf };
