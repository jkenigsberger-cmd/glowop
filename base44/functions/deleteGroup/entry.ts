import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let group_id = 'unknown';
  let step = 'init';

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    step = 'auth';
    const user = await base44.auth.me();
    if (!user) {
      console.error('[deleteGroup] auth failed — no user');
      return Response.json({ error: 'הפעולה נכשלה. יש להתחבר מחדש.' }, { status: 401 });
    }
    const role = (user.role || '').toLowerCase();
    if (role !== 'admin') {
      console.error('[deleteGroup] auth failed — not admin', role);
      return Response.json({ error: 'אין הרשאה לבצע פעולה זו' }, { status: 403 });
    }
    console.log('[deleteGroup] auth ok', user.email);

    // ── Parse body ────────────────────────────────────────────────────────
    step = 'parse_body';
    const body = await req.json().catch(() => ({}));
    group_id = body.group_id || 'unknown';
    console.log(`[deleteGroup] start group_id: ${group_id}`);
    if (!body.group_id) return Response.json({ error: 'group_id required' }, { status: 400 });

    // ── Verify group exists ───────────────────────────────────────────────
    step = 'verify_group';
    const allGroups = await base44.asServiceRole.entities.Group.list();
    if (!allGroups.some(g => g.id === group_id)) {
      return Response.json({ error: 'Group not found' }, { status: 404 });
    }

    // ── Fetch related records ─────────────────────────────────────────────
    step = 'fetch_related';
    console.log('[deleteGroup] fetch related records start');
    const [
      quotes,
      submissions,
      profiles,
      holds,
      allocations,
      scheduleItems,
      mealReservations,
      neighborhoodReservations,
    ] = await Promise.all([
      base44.asServiceRole.entities.Quote.filter({ group_id }),
      base44.asServiceRole.entities.GuestFormSubmission.filter({ group_id }),
      base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id }),
      base44.asServiceRole.entities.OperationalHold.filter({ group_id }),
      base44.asServiceRole.entities.SleepingAllocation.filter({ group_id }),
      base44.asServiceRole.entities.GroupScheduleItem.filter({ group_id }),
      base44.asServiceRole.entities.MealReservation.filter({ group_id }),
      base44.asServiceRole.entities.NeighborhoodReservation.filter({ group_id }),
    ]);
    console.log(`[deleteGroup] fetch related records done — quotes:${quotes.length} submissions:${submissions.length} profiles:${profiles.length} holds:${holds.length} allocations:${allocations.length} scheduleItems:${scheduleItems.length} meals:${mealReservations.length} neighborhoods:${neighborhoodReservations.length}`);

    // ── Delete sequentially so logs are clear ─────────────────────────────

    step = 'delete_profiles';
    console.log(`[deleteGroup] delete OperationalGroupProfile ${profiles.length}`);
    await Promise.all(profiles.map(r => base44.asServiceRole.entities.OperationalGroupProfile.delete(r.id)));

    step = 'delete_holds';
    console.log(`[deleteGroup] delete OperationalHold ${holds.length}`);
    await Promise.all(holds.map(r => base44.asServiceRole.entities.OperationalHold.delete(r.id)));

    step = 'delete_allocations';
    console.log(`[deleteGroup] delete SleepingAllocation ${allocations.length}`);
    await Promise.all(allocations.map(r => base44.asServiceRole.entities.SleepingAllocation.delete(r.id)));

    step = 'delete_schedule';
    console.log(`[deleteGroup] delete GroupScheduleItem ${scheduleItems.length}`);
    await Promise.all(scheduleItems.map(r => base44.asServiceRole.entities.GroupScheduleItem.delete(r.id)));

    step = 'delete_meals';
    console.log(`[deleteGroup] delete MealReservation ${mealReservations.length}`);
    await Promise.all(mealReservations.map(r => base44.asServiceRole.entities.MealReservation.delete(r.id)));

    step = 'delete_neighborhood_reservations';
    console.log(`[deleteGroup] delete NeighborhoodReservation ${neighborhoodReservations.length}`);
    await Promise.all(neighborhoodReservations.map(r => base44.asServiceRole.entities.NeighborhoodReservation.delete(r.id)));

    step = 'quote_handling';
    console.log(`[deleteGroup] quote handling ${quotes.length}`);
    await Promise.all(quotes.map(r => base44.asServiceRole.entities.Quote.delete(r.id)));

    step = 'guest_form_handling';
    console.log(`[deleteGroup] guest form handling ${submissions.length}`);
    await Promise.all(submissions.map(r => base44.asServiceRole.entities.GuestFormSubmission.delete(r.id)));

    step = 'delete_group';
    console.log(`[deleteGroup] delete Group`);
    await base44.asServiceRole.entities.Group.delete(group_id);

    console.log('[deleteGroup] done');
    return Response.json({
      success: true,
      deleted: {
        quotes: quotes.length,
        submissions: submissions.length,
        profiles: profiles.length,
        holds: holds.length,
        allocations: allocations.length,
        scheduleItems: scheduleItems.length,
        mealReservations: mealReservations.length,
        neighborhoodReservations: neighborhoodReservations.length,
      },
    });

  } catch (err) {
    console.error(`[deleteGroup] FAILED at step="${step}" group_id="${group_id}"`, err?.message);
    return Response.json({
      success: false,
      error: err?.status === 401 ? 'הפעולה נכשלה. יש להתחבר מחדש.' : 'מחיקת הקבוצה נכשלה',
      debug: {
        step,
        group_id,
        message: err?.message || String(err),
        stack: err?.stack || null,
      },
    }, { status: err?.status === 401 ? 401 : 500 });
  }
});