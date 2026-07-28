import { ACTIVITY_CALENDAR_ID, calendarDateTime } from './activityCalendar.js';

export const STANDALONE_EDIT_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS']);
export const STANDALONE_ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);

export function isStandaloneCancelled(reservation) {
  return reservation?.status === 'CANCELLED';
}

export async function resolveStandaloneUser(base44, user, allowedRoles) {
  const rows = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
  const internalUser = rows.find((row) => row.active !== false);
  if (!internalUser || !allowedRoles.has(internalUser.role)) return null;
  return { email: String(user.email || '').trim().toLowerCase(), role: internalUser.role };
}

export function normalizeAssignments(rows) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const activitySpaceId = String(row.activity_space_id || '').trim();
    if (!activitySpaceId || seen.has(activitySpaceId)) throw new Error('INVALID_SPACE_ASSIGNMENTS');
    seen.add(activitySpaceId);
    return {
      activity_space_id: activitySpaceId,
      needs_projector: !!row.needs_projector,
      needs_screen: !!row.needs_screen,
      needs_microphone: !!row.needs_microphone,
      needs_sound: !!row.needs_sound,
      needs_whiteboard: !!row.needs_whiteboard,
      needs_chair_circle: !!row.needs_chair_circle,
      chairs_count: Math.max(0, Number(row.chairs_count) || 0),
      setup_layout: String(row.setup_layout || '').trim(),
      logistics_other: String(row.logistics_other || '').trim(),
      notes: String(row.notes || '').trim(),
    };
  });
}

function equipmentText(assignments) {
  const labels = [['needs_projector','מקרן'],['needs_screen','מסך'],['needs_microphone','מיקרופון'],['needs_sound','הגברה'],['needs_whiteboard','לוח'],['needs_chair_circle','מעגל כיסאות']];
  return assignments.map((assignment) => {
    const items = labels.filter(([key]) => assignment[key]).map(([, label]) => label);
    if (assignment.chairs_count) items.push(`${assignment.chairs_count} כיסאות`);
    if (assignment.setup_layout) items.push(assignment.setup_layout);
    if (assignment.logistics_other) items.push(assignment.logistics_other);
    return items.join(', ');
  }).filter(Boolean).join(' | ');
}

export async function syncStandaloneCalendar(base44, reservation, assignments, remove = false) {
  const syncs = await base44.asServiceRole.entities.CalendarSync.filter({ source_type: 'STANDALONE_ACTIVITY', source_id: reservation.id });
  if ((remove || reservation.status === 'CANCELLED') && syncs.length === 0) return { calendar_sync_status: 'SUCCESS' };

  let connection;
  try {
    connection = await base44.asServiceRole.connectors.getConnection('googlecalendar');
  } catch (error) {
    console.error('[standalone calendar] connector unavailable:', error?.message);
    return { calendar_sync_status: 'NOT_CONFIGURED', calendar_sync_error: error?.message || 'Calendar connector unavailable' };
  }
  if (!connection?.accessToken) return { calendar_sync_status: 'NOT_CONFIGURED', calendar_sync_error: 'Calendar connector unavailable' };

  const headers = { Authorization: `Bearer ${connection.accessToken}` };
  if (remove || reservation.status === 'CANCELLED') {
    let failed = false;
    let lastError = '';
    for (const sync of syncs) {
      try {
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(sync.calendar_id || ACTIVITY_CALENDAR_ID)}/events/${encodeURIComponent(sync.calendar_event_id)}`, { method: 'DELETE', headers });
        if (response.ok || response.status === 404 || response.status === 410) {
          await base44.asServiceRole.entities.CalendarSync.delete(sync.id);
        } else {
          failed = true;
          lastError = `Google Calendar delete failed (${response.status}): ${await response.text()}`;
          console.error('[standalone calendar]', lastError);
        }
      } catch (error) {
        failed = true;
        lastError = error?.message || 'Google Calendar delete failed';
        console.error('[standalone calendar] delete failed:', lastError);
      }
    }
    return failed ? { calendar_sync_status: 'FAILED', calendar_sync_error: lastError } : { calendar_sync_status: 'SUCCESS' };
  }

  const spaces = [];
  for (const assignment of assignments) {
    try { spaces.push(await base44.asServiceRole.entities.ActivitySpace.get(assignment.activity_space_id)); } catch { /* assignments were validated before persistence */ }
  }
  const names = spaces.map((space) => space.name).filter(Boolean);
  const equipment = equipmentText(assignments);
  const description = [
    'סוג: פעילות כללית ללא קבוצה',
    names.length ? `מרחבים: ${names.join(', ')}` : '',
    reservation.expected_pax ? `משתתפים: ${reservation.expected_pax}` : '',
    reservation.organizer_name ? `אחראי: ${reservation.organizer_name}` : '',
    equipment ? `ציוד וסידור: ${equipment}` : '',
    reservation.preparation_notes ? `הכנה: ${reservation.preparation_notes}` : '',
    reservation.during_activity_notes ? `במהלך: ${reservation.during_activity_notes}` : '',
    reservation.cleanup_notes ? `סיום וניקיון: ${reservation.cleanup_notes}` : '',
    reservation.general_notes || '',
  ].filter(Boolean).join('\n');
  const payload = {
    summary: reservation.title,
    description,
    location: names.join(', '),
    start: calendarDateTime(reservation.event_date, reservation.start_time),
    end: calendarDateTime(reservation.event_date, reservation.end_time),
  };
  const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

  try {
    if (syncs[0]) {
      const sync = syncs[0];
      const calendarId = sync.calendar_id || ACTIVITY_CALENDAR_ID;
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(sync.calendar_event_id)}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(payload) });
      if (response.ok) return { calendar_sync_status: 'SUCCESS' };
      if (response.status !== 404 && response.status !== 410) {
        const errorText = await response.text();
        console.error('[standalone calendar] update failed:', response.status, errorText);
        return { calendar_sync_status: 'FAILED', calendar_sync_error: errorText || `Google Calendar update failed (${response.status})` };
      }
      const recreate = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(ACTIVITY_CALENDAR_ID)}/events`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) });
      if (!recreate.ok) {
        const errorText = await recreate.text();
        console.error('[standalone calendar] recreate failed:', recreate.status, errorText);
        return { calendar_sync_status: 'FAILED', calendar_sync_error: errorText || `Google Calendar recreate failed (${recreate.status})` };
      }
      const recreatedEvent = await recreate.json();
      await base44.asServiceRole.entities.CalendarSync.update(sync.id, { calendar_event_id: recreatedEvent.id, calendar_id: ACTIVITY_CALENDAR_ID });
      return { calendar_sync_status: 'SUCCESS' };
    }

    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(ACTIVITY_CALENDAR_ID)}/events`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[standalone calendar] create failed:', response.status, errorText);
      return { calendar_sync_status: 'FAILED', calendar_sync_error: errorText || `Google Calendar create failed (${response.status})` };
    }
    const event = await response.json();
    await base44.asServiceRole.entities.CalendarSync.create({ source_type: 'STANDALONE_ACTIVITY', source_id: reservation.id, calendar_event_id: event.id, calendar_id: ACTIVITY_CALENDAR_ID });
    return { calendar_sync_status: 'SUCCESS' };
  } catch (error) {
    console.error('[standalone calendar] unexpected failure:', error?.message);
    return { calendar_sync_status: 'FAILED', calendar_sync_error: error?.message || 'Google Calendar sync failed' };
  }
}