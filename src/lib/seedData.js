// Phase 1 — Physical Inventory Seed Data
// Canonical source of truth for Aharonson Farm / Glow Glamping

export const NEIGHBORHOODS_SEED = [
  { code: "N1", name: "שכונה 1", sort_order: 1, is_vip: false },
  { code: "N2", name: "שכונה 2", sort_order: 2, is_vip: false },
  { code: "N3", name: "שכונה 3", sort_order: 3, is_vip: false },
  { code: "N4", name: "שכונה 4", sort_order: 4, is_vip: false },
  { code: "N5", name: "שכונה 5", sort_order: 5, is_vip: false },
  { code: "N6", name: "שכונה 6", sort_order: 6, is_vip: false },
  { code: "N7", name: "שכונה 7", sort_order: 7, is_vip: false },
  { code: "VIP", name: "VIP", sort_order: 8, is_vip: true },
];

export const FACILITY_AREAS_SEED = [
  { code: "area_dining_male", name: "חדר אוכל - גברים", gender: "MALE", sort_order: 1 },
  { code: "area_dining_female", name: "חדר אוכל - נשים", gender: "FEMALE", sort_order: 2 },
  { code: "area_n1_n2", name: "אזור שכונות 1-2", gender: "UNISEX", sort_order: 3 },
  { code: "area_n3_n4", name: "אזור שכונות 3-4", gender: "UNISEX", sort_order: 4 },
  { code: "area_white_tents", name: "אוהלים לבנים", gender: "UNISEX", sort_order: 5 },
  { code: "area_n4_n7", name: "אזור שכונות 4-7", gender: "UNISEX", sort_order: 6 },
];

export const ACTIVITY_SPACES_SEED = [
  { code: "bunker_1", name: 'ממ"ד 1', space_type: "BUNKER", is_bookable: true, working_status: "WORKING" },
  { code: "bunker_2", name: 'ממ"ד 2', space_type: "BUNKER", is_bookable: true, working_status: "WORKING" },
  { code: "bunker_4", name: 'ממ"ד 4', space_type: "BUNKER", is_bookable: true, working_status: "WORKING" },
  { code: "bunker_5", name: 'ממ"ד 5', space_type: "BUNKER", is_bookable: true, working_status: "WORKING" },
  { code: "bunker_6", name: 'ממ"ד 6', space_type: "BUNKER", is_bookable: true, working_status: "WORKING" },
  { code: "bunker_7", name: 'ממ"ד 7', space_type: "BUNKER", is_bookable: true, working_status: "WORKING" },
  { code: "bunker_8", name: 'ממ"ד 8', space_type: "BUNKER", is_bookable: true, working_status: "WORKING" },
  { code: "ohel_moed", name: "אוהל מועד", space_type: "OHEL_MOED", is_bookable: true, working_status: "WORKING" },
  { code: "dining_hall", name: "חדר אוכל", space_type: "DINING_HALL", is_bookable: true, working_status: "WORKING" },
];

// --- Tent generators ---

function makePairTents(neighborhoodCode, pairNumbers) {
  // e.g. pairNumbers = [11,12,13,14] → produces 11א, 11ב, 12א ...
  const tents = [];
  for (const n of pairNumbers) {
    tents.push({
      neighborhoodCode,
      code: `${n}א`,
      tent_number: String(n),
      sub_label: "א",
      tent_type: "STANDARD",
      capacity: 8,
      has_private_bathroom: false,
      has_private_shower: false,
      is_accessible: false,
      working_status: "WORKING",
    });
    tents.push({
      neighborhoodCode,
      code: `${n}ב`,
      tent_number: String(n),
      sub_label: "ב",
      tent_type: "STANDARD",
      capacity: 8,
      has_private_bathroom: false,
      has_private_shower: false,
      is_accessible: false,
      working_status: "WORKING",
    });
  }
  return tents;
}

function makeSingleTents(neighborhoodCode, numbers, capacity) {
  return numbers.map((n) => ({
    neighborhoodCode,
    code: String(n),
    tent_number: String(n),
    sub_label: null,
    tent_type: "STANDARD",
    capacity,
    has_private_bathroom: false,
    has_private_shower: false,
    is_accessible: false,
    working_status: "WORKING",
  }));
}

export const TENTS_SEED = [
  // N1 — 4 pairs × 2 = 8 tents, 8 beds each
  ...makePairTents("N1", [11, 12, 13, 14]),
  // N2 — 4 pairs × 2 = 8 tents, 8 beds each
  ...makePairTents("N2", [21, 22, 23, 24]),
  // N3 — 4 pairs × 2 = 8 tents, 8 beds each
  ...makePairTents("N3", [31, 32, 33, 34]),
  // N4 — 4 single tents, 8 beds each
  ...makeSingleTents("N4", [41, 42, 43, 44], 8),
  // N5 — 5 single tents, 6 beds each
  ...makeSingleTents("N5", [51, 52, 53, 54, 55], 6),
  // N6 — 4 single tents (60,61,62,63), 6 beds each
  ...makeSingleTents("N6", [60, 61, 62, 63], 6),
  // N7 — 71(8), 72(accessible,3), 73(8), 74(8)
  ...makeSingleTents("N7", [71, 73, 74], 8),
  {
    neighborhoodCode: "N7",
    code: "72",
    tent_number: "72",
    sub_label: null,
    tent_type: "STANDARD",
    capacity: 3,
    has_private_bathroom: false,
    has_private_shower: false,
    is_accessible: true,
    working_status: "WORKING",
  },
  // VIP — tents 80-89, 3 beds each, private bathroom + shower
  ...[80, 81, 82, 83, 84, 85, 86, 87, 88, 89].map((n) => ({
    neighborhoodCode: "VIP",
    code: String(n),
    tent_number: String(n),
    sub_label: null,
    tent_type: "VIP",
    capacity: 3,
    has_private_bathroom: true,
    has_private_shower: true,
    is_accessible: false,
    working_status: "WORKING",
  })),
];

// --- Bed generators ---

function makeBeds(tentCode, count, structure) {
  // structure: array of { label, bed_type, bunk_position }
  return structure.map((s, i) => ({
    tentCode,
    code: `${tentCode}-${i + 1}`,
    label: s.label,
    bed_type: s.bed_type,
    bunk_position: s.bunk_position ?? null,
    working_status: "WORKING",
    bed_status: "FREE",
  }));
}

function bunkBeds8() {
  // 4 bunk pairs → 4 BUNK_TOP + 4 BUNK_BOTTOM = 8 beds
  const beds = [];
  for (let p = 1; p <= 4; p++) {
    beds.push({ label: `מיטה עליונה ${p}`, bed_type: "BUNK_TOP", bunk_position: p });
    beds.push({ label: `מיטה תחתונה ${p}`, bed_type: "BUNK_BOTTOM", bunk_position: p });
  }
  return beds;
}

function n4n7Beds8() {
  // 4 singles + 2 bunk pairs (2 BUNK_TOP + 2 BUNK_BOTTOM) = 8
  return [
    { label: "מיטה 1", bed_type: "SINGLE", bunk_position: null },
    { label: "מיטה 2", bed_type: "SINGLE", bunk_position: null },
    { label: "מיטה 3", bed_type: "SINGLE", bunk_position: null },
    { label: "מיטה 4", bed_type: "SINGLE", bunk_position: null },
    { label: "מיטה עליונה 1", bed_type: "BUNK_TOP", bunk_position: 1 },
    { label: "מיטה תחתונה 1", bed_type: "BUNK_BOTTOM", bunk_position: 1 },
    { label: "מיטה עליונה 2", bed_type: "BUNK_TOP", bunk_position: 2 },
    { label: "מיטה תחתונה 2", bed_type: "BUNK_BOTTOM", bunk_position: 2 },
  ];
}

function singleBeds(count) {
  return Array.from({ length: count }, (_, i) => ({
    label: `מיטה ${i + 1}`,
    bed_type: "SINGLE",
    bunk_position: null,
  }));
}

export function generateBedsForTents(tents) {
  const beds = [];

  for (const tent of tents) {
    const nc = tent.neighborhoodCode;
    const code = tent.code;

    let structure;
    if (nc === "N1" || nc === "N2" || nc === "N3") {
      structure = bunkBeds8();
    } else if (nc === "N4") {
      structure = n4n7Beds8();
    } else if (nc === "N5" || nc === "N6") {
      structure = singleBeds(6);
    } else if (nc === "N7" && code !== "72") {
      structure = n4n7Beds8();
    } else if (code === "72") {
      structure = singleBeds(3);
    } else if (nc === "VIP") {
      structure = singleBeds(3);
    }

    if (structure) {
      beds.push(...makeBeds(code, structure.length, structure));
    }
  }

  return beds;
}

// Facilities seed — 46 units across 6 areas
// Source: Facilities_and_CommonSpaces_Map.md (canonical)
export const FACILITIES_SEED = [
  // area_dining_male: showers 1,2,3,5,6,7,8,9,10,11,12 + toilets 4(♿),13,14,15,16 = 16 units
  { areaCode: "area_dining_male", code: "area_dining_male_s1",  label: "מקלחת 1",   unit_number: 1,  facility_type: "SHOWER", gender: "MALE", is_accessible: false },
  { areaCode: "area_dining_male", code: "area_dining_male_s2",  label: "מקלחת 2",   unit_number: 2,  facility_type: "SHOWER", gender: "MALE", is_accessible: false },
  { areaCode: "area_dining_male", code: "area_dining_male_s3",  label: "מקלחת 3",   unit_number: 3,  facility_type: "SHOWER", gender: "MALE", is_accessible: false },
  { areaCode: "area_dining_male", code: "area_dining_male_t4",  label: "תא 4 ♿",    unit_number: 4,  facility_type: "TOILET", gender: "MALE", is_accessible: true  },
  { areaCode: "area_dining_male", code: "area_dining_male_s5",  label: "מקלחת 5",   unit_number: 5,  facility_type: "SHOWER", gender: "MALE", is_accessible: false },
  { areaCode: "area_dining_male", code: "area_dining_male_s6",  label: "מקלחת 6",   unit_number: 6,  facility_type: "SHOWER", gender: "MALE", is_accessible: false },
  { areaCode: "area_dining_male", code: "area_dining_male_s7",  label: "מקלחת 7",   unit_number: 7,  facility_type: "SHOWER", gender: "MALE", is_accessible: false },
  { areaCode: "area_dining_male", code: "area_dining_male_s8",  label: "מקלחת 8",   unit_number: 8,  facility_type: "SHOWER", gender: "MALE", is_accessible: false },
  { areaCode: "area_dining_male", code: "area_dining_male_s9",  label: "מקלחת 9",   unit_number: 9,  facility_type: "SHOWER", gender: "MALE", is_accessible: false },
  { areaCode: "area_dining_male", code: "area_dining_male_s10", label: "מקלחת 10",  unit_number: 10, facility_type: "SHOWER", gender: "MALE", is_accessible: false },
  { areaCode: "area_dining_male", code: "area_dining_male_s11", label: "מקלחת 11",  unit_number: 11, facility_type: "SHOWER", gender: "MALE", is_accessible: false },
  { areaCode: "area_dining_male", code: "area_dining_male_s12", label: "מקלחת 12",  unit_number: 12, facility_type: "SHOWER", gender: "MALE", is_accessible: false },
  { areaCode: "area_dining_male", code: "area_dining_male_t13", label: "תא 13",      unit_number: 13, facility_type: "TOILET", gender: "MALE", is_accessible: false },
  { areaCode: "area_dining_male", code: "area_dining_male_t14", label: "תא 14",      unit_number: 14, facility_type: "TOILET", gender: "MALE", is_accessible: false },
  { areaCode: "area_dining_male", code: "area_dining_male_t15", label: "תא 15",      unit_number: 15, facility_type: "TOILET", gender: "MALE", is_accessible: false },
  { areaCode: "area_dining_male", code: "area_dining_male_t16", label: "תא 16",      unit_number: 16, facility_type: "TOILET", gender: "MALE", is_accessible: false },

  // area_dining_female: toilets 1-5(♿) + showers 6-16 = 16 units
  { areaCode: "area_dining_female", code: "area_dining_female_t1",  label: "תא 1",      unit_number: 1,  facility_type: "TOILET", gender: "FEMALE", is_accessible: false },
  { areaCode: "area_dining_female", code: "area_dining_female_t2",  label: "תא 2",      unit_number: 2,  facility_type: "TOILET", gender: "FEMALE", is_accessible: false },
  { areaCode: "area_dining_female", code: "area_dining_female_t3",  label: "תא 3",      unit_number: 3,  facility_type: "TOILET", gender: "FEMALE", is_accessible: false },
  { areaCode: "area_dining_female", code: "area_dining_female_t4",  label: "תא 4",      unit_number: 4,  facility_type: "TOILET", gender: "FEMALE", is_accessible: false },
  { areaCode: "area_dining_female", code: "area_dining_female_t5",  label: "תא 5 ♿",   unit_number: 5,  facility_type: "TOILET", gender: "FEMALE", is_accessible: true  },
  { areaCode: "area_dining_female", code: "area_dining_female_s6",  label: "מקלחת 6",  unit_number: 6,  facility_type: "SHOWER", gender: "FEMALE", is_accessible: false },
  { areaCode: "area_dining_female", code: "area_dining_female_s7",  label: "מקלחת 7",  unit_number: 7,  facility_type: "SHOWER", gender: "FEMALE", is_accessible: false },
  { areaCode: "area_dining_female", code: "area_dining_female_s8",  label: "מקלחת 8",  unit_number: 8,  facility_type: "SHOWER", gender: "FEMALE", is_accessible: false },
  { areaCode: "area_dining_female", code: "area_dining_female_s9",  label: "מקלחת 9",  unit_number: 9,  facility_type: "SHOWER", gender: "FEMALE", is_accessible: false },
  { areaCode: "area_dining_female", code: "area_dining_female_s10", label: "מקלחת 10", unit_number: 10, facility_type: "SHOWER", gender: "FEMALE", is_accessible: false },
  { areaCode: "area_dining_female", code: "area_dining_female_s11", label: "מקלחת 11", unit_number: 11, facility_type: "SHOWER", gender: "FEMALE", is_accessible: false },
  { areaCode: "area_dining_female", code: "area_dining_female_s12", label: "מקלחת 12", unit_number: 12, facility_type: "SHOWER", gender: "FEMALE", is_accessible: false },
  { areaCode: "area_dining_female", code: "area_dining_female_s13", label: "מקלחת 13", unit_number: 13, facility_type: "SHOWER", gender: "FEMALE", is_accessible: false },
  { areaCode: "area_dining_female", code: "area_dining_female_s14", label: "מקלחת 14", unit_number: 14, facility_type: "SHOWER", gender: "FEMALE", is_accessible: false },
  { areaCode: "area_dining_female", code: "area_dining_female_s15", label: "מקלחת 15", unit_number: 15, facility_type: "SHOWER", gender: "FEMALE", is_accessible: false },
  { areaCode: "area_dining_female", code: "area_dining_female_s16", label: "מקלחת 16", unit_number: 16, facility_type: "SHOWER", gender: "FEMALE", is_accessible: false },

  // area_n1_n2: 4 unisex toilets only
  { areaCode: "area_n1_n2", code: "area_n1_n2_t1", label: "תא 1", unit_number: 1, facility_type: "TOILET", gender: "UNISEX", is_accessible: false },
  { areaCode: "area_n1_n2", code: "area_n1_n2_t2", label: "תא 2", unit_number: 2, facility_type: "TOILET", gender: "UNISEX", is_accessible: false },
  { areaCode: "area_n1_n2", code: "area_n1_n2_t3", label: "תא 3", unit_number: 3, facility_type: "TOILET", gender: "UNISEX", is_accessible: false },
  { areaCode: "area_n1_n2", code: "area_n1_n2_t4", label: "תא 4", unit_number: 4, facility_type: "TOILET", gender: "UNISEX", is_accessible: false },

  // area_n3_n4: 2 unisex toilets only
  { areaCode: "area_n3_n4", code: "area_n3_n4_t1", label: "תא 1", unit_number: 1, facility_type: "TOILET", gender: "UNISEX", is_accessible: false },
  { areaCode: "area_n3_n4", code: "area_n3_n4_t2", label: "תא 2", unit_number: 2, facility_type: "TOILET", gender: "UNISEX", is_accessible: false },

  // area_white_tents: 4 unisex toilets only
  { areaCode: "area_white_tents", code: "area_white_tents_t1", label: "תא 1", unit_number: 1, facility_type: "TOILET", gender: "UNISEX", is_accessible: false },
  { areaCode: "area_white_tents", code: "area_white_tents_t2", label: "תא 2", unit_number: 2, facility_type: "TOILET", gender: "UNISEX", is_accessible: false },
  { areaCode: "area_white_tents", code: "area_white_tents_t3", label: "תא 3", unit_number: 3, facility_type: "TOILET", gender: "UNISEX", is_accessible: false },
  { areaCode: "area_white_tents", code: "area_white_tents_t4", label: "תא 4", unit_number: 4, facility_type: "TOILET", gender: "UNISEX", is_accessible: false },

  // area_n4_n7: 4 unisex toilets only
  { areaCode: "area_n4_n7", code: "area_n4_n7_t1", label: "תא 1", unit_number: 1, facility_type: "TOILET", gender: "UNISEX", is_accessible: false },
  { areaCode: "area_n4_n7", code: "area_n4_n7_t2", label: "תא 2", unit_number: 2, facility_type: "TOILET", gender: "UNISEX", is_accessible: false },
  { areaCode: "area_n4_n7", code: "area_n4_n7_t3", label: "תא 3", unit_number: 3, facility_type: "TOILET", gender: "UNISEX", is_accessible: false },
  { areaCode: "area_n4_n7", code: "area_n4_n7_t4", label: "תא 4", unit_number: 4, facility_type: "TOILET", gender: "UNISEX", is_accessible: false },
];
// Total: 16 + 16 + 4 + 2 + 4 + 4 = 46 ✅