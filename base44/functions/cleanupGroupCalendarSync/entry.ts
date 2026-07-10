import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEFAULT_CALENDAR_ID = 'c_d90deb3b0f276cded4ab5809199860a2b2e99c8ced3c62dc8432cae3261a5583@group.calendar.google.com';

// Shared cleanup: for a group (or explicit schedule items), delete all Google Calendar
// events that were created by the app (i.e. have a CalendarSync record) and remove the
// CalendarSync records. Idempotent — already-deleted Google events (404/410) are success.
// Manual Google Calendar events (no CalendarSync) are never touched.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { group_id, schedule_item_ids } = body;

    if (!group_id && !Array.isArray(schedule_item_ids)) {
      return Response.json({ success: false, error: 'group_id or schedule_item_ids required' }, { status: 400 });
    }

    // 1. Resolve schedule items
    let itemIds = [];
    if (group_id) {
      const items = await base44.asServiceRole.entities.GroupScheduleItem.filter({ group_id });
      itemIds = items.map((i) => i.id);
    } else {
      itemIds = schedule_item_ids;
    }

    const report = {
      group_id: group_id || null,
      schedule_items_checked: itemIds.length,
      calendar_syncs_found: 0,
      google_events_deleted: 0,
      google_events_already_gone: 0,
      calendar_syncs_removed: 0,
      errors: [],
    };

    if (itemIds.length === 0) {
      return Response.json({ success: true, report });
    }

    // 2. Find CalendarSync records for these items
    const syncs = [];
    for (const itemId of itemIds) {
      const found = await base44.asServiceRole.entities.CalendarSync.filter({ group_schedule_item_id: itemId });
      syncs.push(...found);
    }
    report.calendar_syncs_found = syncs.length;

    if (syncs.length === 0) {
      return Response.json({ success: true, report });
    }

    // 3. Delete Google Calendar events (only those linked via CalendarSync)
    const connection = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const accessToken = connection.accessToken;

    for (const sr of syncs) {
      if (sr.calendar_event_id) {
        const calendarId = sr.calendar_id || DEFAULT_CALENDAR_ID;
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(sr.calendar_event_id)}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (res.ok || res.status === 404 || res.status === 410) {
          if (res.ok) report.google_events_deleted++;
          else report.google_events_already_gone++;
        } else {
          const errBody = await res.text().catch(() => '');
          report.errors.push({ calendar_event_id: sr.calendar_event_id, status: res.status, error: errBody.slice(0, 300) });
          // Keep the CalendarSync record so a retry can clean it up
          continue;
        }
      }
      // 4. Remove the CalendarSync record
      await base44.asServiceRole.entities.CalendarSync.delete(sr.id);
      report.calendar_syncs_removed++;
    }

    const success = report.errors.length === 0;
    return Response.json({ success, report }, { status: success ? 200 : 500 });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});