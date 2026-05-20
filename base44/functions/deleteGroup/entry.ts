import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let group_id = 'unknown';
  let step = 'init';

  try {
    // ── Auth — use asServiceRole to look up current user ─────────────────
    step = 'auth';
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (_authErr) {
      // auth.me() may fail in some deployment contexts — fall through to service role check
      console.warn('[deleteGroup] base44.auth.me() failed, attempting service role fallback');
    }

    // If auth.me() failed, try via asServiceRole
    if (!user) {
      try {
        user = await base44.asServiceRole.auth.me();
      } catch (_e) {
        console.error('[deleteGroup] auth failed — cannot identify user');
      }
    }

    if (!user) {
      return Response.json({
        success: false,
        error: 'הפעולה נכשלה. יש להתחבר מחדש.',
        debug: { step: 'auth', message: 'No user session found' },
      }, { status: 401 });
    }

    const role = (user.role || '').toLowerCase();
    if (role !== 'admin') {
      console.error('[deleteGroup] auth failed — not admin, role=', role);
      return Response.json({
        success: false,
        error: 'אין הרשאה לבצע פעולה זו',
        debug: { step: 'auth', message: `role=${role}` },
      }, { status: 403 });
    }
    console.log('[deleteGroup] auth ok', user.email);

    // ── Parse body ────────────────────────────────────────────────────────
    step = 'parse_body';
    const body = await req.json().catch(() => ({}));
    group_id = body.group_id || 'unknown';
    console.log(`[deleteGroup] start group_id: ${group_id}`);
    if (!body.group_id) {
      return Response.json({ success: false, error: 'group_id required' }, { status: 400 });
    }

    // ── Verify group exists ───────────────────────────────────────────────
    step = 'verify_group';
    const groups = await base44.asServiceRole.entities.Group.filter({ id: group_id });
    if (!groups.length) {
      return Response.json({ success: false, error: 'Group not found' }, { status: 404 });
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
      error: 'מחיקת הקבוצה נכשלה',
      debug: {
        step,
        group_id,
        message: err?.message || String(err),
      },
    }, { status: 500 });
  }
});