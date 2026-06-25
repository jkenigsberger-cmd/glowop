import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Admin-only
    const internalUsers = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
    const internalUser = internalUsers[0];
    const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS'];
    if (!internalUser || !adminRoles.includes(internalUser.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const results = { created: 0, skipped: 0, vip_sub_created: 0, spaces_created: 0, spaces_skipped: 0, vip_message: null };

    // ── Load existing SiteLocations for dedup ──────────────────────────────
    const existingLocations = await base44.asServiceRole.entities.SiteLocation.list('-created_date', 1000);
    const existingBySource = {};
    existingLocations.forEach(loc => {
      if (loc.source_entity_id) {
        existingBySource[`${loc.source_entity_type}:${loc.source_entity_id}`] = loc;
      }
    });

    // ── Load neighborhoods for name lookup ────────────────────────────────
    const neighborhoods = await base44.asServiceRole.entities.Neighborhood.list();
    const neighborhoodById = {};
    neighborhoods.forEach(n => { neighborhoodById[n.id] = n; });

    // ── Sync Tents ────────────────────────────────────────────────────────
    const tents = await base44.asServiceRole.entities.Tent.list('-created_date', 500);

    for (const tent of tents) {
      if (tent.working_status === 'CLOSED') continue;

      const deupKey = `TENT:${tent.id}`;
      const neighborhood = neighborhoodById[tent.neighborhood_id];
      const isVip = tent.tent_type === 'VIP' || (neighborhood && neighborhood.is_vip);
      const locationType = isVip ? 'VIP_TENT' : 'NEIGHBORHOOD_TENT';

      const neighborhoodName = neighborhood ? neighborhood.name : null;
      const neighborhoodNum = neighborhood ? (neighborhood.sort_order || null) : null;

      const displayName = isVip
        ? `אוהל VIP ${tent.code}`
        : `אוהל ${tent.code}`;

      const section = isVip
        ? 'VIP'
        : (neighborhoodName || `שכונה ${tent.tent_number?.slice(0, 1) || ''}`);

      if (existingBySource[deupKey]) {
        results.skipped++;
        continue;
      }

      const newLoc = await base44.asServiceRole.entities.SiteLocation.create({
        location_type: locationType,
        source_entity_type: 'TENT',
        source_entity_id: tent.id,
        display_name: displayName,
        section,
        neighborhood_number: neighborhoodNum,
        tent_number: tent.code,
        sort_order: neighborhoodNum ? neighborhoodNum * 100 + parseInt(tent.tent_number || '0', 10) : 0,
        is_active: true,
      });
      results.created++;

      // For VIP tents: create bathroom + shower sub-locations
      if (isVip && tent.has_private_bathroom !== false) {
        const bathroomDedup = `VIP_BATH:${tent.id}`;
        if (!existingBySource[bathroomDedup]) {
          await base44.asServiceRole.entities.SiteLocation.create({
            location_type: 'VIP_BATHROOM',
            source_entity_type: 'MANUAL',
            parent_location_id: newLoc.id,
            display_name: `שירותים - ${displayName}`,
            section: 'VIP',
            tent_number: tent.code,
            sort_order: 1,
            is_active: true,
          });
          results.vip_sub_created++;
        }
      }
      if (isVip && tent.has_private_shower !== false) {
        const showerDedup = `VIP_SHOWER:${tent.id}`;
        if (!existingBySource[showerDedup]) {
          await base44.asServiceRole.entities.SiteLocation.create({
            location_type: 'VIP_SHOWER',
            source_entity_type: 'MANUAL',
            parent_location_id: newLoc.id,
            display_name: `מקלחת - ${displayName}`,
            section: 'VIP',
            tent_number: tent.code,
            sort_order: 2,
            is_active: true,
          });
          results.vip_sub_created++;
        }
      }
    }

    // Check if any VIP were created
    const vipTents = tents.filter(t => {
      const n = neighborhoodById[t.neighborhood_id];
      return t.tent_type === 'VIP' || (n && n.is_vip);
    });
    if (vipTents.length === 0) {
      results.vip_message = 'לא זוהו אוהלי VIP בנתוני האוהלים. יש להוסיף מיקומי VIP ידנית.';
    }

    // ── Sync ActivitySpaces ───────────────────────────────────────────────
    const spaces = await base44.asServiceRole.entities.ActivitySpace.list();
    for (const space of spaces) {
      if (space.working_status === 'CLOSED') continue;
      const deupKey = `ACTIVITY_SPACE:${space.id}`;
      if (existingBySource[deupKey]) {
        results.spaces_skipped++;
        continue;
      }
      await base44.asServiceRole.entities.SiteLocation.create({
        location_type: 'COMMON_SPACE',
        source_entity_type: 'ACTIVITY_SPACE',
        source_entity_id: space.id,
        display_name: space.name,
        section: 'מרחבים משותפים',
        sort_order: 0,
        is_active: true,
      });
      results.spaces_created++;
    }

    return Response.json({
      success: true,
      results,
      summary: `נוצרו ${results.created} מיקומי אוהל, ${results.vip_sub_created} תת-מיקומי VIP, ${results.spaces_created} מרחבים משותפים. דולגו: ${results.skipped + results.spaces_skipped}.`,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});