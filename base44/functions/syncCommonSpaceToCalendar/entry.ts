import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const KEREN_HADOR_CALENDAR_ID = 'c_d90deb3b0f276cded4ab5809199860a2b2e99c8ced3c62dc8432cae3261a5583@group.calendar.google.com';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { event, data } = body;

    if (!data || !event) {
      return Response.json({ ok: false, error: 'Missing event or data' }, { status: 400 });
    }

    const itemId = data.id;
    const status = data.status;
    const activitySpaceId = data.activity_space_id;

    // ── Delete flow: cancelled OR space removed ──
    if (status === 'CANCELLED' || !activitySpaceId) {
      const syncRecords = await base44.asServiceRole.entities.CalendarSync.filter({
        group_schedule_item_id: itemId,
      });

      if (syncRecords.length > 0) {
        const sr = syncRecords[0];

        try {
          const connection = await base44.asServiceRole.connectors.getConnection('googlecalendar');
          const accessToken = connection.accessToken;

          await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(sr.calendar_id || KEREN_HADOR_CALENDAR_ID)}/events/${encodeURIComponent(sr.calendar_event_id)}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );

          await base44.asServiceRole.entities.CalendarSync.delete(sr.id);
        } catch (err) {
          console.error('[syncCommonSpaceToCalendar] Delete error:', err?.message);
        }
      }

      return Response.json({ ok: true, action: 'deleted_event' });
    }

    // ── Need space + group info ──
    const [spaces, groups] = await Promise.all([
      base44.asServiceRole.entities.ActivitySpace.filter({ id: activitySpaceId }),
      base44.asServiceRole.entities.Group.filter({ id: data.group_id }),
    ]);

    const space = spaces[0];
    const group = groups[0];

    if (!space || !group) {
      return Response.json({ ok: false, error: 'Space or Group not found' }, { status: 404 });
    }

    // Build event summary
    const spaceName = space.name || space.code;
    const groupName = group.group_name || 'קבוצה';
    const summary = `${data.activity_name} – ${groupName}`;

    // Build description
    const parts = [];
    parts.push(`📌 מרחב: ${spaceName} (${space.code})`);
    if (data.pax) parts.push(`👥 משתתפים: ${data.pax}`);
    if (data.split_total && data.split_index) {
      parts.push(`🔀 פיצול: ${data.split_index}/${data.split_total}`);
    }
    if (data.notes) parts.push(`📝 הערות: ${data.notes}`);

    // Logistics
    const logistics = [];
    if (data.needs_projector) logistics.push('מקרן');
    if (data.needs_screen) logistics.push('מסך');
    if (data.needs_microphone) logistics.push('מיקרופון');
    if (data.needs_sound) logistics.push('הגברה');
    if (data.needs_whiteboard) logistics.push('לוח');
    if (data.needs_chair_circle) logistics.push('מעגל כיסאות');
    if (data.chairs_count) logistics.push(`${data.chairs_count} כיסאות`);
    if (data.logistics_other) logistics.push(data.logistics_other);
    if (logistics.length > 0) parts.push(`🔧 לוגיסטיקה: ${logistics.join(', ')}`);

    const description = parts.join('\n');

    // Timezone: Asia/Jerusalem
    const dateStr = data.date;
    const startDateTime = `${dateStr}T${data.start_time}:00+03:00`;
    const endDateTime = `${dateStr}T${data.end_time}:00+03:00`;

    const eventPayload = {
      summary,
      description,
      start: { dateTime: startDateTime, timeZone: 'Asia/Jerusalem' },
      end: { dateTime: endDateTime, timeZone: 'Asia/Jerusalem' },
      location: spaceName,
    };

    // ── Check for existing sync record ──
    const syncRecords = await base44.asServiceRole.entities.CalendarSync.filter({
      group_schedule_item_id: itemId,
    });

    const connection = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const accessToken = connection.accessToken;

    if (syncRecords.length > 0) {
      // Update existing event
      const sr = syncRecords[0];
      const calendarId = sr.calendar_id || KEREN_HADOR_CALENDAR_ID;

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(sr.calendar_event_id)}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventPayload),
        }
      );

      const updated = await res.json();
      if (!res.ok) {
        console.error('[syncCommonSpaceToCalendar] Patch error:', updated);
        return Response.json({ ok: false, error: updated?.error?.message || 'Patch failed' }, { status: 500 });
      }

      return Response.json({ ok: true, action: 'updated_event', calendar_event_id: updated.id });
    } else {
      // Create new event
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(KEREN_HADOR_CALENDAR_ID)}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventPayload),
        }
      );

      const created = await res.json();
      if (!res.ok) {
        console.error('[syncCommonSpaceToCalendar] Create error:', created);
        return Response.json({ ok: false, error: created?.error?.message || 'Create failed' }, { status: 500 });
      }

      // Save CalendarSync record
      await base44.asServiceRole.entities.CalendarSync.create({
        group_schedule_item_id: itemId,
        calendar_event_id: created.id,
        calendar_id: KEREN_HADOR_CALENDAR_ID,
      });

      return Response.json({ ok: true, action: 'created_event', calendar_event_id: created.id });
    }

  } catch (err) {
    console.error('[syncCommonSpaceToCalendar] Unexpected error:', err?.message, err?.stack);
    return Response.json({ ok: false, error: err?.message }, { status: 500 });
  }
});