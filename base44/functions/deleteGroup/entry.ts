import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  console.log('[deleteGroup v3] function invoked');
  const base44 = createClientFromRequest(req);
  let group_id = 'unknown';
  let step = 'init';

  try {
    // ── Parse body ────────────────────────────────────────────────────────
    step = 'parse_body';
    const body = await req.json().catch(() => ({}));
    group_id = body.group_id || 'unknown';
    console.log(`[deleteGroup v3] group_id: ${group_id}`);

    if (!body.group_id) {
      return Response.json({ success: false, error: 'group_id required' }, { status: 400 });
    }

    // ── Verify group exists ───────────────────────────────────────────────
    step = 'verify_group';
    const groups = await base44.asServiceRole.entities.Group.filter({ id: group_id });
    if (!groups.length) {
      return Response.json({ success: false, error: 'קבוצה לא נמצאה' }, { status: 404 });
    }
    console.log(`[deleteGroup v3] group found: ${groups[0].group_name}`);

    // ── Clean up Google Calendar events synced for this group ────────────
    // Must run BEFORE deleting GroupScheduleItems, otherwise the synced
    // Google Calendar events become orphans. Fails the whole delete if
    // calendar cleanup fails, so nothing is left half-deleted.
    step = 'calendar_cleanup';
    const cleanupRes = await base44.functions.invoke('cleanupGroupCalendarSync', { group_id });
    console.log('[deleteGroup v3] calendar cleanup report:', JSON.stringify(cleanupRes?.data?.report || {}));

    // ── Fetch all related records in parallel ─────────────────────────────
    step = 'fetch_related';
    const [
      quotes,
      submissions,
      profiles,
      holds,
      allocations,
      scheduleItems,
      mealReservations,
      neighborhoodReservations,
      coffeeRequests,
      prisaRequests,
      postStayReports,
      postStayIncidents,
    ] = await Promise.all([
      base44.asServiceRole.entities.Quote.filter({ group_id }),
      base44.asServiceRole.entities.GuestFormSubmission.filter({ group_id }),
      base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id }),
      base44.asServiceRole.entities.OperationalHold.filter({ group_id }),
      base44.asServiceRole.entities.SleepingAllocation.filter({ group_id }),
      base44.asServiceRole.entities.GroupScheduleItem.filter({ group_id }),
      base44.asServiceRole.entities.MealReservation.filter({ group_id }),
      base44.asServiceRole.entities.NeighborhoodReservation.filter({ group_id }),
      base44.asServiceRole.entities.CoffeeCornerRequest.filter({ group_id }),
      base44.asServiceRole.entities.PrisaRequest.filter({ group_id }),
      base44.asServiceRole.entities.PostStayReport.filter({ group_id }),
      base44.asServiceRole.entities.PostStayIncident.filter({ group_id }),
    ]);
    console.log(`[deleteGroup v3] related: quotes=${quotes.length} submissions=${submissions.length} profiles=${profiles.length} holds=${holds.length} allocations=${allocations.length} schedule=${scheduleItems.length} meals=${mealReservations.length} neighborhoods=${neighborhoodReservations.length}`);

    // ── Delete related records ────────────────────────────────────────────
    step = 'delete_related';
    await Promise.all([
      ...profiles.map(r => base44.asServiceRole.entities.OperationalGroupProfile.delete(r.id)),
      ...holds.map(r => base44.asServiceRole.entities.OperationalHold.delete(r.id)),
      ...allocations.map(r => base44.asServiceRole.entities.SleepingAllocation.delete(r.id)),
      ...scheduleItems.map(r => base44.asServiceRole.entities.GroupScheduleItem.delete(r.id)),
      ...mealReservations.map(r => base44.asServiceRole.entities.MealReservation.delete(r.id)),
      ...neighborhoodReservations.map(r => base44.asServiceRole.entities.NeighborhoodReservation.delete(r.id)),
      ...quotes.map(r => base44.asServiceRole.entities.Quote.delete(r.id)),
      ...submissions.map(r => base44.asServiceRole.entities.GuestFormSubmission.delete(r.id)),
      ...coffeeRequests.map(r => base44.asServiceRole.entities.CoffeeCornerRequest.delete(r.id)),
      ...prisaRequests.map(r => base44.asServiceRole.entities.PrisaRequest.delete(r.id)),
      ...postStayIncidents.map(r => base44.asServiceRole.entities.PostStayIncident.delete(r.id)),
      ...postStayReports.map(r => base44.asServiceRole.entities.PostStayReport.delete(r.id)),
    ]);
    console.log('[deleteGroup v3] related records deleted');

    // ── Delete the group itself ───────────────────────────────────────────
    step = 'delete_group';
    await base44.asServiceRole.entities.Group.delete(group_id);
    console.log('[deleteGroup v3] group deleted successfully');

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
        coffeeRequests: coffeeRequests.length,
        prisaRequests: prisaRequests.length,
        postStayReports: postStayReports.length,
        postStayIncidents: postStayIncidents.length,
      },
    });

  } catch (err) {
    console.error(`[deleteGroup v3] FAILED at step="${step}" group_id="${group_id}"`, err?.message);
    return Response.json({
      success: false,
      error: 'מחיקת הקבוצה נכשלה',
      debug: { step, group_id, message: err?.message || String(err) },
    }, { status: 500 });
  }
});