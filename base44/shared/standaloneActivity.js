export const STANDALONE_EDIT_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS']);
export const STANDALONE_ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);
export const STANDALONE_CALENDAR_ID = 'c_d90deb3b0f276cded4ab5809199860a2b2e99c8ced3c62dc8432cae3261a5583@group.calendar.google.com';

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
  const connection = await base44.asServiceRole.connectors.getConnection('googlecalendar');
  const headers = { Authorization: `Bearer ${connection.accessToken}` };
  if (remove || reservation.status === 'CANCELLED') {
    for (const sync of syncs) {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(sync.calendar_id || STANDALONE_CALENDAR_ID)}/events/${encodeURIComponent(sync.calendar_event_id)}`, { method: 'DELETE', headers }).catch(() => null);
      await base44.asServiceRole.entities.CalendarSync.delete(sync.id);
    }
    return;
  }
  const spaces = [];
  for (const assignment of assignments) {
    try { spaces.push(await base44.asServiceRole.entities.ActivitySpace.get(assignment.activity_space_id)); } catch { /* validated before save */ }
  }
  const names = spaces.map((space) => space.name).filter(Boolean);
  const description = [
    'סוג: פעילות כללית ללא קבוצה',
    names.length ? `מרחבים: ${names.join(', ')}` : '',
    reservation.expected_pax ? `משתתפים: ${reservation.expected_pax}` : '',
    reservation.organizer_name ? `אחראי: ${reservation.organizer_name}` : '',
    equipmentText(assignments) ? `ציוד וסידור: ${equipmentText(assignments)}` : '',
    reservation.preparation_notes ? `הכנה: ${reservation.preparation_notes}` : '',
    reservation.during_activity_notes ? `במהלך: ${reservation.during_activity_notes}` : '',
    reservation.cleanup_notes ? `סיום וניקיון: ${reservation.cleanup_notes}` : '',
    reservation.general_notes || '',
  ].filter(Boolean).join('\n');
  const payload = { summary: reservation.title, description, location: names.join(', '), start: { dateTime: `${reservation.event_date}T${reservation.start_time}:00+03:00`, timeZone: 'Asia/Jerusalem' }, end: { dateTime: `${reservation.event_date}T${reservation.end_time}:00+03:00`, timeZone: 'Asia/Jerusalem' } };
  const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };
  if (syncs[0]) {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(STANDALONE_CALENDAR_ID)}/events/${encodeURIComponent(syncs[0].calendar_event_id)}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(payload) });
    if (response.ok) return;
    if (response.status !== 404 && response.status !== 410) return;
    await base44.asServiceRole.entities.CalendarSync.delete(syncs[0].id);
  }
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(STANDALONE_CALENDAR_ID)}/events`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) });
  if (!response.ok) return;
  const event = await response.json();
  await base44.asServiceRole.entities.CalendarSync.create({ source_type: 'STANDALONE_ACTIVITY', source_id: reservation.id, calendar_event_id: event.id, calendar_id: STANDALONE_CALENDAR_ID });
}