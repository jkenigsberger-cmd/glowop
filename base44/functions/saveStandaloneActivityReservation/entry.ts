import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { checkActivitySpaceConflict, timeToMinutes } from '../../shared/activitySpaceAvailability.js';
import { STANDALONE_EDIT_ROLES, resolveStandaloneUser, normalizeAssignments, syncStandaloneCalendar, isStandaloneCancelled } from '../../shared/standaloneActivity.js';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const actor = await resolveStandaloneUser(base44, user, STANDALONE_EDIT_ROLES);
    if (!actor) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json();
    const title = String(body.title || '').trim();
    const eventDate = String(body.event_date || '');
    const startTime = String(body.start_time || '');
    const endTime = String(body.end_time || '');
    const expectedPax = Number(body.expected_pax || 0);
    let assignments;
    try { assignments = normalizeAssignments(body.assignments); } catch { return Response.json({ error: 'INVALID_SPACE_ASSIGNMENTS' }, { status: 400 }); }
    if (!title || !eventDate || !startTime || !endTime) return Response.json({ error: 'MISSING_REQUIRED_FIELDS' }, { status: 400 });
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) return Response.json({ error: 'INVALID_TIME_RANGE' }, { status: 400 });
    if (!Number.isFinite(expectedPax) || expectedPax < 0) return Response.json({ error: 'INVALID_EXPECTED_PAX' }, { status: 400 });
    if (assignments.length === 0) return Response.json({ error: 'SPACE_REQUIRED' }, { status: 400 });

    let existing = null;
    if (body.id) {
      try { existing = await base44.asServiceRole.entities.StandaloneActivityReservation.get(body.id); } catch { return Response.json({ error: 'NOT_FOUND' }, { status: 404 }); }
      if (isStandaloneCancelled(existing)) return Response.json({ error: 'ACTIVITY_ALREADY_CANCELLED', calendar_sync_status: 'SUCCESS' }, { status: 409 });
    } else if (body.creation_token) {
      const matches = await base44.asServiceRole.entities.StandaloneActivityReservation.filter({ creation_token: body.creation_token });
      existing = matches[0] || null;
      if (existing) {
        const currentAssignments = await base44.asServiceRole.entities.StandaloneActivitySpaceAssignment.filter({ reservation_id: existing.id });
        return Response.json({ success: true, reservation: existing, assignments: currentAssignments, idempotent: true, calendar_sync_status: 'SUCCESS' });
      }
    }

    for (const assignment of assignments) {
      const conflict = await checkActivitySpaceConflict(base44, { spaceId: assignment.activity_space_id, date: eventDate, startTime, endTime, excludeStandaloneReservationId: existing?.id || null });
      if (conflict) return Response.json(conflict, { status: 409 });
    }

    const payload = {
      title, activity_type: ['WORKSHOP','LECTURE','MEETING','EVENT','OTHER'].includes(body.activity_type) ? body.activity_type : 'OTHER',
      description: String(body.description || '').trim(), event_date: eventDate, start_time: startTime, end_time: endTime,
      expected_pax: expectedPax, organizer_name: String(body.organizer_name || '').trim(), organizer_phone: String(body.organizer_phone || '').trim(), organizer_email: String(body.organizer_email || '').trim(),
      general_notes: String(body.general_notes || '').trim(), preparation_notes: String(body.preparation_notes || '').trim(), during_activity_notes: String(body.during_activity_notes || '').trim(), cleanup_notes: String(body.cleanup_notes || '').trim(),
      status: 'ACTIVE', cancellation_reason: '', cancelled_by: '', cancelled_at: '', updated_by: actor.email,
      ...(existing ? {} : { created_by: actor.email, creation_token: String(body.creation_token || crypto.randomUUID()) }),
    };

    let reservation;
    let createdAssignments = [];
    let oldAssignments = [];
    try {
      if (existing) {
        oldAssignments = await base44.asServiceRole.entities.StandaloneActivitySpaceAssignment.filter({ reservation_id: existing.id });
        reservation = await base44.asServiceRole.entities.StandaloneActivityReservation.update(existing.id, payload);
        await base44.asServiceRole.entities.StandaloneActivitySpaceAssignment.deleteMany({ reservation_id: existing.id });
      } else {
        reservation = await base44.asServiceRole.entities.StandaloneActivityReservation.create(payload);
      }
      createdAssignments = await base44.asServiceRole.entities.StandaloneActivitySpaceAssignment.bulkCreate(assignments.map((item) => ({ ...item, reservation_id: reservation.id })));
    } catch (error) {
      let compensationFailed = false;
      if (existing) {
        const { id, created_date, updated_date, created_by_id, ...oldReservation } = existing;
        try { await base44.asServiceRole.entities.StandaloneActivityReservation.update(existing.id, oldReservation); } catch { compensationFailed = true; }
        try { await base44.asServiceRole.entities.StandaloneActivitySpaceAssignment.deleteMany({ reservation_id: existing.id }); } catch { compensationFailed = true; }
        if (oldAssignments.length) {
          try { await base44.asServiceRole.entities.StandaloneActivitySpaceAssignment.bulkCreate(oldAssignments.map(({ id, created_date, updated_date, created_by_id, ...item }) => item)); } catch { compensationFailed = true; }
        }
      } else if (reservation?.id) {
        try { await base44.asServiceRole.entities.StandaloneActivitySpaceAssignment.deleteMany({ reservation_id: reservation.id }); } catch { compensationFailed = true; }
        try { await base44.asServiceRole.entities.StandaloneActivityReservation.delete(reservation.id); } catch { compensationFailed = true; }
      }
      if (compensationFailed) return Response.json({ error: 'PARTIAL_FAILURE', details: error?.message || 'SAVE_FAILED', calendar_sync_status: 'NOT_CONFIGURED' }, { status: 500 });
      return Response.json({ error: error?.message || 'SAVE_FAILED', calendar_sync_status: 'NOT_CONFIGURED' }, { status: 500 });
    }

    const calendarResult = await syncStandaloneCalendar(base44, reservation, createdAssignments);
    return Response.json({ success: true, reservation, assignments: createdAssignments, ...calendarResult, partial_success: calendarResult.calendar_sync_status !== 'SUCCESS' });
  } catch (error) {
    return Response.json({ error: error.message || 'SAVE_FAILED', calendar_sync_status: 'NOT_CONFIGURED' }, { status: 500 });
  }
}