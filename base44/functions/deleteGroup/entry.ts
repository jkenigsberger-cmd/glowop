import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const emptyDeleted = () => ({
  groups: 0, quotes: 0, quote_options: 0, profiles: 0,
  schedule_items: 0, meals: 0, allocations: 0, holds: 0,
  calendar_sync: 0, other_records: 0,
});

const uniqueById = (rows) => [...new Map(rows.map((row) => [row.id, row])).values()];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  let step = 'authenticate';
  let groupId = null;

  try {
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const internalUsers = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
    const role = internalUsers[0]?.role || user.role;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return Response.json({ success: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    step = 'validate_payload';
    const body = await req.json().catch(() => ({}));
    groupId = body.group_id || null;
    if (!groupId) return Response.json({ success: false, error: 'GROUP_ID_REQUIRED' }, { status: 400 });

    step = 'load_group';
    const groups = await base44.asServiceRole.entities.Group.filter({ id: groupId });
    const group = groups[0];
    if (!group) return Response.json({ success: true, status: 'already_deleted', deleted: emptyDeleted() });
    if (!body.confirmation_name || body.confirmation_name.trim() !== group.group_name.trim()) {
      return Response.json({ success: false, error: 'GROUP_NAME_CONFIRMATION_MISMATCH' }, { status: 400 });
    }

    step = 'preflight';
    const [quotes, profiles] = await Promise.all([
      base44.asServiceRole.entities.Quote.filter({ group_id: groupId }),
      base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id: groupId }),
    ]);
    if (quotes.length > 1) {
      return Response.json({ success: false, error: 'MULTIPLE_QUOTES_FOR_GROUP', quote_ids: quotes.map((row) => row.id) }, { status: 409 });
    }
    if (profiles.length > 1) {
      return Response.json({ success: false, error: 'MULTIPLE_OPERATIONAL_PROFILES_FOR_GROUP', profile_ids: profiles.map((row) => row.id) }, { status: 409 });
    }

    const quoteId = quotes[0]?.id || null;
    const [
      quoteOptions, groupSubmissions, quoteSubmissions, formLinks, scheduleItems,
      meals, allocations, holds, coffeeRequests, prisaRequests,
      neighborhoodReservations, postStayReports, postStayIncidents, reviewAlerts,
      mechinaAssignments, mechinaBookings, maintenanceIssues,
    ] = await Promise.all([
      quoteId ? base44.asServiceRole.entities.QuoteOption.filter({ quote_id: quoteId }) : Promise.resolve([]),
      base44.asServiceRole.entities.GuestFormSubmission.filter({ group_id: groupId }),
      quoteId ? base44.asServiceRole.entities.GuestFormSubmission.filter({ quote_id: quoteId }) : Promise.resolve([]),
      base44.asServiceRole.entities.GroupExternalFormLink.filter({ group_id: groupId }),
      base44.asServiceRole.entities.GroupScheduleItem.filter({ group_id: groupId }),
      base44.asServiceRole.entities.MealReservation.filter({ group_id: groupId }),
      base44.asServiceRole.entities.SleepingAllocation.filter({ group_id: groupId }),
      base44.asServiceRole.entities.OperationalHold.filter({ group_id: groupId }),
      base44.asServiceRole.entities.CoffeeCornerRequest.filter({ group_id: groupId }),
      base44.asServiceRole.entities.PrisaRequest.filter({ group_id: groupId }),
      base44.asServiceRole.entities.NeighborhoodReservation.filter({ group_id: groupId }),
      base44.asServiceRole.entities.PostStayReport.filter({ group_id: groupId }),
      base44.asServiceRole.entities.PostStayIncident.filter({ group_id: groupId }),
      base44.asServiceRole.entities.OperationalReviewAlert.filter({ group_id: groupId }),
      base44.asServiceRole.entities.MechinaGroupAssignment.filter({ group_id: groupId }),
      base44.asServiceRole.entities.CommonSpaceBookingRequest.filter({ mechina_group_id: groupId }),
      base44.asServiceRole.entities.MaintenanceIssue.filter({ related_group_id: groupId }),
    ]);
    const submissions = uniqueById([...groupSubmissions, ...quoteSubmissions]);

    step = 'calendar_cleanup';
    const cleanup = await base44.functions.invoke('cleanupGroupCalendarSync', { group_id: groupId });
    if (!cleanup?.data?.success) {
      return Response.json({ success: false, error: 'CALENDAR_CLEANUP_FAILED', report: cleanup?.data?.report || null }, { status: 502 });
    }
    const calendarSyncDeleted = cleanup.data.report?.calendar_syncs_removed || 0;

    const deleteRows = async (entityName, rows) => {
      if (!rows.length) return;
      await Promise.all(rows.map((row) => base44.asServiceRole.entities[entityName].delete(row.id)));
    };

    step = 'delete_operational_children';
    await Promise.all([
      deleteRows('PostStayIncident', postStayIncidents),
      deleteRows('OperationalReviewAlert', reviewAlerts),
      deleteRows('MechinaGroupAssignment', mechinaAssignments),
      deleteRows('CommonSpaceBookingRequest', mechinaBookings),
      deleteRows('MaintenanceIssue', maintenanceIssues),
      deleteRows('CoffeeCornerRequest', coffeeRequests),
      deleteRows('PrisaRequest', prisaRequests),
      deleteRows('SleepingAllocation', allocations),
      deleteRows('NeighborhoodReservation', neighborhoodReservations),
      deleteRows('MealReservation', meals),
      deleteRows('OperationalHold', holds),
      deleteRows('GroupExternalFormLink', formLinks),
      deleteRows('GuestFormSubmission', submissions),
    ]);

    step = 'delete_schedule_and_reports';
    await Promise.all([
      deleteRows('GroupScheduleItem', scheduleItems),
      deleteRows('PostStayReport', postStayReports),
    ]);

    step = 'delete_profile_and_commercial';
    await deleteRows('OperationalGroupProfile', profiles);
    await deleteRows('QuoteOption', quoteOptions);
    await deleteRows('Quote', quotes);

    step = 'delete_group';
    await base44.asServiceRole.entities.Group.delete(groupId);

    const otherRecords = submissions.length + formLinks.length + coffeeRequests.length +
      prisaRequests.length + neighborhoodReservations.length + postStayReports.length +
      postStayIncidents.length + reviewAlerts.length + mechinaAssignments.length +
      mechinaBookings.length + maintenanceIssues.length;

    return Response.json({
      success: true,
      status: 'deleted',
      deleted: {
        groups: 1,
        quotes: quotes.length,
        quote_options: quoteOptions.length,
        profiles: profiles.length,
        schedule_items: scheduleItems.length,
        meals: meals.length,
        allocations: allocations.length,
        holds: holds.length,
        calendar_sync: calendarSyncDeleted,
        other_records: otherRecords,
      },
    });
  } catch (error) {
    console.error('[deleteGroup]', { step, groupId, error: error?.message });
    return Response.json({ success: false, error: 'DELETE_GROUP_FAILED', step }, { status: 500 });
  }
});