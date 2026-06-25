import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const RECORDS = [
  // ── PART A: Neighborhood bathrooms ──────────────────────────────────────
  // בין שכונה 1 ל-2
  { location_type: "BATHROOM", display_name: "שירותים 33", section: "בין שכונה 1 ל-2", location_number: 33, sort_order: 33 },
  { location_type: "BATHROOM", display_name: "שירותים 34", section: "בין שכונה 1 ל-2", location_number: 34, sort_order: 34 },
  { location_type: "BATHROOM", display_name: "שירותים 35", section: "בין שכונה 1 ל-2", location_number: 35, sort_order: 35 },
  { location_type: "BATHROOM", display_name: "שירותים 36", section: "בין שכונה 1 ל-2", location_number: 36, sort_order: 36 },
  // בין שכונה 3 ל-4
  { location_type: "BATHROOM", display_name: "שירותים 37", section: "בין שכונה 3 ל-4", location_number: 37, sort_order: 37 },
  { location_type: "BATHROOM", display_name: "שירותים 38", section: "בין שכונה 3 ל-4", location_number: 38, sort_order: 38 },
  // בין שכונה 5 ל-6
  { location_type: "BATHROOM", display_name: "שירותים 39", section: "בין שכונה 5 ל-6", location_number: 39, sort_order: 39 },
  { location_type: "BATHROOM", display_name: "שירותים 40", section: "בין שכונה 5 ל-6", location_number: 40, sort_order: 40 },
  { location_type: "BATHROOM", display_name: "שירותים 41", section: "בין שכונה 5 ל-6", location_number: 41, sort_order: 41 },
  { location_type: "BATHROOM", display_name: "שירותים 42", section: "בין שכונה 5 ל-6", location_number: 42, sort_order: 42 },
  // שכונה 7
  { location_type: "BATHROOM", display_name: "שירותים 43", section: "שכונה 7", location_number: 43, sort_order: 43 },
  { location_type: "BATHROOM", display_name: "שירותים 44", section: "שכונה 7", location_number: 44, sort_order: 44 },
  { location_type: "BATHROOM", display_name: "שירותים 45", section: "שכונה 7", location_number: 45, sort_order: 45 },
  { location_type: "BATHROOM", display_name: "שירותים 46", section: "שכונה 7", location_number: 46, sort_order: 46 },

  // ── PART B: Main area — male showers (1–12) ───────────────────────────
  { location_type: "SHOWER",   display_name: "מקלחת גברים 1",  section: "אזור ראשי - גברים", location_number: 1,  sort_order: 1 },
  { location_type: "SHOWER",   display_name: "מקלחת גברים 2",  section: "אזור ראשי - גברים", location_number: 2,  sort_order: 2 },
  { location_type: "SHOWER",   display_name: "מקלחת גברים 3",  section: "אזור ראשי - גברים", location_number: 3,  sort_order: 3 },
  { location_type: "SHOWER",   display_name: "שירותים ומקלחת נגישים 4", section: "אזור ראשי - גברים", location_number: 4, sort_order: 4, notes: "יחידה נגישה משולבת שירותים ומקלחת" },
  { location_type: "SHOWER",   display_name: "מקלחת גברים 5",  section: "אזור ראשי - גברים", location_number: 5,  sort_order: 5 },
  { location_type: "SHOWER",   display_name: "מקלחת גברים 6",  section: "אזור ראשי - גברים", location_number: 6,  sort_order: 6 },
  { location_type: "SHOWER",   display_name: "מקלחת גברים 7",  section: "אזור ראשי - גברים", location_number: 7,  sort_order: 7 },
  { location_type: "SHOWER",   display_name: "מקלחת גברים 8",  section: "אזור ראשי - גברים", location_number: 8,  sort_order: 8 },
  { location_type: "SHOWER",   display_name: "מקלחת גברים 9",  section: "אזור ראשי - גברים", location_number: 9,  sort_order: 9 },
  { location_type: "SHOWER",   display_name: "מקלחת גברים 10", section: "אזור ראשי - גברים", location_number: 10, sort_order: 10 },
  { location_type: "SHOWER",   display_name: "מקלחת גברים 11", section: "אזור ראשי - גברים", location_number: 11, sort_order: 11 },
  { location_type: "SHOWER",   display_name: "מקלחת גברים 12", section: "אזור ראשי - גברים", location_number: 12, sort_order: 12 },

  // ── PART B: Main area — male bathrooms (13–16) ────────────────────────
  { location_type: "BATHROOM", display_name: "שירותים גברים 13", section: "אזור ראשי - גברים", location_number: 13, sort_order: 13 },
  { location_type: "BATHROOM", display_name: "שירותים גברים 14", section: "אזור ראשי - גברים", location_number: 14, sort_order: 14 },
  { location_type: "BATHROOM", display_name: "שירותים גברים 15", section: "אזור ראשי - גברים", location_number: 15, sort_order: 15 },
  { location_type: "BATHROOM", display_name: "שירותים גברים 16", section: "אזור ראשי - גברים", location_number: 16, sort_order: 16 },

  // ── PART B: Main area — female bathrooms (17–21) ──────────────────────
  { location_type: "BATHROOM", display_name: "שירותים נשים 17", section: "אזור ראשי - נשים", location_number: 17, sort_order: 17 },
  { location_type: "BATHROOM", display_name: "שירותים נשים 18", section: "אזור ראשי - נשים", location_number: 18, sort_order: 18 },
  { location_type: "BATHROOM", display_name: "שירותים נשים 19", section: "אזור ראשי - נשים", location_number: 19, sort_order: 19 },
  { location_type: "BATHROOM", display_name: "שירותים נשים 20", section: "אזור ראשי - נשים", location_number: 20, sort_order: 20 },
  { location_type: "BATHROOM", display_name: "שירותים ומקלחת נגישים נשים 21", section: "אזור ראשי - נשים", location_number: 21, sort_order: 21, notes: "יחידה נגישה משולבת שירותים ומקלחת נשים" },

  // ── PART B: Main area — female showers (22–32) ────────────────────────
  { location_type: "SHOWER", display_name: "מקלחת נשים 22", section: "אזור ראשי - נשים", location_number: 22, sort_order: 22 },
  { location_type: "SHOWER", display_name: "מקלחת נשים 23", section: "אזור ראשי - נשים", location_number: 23, sort_order: 23 },
  { location_type: "SHOWER", display_name: "מקלחת נשים 24", section: "אזור ראשי - נשים", location_number: 24, sort_order: 24 },
  { location_type: "SHOWER", display_name: "מקלחת נשים 25", section: "אזור ראשי - נשים", location_number: 25, sort_order: 25 },
  { location_type: "SHOWER", display_name: "מקלחת נשים 26", section: "אזור ראשי - נשים", location_number: 26, sort_order: 26 },
  { location_type: "SHOWER", display_name: "מקלחת נשים 27", section: "אזור ראשי - נשים", location_number: 27, sort_order: 27 },
  { location_type: "SHOWER", display_name: "מקלחת נשים 28", section: "אזור ראשי - נשים", location_number: 28, sort_order: 28 },
  { location_type: "SHOWER", display_name: "מקלחת נשים 29", section: "אזור ראשי - נשים", location_number: 29, sort_order: 29 },
  { location_type: "SHOWER", display_name: "מקלחת נשים 30", section: "אזור ראשי - נשים", location_number: 30, sort_order: 30 },
  { location_type: "SHOWER", display_name: "מקלחת נשים 31", section: "אזור ראשי - נשים", location_number: 31, sort_order: 31 },
  { location_type: "SHOWER", display_name: "מקלחת נשים 32", section: "אזור ראשי - נשים", location_number: 32, sort_order: 32 },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const internalUsers = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
    const internalUser = internalUsers[0];
    if (!internalUser || !['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'].includes(internalUser.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Load existing MANUAL SiteLocations for dedup
    const existing = await base44.asServiceRole.entities.SiteLocation.filter({ source_entity_type: 'MANUAL' }, '-created_date', 500);

    // Build dedup set: "location_type|display_name|section"
    const existingKeys = new Set(
      existing.map(l => `${l.location_type}|${l.display_name}|${l.section}`)
    );

    let created = 0;
    let skipped = 0;

    for (const rec of RECORDS) {
      const key = `${rec.location_type}|${rec.display_name}|${rec.section}`;
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }
      await base44.asServiceRole.entities.SiteLocation.create({
        ...rec,
        source_entity_type: 'MANUAL',
        is_active: true,
      });
      created++;
    }

    // Verify accessible units
    const allAfter = await base44.asServiceRole.entities.SiteLocation.filter({ source_entity_type: 'MANUAL' }, '-created_date', 500);
    const unit4  = allAfter.find(l => l.display_name === "שירותים ומקלחת נגישים 4");
    const unit21 = allAfter.find(l => l.display_name === "שירותים ומקלחת נגישים נשים 21");
    const bathroomsCount = allAfter.filter(l => l.location_type === 'BATHROOM').length;
    const showersCount   = allAfter.filter(l => l.location_type === 'SHOWER').length;

    return Response.json({
      success: true,
      created,
      skipped,
      total_manual_after: allAfter.length,
      bathrooms_total: bathroomsCount,
      showers_total: showersCount,
      accessible_unit_4:  unit4  ? { found: true, notes: unit4.notes }  : { found: false },
      accessible_unit_21: unit21 ? { found: true, notes: unit21.notes } : { found: false },
      summary: `נוצרו ${created} רשומות. דולגו ${skipped} כפילויות.`,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});