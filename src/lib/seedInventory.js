import { base44 } from "@/api/base44Client";
import {
  NEIGHBORHOODS_SEED,
  TENTS_SEED,
  FACILITY_AREAS_SEED,
  FACILITIES_SEED,
  ACTIVITY_SPACES_SEED,
  generateBedsForTents,
} from "./seedData";

export async function seedInventory(onProgress) {
  const report = { neighborhoods: 0, tents: 0, beds: 0, facilityAreas: 0, facilities: 0, activitySpaces: 0 };

  onProgress?.("שכונות...");
  const createdNeighborhoods = await base44.entities.Neighborhood.bulkCreate(NEIGHBORHOODS_SEED);
  report.neighborhoods = createdNeighborhoods.length;

  // Build code→id map
  const neighborhoodMap = {};
  for (const n of createdNeighborhoods) {
    neighborhoodMap[n.code] = n.id;
  }

  onProgress?.("אוהלים...");
  const tentsWithIds = TENTS_SEED.map((t) => ({
    neighborhood_id: neighborhoodMap[t.neighborhoodCode],
    code: t.code,
    tent_number: t.tent_number,
    sub_label: t.sub_label,
    tent_type: t.tent_type,
    capacity: t.capacity,
    has_private_bathroom: t.has_private_bathroom,
    has_private_shower: t.has_private_shower,
    is_accessible: t.is_accessible,
    working_status: t.working_status,
  }));
  const createdTents = await base44.entities.Tent.bulkCreate(tentsWithIds);
  report.tents = createdTents.length;

  // Build tent code→id map
  const tentMap = {};
  for (const t of createdTents) {
    tentMap[t.code] = t.id;
  }

  onProgress?.("מיטות...");
  const bedsData = generateBedsForTents(TENTS_SEED);
  const bedsWithIds = bedsData.map((b) => ({
    tent_id: tentMap[b.tentCode],
    code: b.code,
    label: b.label,
    bed_type: b.bed_type,
    bunk_position: b.bunk_position,
    working_status: b.working_status,
    bed_status: b.bed_status,
  }));

  // Seed beds in batches of 50
  let bedCount = 0;
  for (let i = 0; i < bedsWithIds.length; i += 50) {
    const batch = bedsWithIds.slice(i, i + 50);
    const created = await base44.entities.Bed.bulkCreate(batch);
    bedCount += created.length;
    onProgress?.(`מיטות... ${bedCount}/${bedsWithIds.length}`);
  }
  report.beds = bedCount;

  onProgress?.("אזורי שירותים...");
  const createdAreas = await base44.entities.FacilityArea.bulkCreate(FACILITY_AREAS_SEED);
  report.facilityAreas = createdAreas.length;

  const areaMap = {};
  for (const a of createdAreas) {
    areaMap[a.code] = a.id;
  }

  onProgress?.("מתקנים...");
  const facilitiesWithIds = FACILITIES_SEED.map((f) => ({
    facility_area_id: areaMap[f.areaCode],
    code: f.code,
    label: f.label,
    unit_number: f.unit_number,
    facility_type: f.facility_type,
    gender: f.gender,
    is_accessible: f.is_accessible,
    working_status: "WORKING",
  }));
  const createdFacilities = await base44.entities.Facility.bulkCreate(facilitiesWithIds);
  report.facilities = createdFacilities.length;

  onProgress?.("מרחבי פעילות...");
  const createdSpaces = await base44.entities.ActivitySpace.bulkCreate(ACTIVITY_SPACES_SEED);
  report.activitySpaces = createdSpaces.length;

  return report;
}