import { base44 } from "@/api/base44Client";
import {
  NEIGHBORHOODS_SEED,
  TENTS_SEED,
  FACILITY_AREAS_SEED,
  FACILITIES_SEED,
  ACTIVITY_SPACES_SEED,
  generateBedsForTents,
} from "./seedData";

// Idempotent upsert: fetch all existing by entity, match by `code`, create missing, update changed.
async function upsertByCode(entity, seedItems, transformFn) {
  const existing = await entity.list();
  const existingByCode = {};
  for (const item of existing) {
    if (item.code) existingByCode[item.code] = item;
  }

  let created = 0;
  let updated = 0;
  const resultMap = {}; // code → id

  for (const seed of seedItems) {
    const data = transformFn ? transformFn(seed) : seed;
    const code = data.code;
    if (existingByCode[code]) {
      // Already exists — update to ensure canonical values
      await entity.update(existingByCode[code].id, data);
      resultMap[code] = existingByCode[code].id;
      updated++;
    } else {
      const created_item = await entity.create(data);
      resultMap[code] = created_item.id;
      created++;
    }
  }

  return { created, updated, total: seedItems.length, resultMap };
}

// Beds use tent_code + bed_number as stable code — upsert similarly
async function upsertBeds(bedsData, tentMap, onProgress) {
  const existing = await base44.entities.Bed.list("-created_date", 500);
  const existingByCode = {};
  for (const b of existing) {
    if (b.code) existingByCode[b.code] = b;
  }

  let created = 0;
  let updated = 0;

  // Process in batches of 20 to avoid timeout
  for (let i = 0; i < bedsData.length; i += 20) {
    const batch = bedsData.slice(i, i + 20);
    for (const b of batch) {
      const tent_id = tentMap[b.tentCode];
      if (!tent_id) continue; // skip if tent wasn't created (shouldn't happen)
      const data = {
        tent_id,
        code: b.code,
        label: b.label,
        bed_type: b.bed_type,
        bunk_position: b.bunk_position ?? null,
        working_status: "WORKING",
        bed_status: "FREE",
      };
      if (existingByCode[b.code]) {
        await base44.entities.Bed.update(existingByCode[b.code].id, data);
        updated++;
      } else {
        await base44.entities.Bed.create(data);
        created++;
      }
    }
    onProgress?.(`מיטות... ${Math.min(i + 20, bedsData.length)}/${bedsData.length}`);
  }

  return { created, updated, total: bedsData.length };
}

export async function seedInventory(onProgress) {
  const report = {
    neighborhoods: { created: 0, updated: 0 },
    tents: { created: 0, updated: 0 },
    beds: { created: 0, updated: 0 },
    facilityAreas: { created: 0, updated: 0 },
    facilities: { created: 0, updated: 0 },
    activitySpaces: { created: 0, updated: 0 },
  };

  // 1. Neighborhoods
  onProgress?.("שכונות...");
  const nRes = await upsertByCode(base44.entities.Neighborhood, NEIGHBORHOODS_SEED);
  report.neighborhoods = nRes;
  const neighborhoodMap = nRes.resultMap;

  // 2. Tents
  onProgress?.("אוהלים...");
  const tRes = await upsertByCode(
    base44.entities.Tent,
    TENTS_SEED,
    (t) => ({
      neighborhood_id: neighborhoodMap[t.neighborhoodCode],
      code: t.code,
      tent_number: t.tent_number,
      sub_label: t.sub_label ?? null,
      tent_type: t.tent_type,
      capacity: t.capacity,
      has_private_bathroom: t.has_private_bathroom,
      has_private_shower: t.has_private_shower,
      is_accessible: t.is_accessible,
      working_status: "WORKING",
    })
  );
  report.tents = tRes;
  const tentMap = tRes.resultMap;

  // 3. Beds
  onProgress?.("מיטות...");
  const bedsData = generateBedsForTents(TENTS_SEED);
  const bRes = await upsertBeds(bedsData, tentMap, onProgress);
  report.beds = bRes;

  // 4. Facility Areas
  onProgress?.("אזורי שירותים...");
  const faRes = await upsertByCode(base44.entities.FacilityArea, FACILITY_AREAS_SEED);
  report.facilityAreas = faRes;
  const areaMap = faRes.resultMap;

  // 5. Facilities
  onProgress?.("מתקנים...");
  const facRes = await upsertByCode(
    base44.entities.Facility,
    FACILITIES_SEED,
    (f) => ({
      facility_area_id: areaMap[f.areaCode],
      code: f.code,
      label: f.label,
      unit_number: f.unit_number,
      facility_type: f.facility_type,
      gender: f.gender,
      is_accessible: f.is_accessible,
      working_status: "WORKING",
    })
  );
  report.facilities = facRes;

  // 6. Activity Spaces
  onProgress?.("מרחבי פעילות...");
  const asRes = await upsertByCode(base44.entities.ActivitySpace, ACTIVITY_SPACES_SEED);
  report.activitySpaces = asRes;

  return report;
}