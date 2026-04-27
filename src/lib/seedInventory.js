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

  const toCreate = [];
  const toUpdate = [];
  const resultMap = {}; // code → id (populated after operations)

  for (const seed of seedItems) {
    const data = transformFn ? transformFn(seed) : seed;
    const code = data.code;
    if (existingByCode[code]) {
      toUpdate.push({ id: existingByCode[code].id, code, data });
      resultMap[code] = existingByCode[code].id;
    } else {
      toCreate.push({ code, data });
    }
  }

  // Bulk create missing items
  if (toCreate.length > 0) {
    const created = await entity.bulkCreate(toCreate.map((x) => x.data));
    for (let i = 0; i < created.length; i++) {
      resultMap[toCreate[i].code] = created[i].id;
    }
  }

  // Update existing items (in parallel batches of 20)
  for (let i = 0; i < toUpdate.length; i += 20) {
    const batch = toUpdate.slice(i, i + 20);
    await Promise.all(batch.map(({ id, data }) => entity.update(id, data)));
  }

  return { created: toCreate.length, updated: toUpdate.length, total: seedItems.length, resultMap };
}

// Beds use tent_code + bed_number as stable code — upsert with bulkCreate for missing
async function upsertBeds(bedsData, tentMap, onProgress) {
  const existing = await base44.entities.Bed.list("-created_date", 500);
  const existingByCode = {};
  for (const b of existing) {
    if (b.code) existingByCode[b.code] = b;
  }

  const toCreate = [];
  const toUpdate = [];

  for (const b of bedsData) {
    const tent_id = tentMap[b.tentCode];
    if (!tent_id) continue;
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
      toUpdate.push({ id: existingByCode[b.code].id, data });
    } else {
      toCreate.push(data);
    }
  }

  // Bulk create missing beds in batches of 50
  let created = 0;
  for (let i = 0; i < toCreate.length; i += 50) {
    const batch = toCreate.slice(i, i + 50);
    await base44.entities.Bed.bulkCreate(batch);
    created += batch.length;
    onProgress?.(`יוצר מיטות... ${created}/${toCreate.length}`);
  }

  // Bulk update existing beds in batches of 50 (sequential to avoid rate limit)
  let updated = 0;
  for (let i = 0; i < toUpdate.length; i += 50) {
    const batch = toUpdate.slice(i, i + 50);
    await Promise.all(batch.map(({ id, data }) => base44.entities.Bed.update(id, data)));
    updated += batch.length;
    onProgress?.(`מעדכן מיטות... ${updated}/${toUpdate.length}`);
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