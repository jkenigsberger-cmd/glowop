import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─────────────────────────────────────────────────────────────────────────────
// Admin-only repair/backfill for Google Calendar sync of legacy GroupScheduleItems.
//
// Problem it solves:
//   Activities created BEFORE the calendar-sync feature have NO CalendarSync record
//   and no Google Calendar event. They only get synced when an admin happens to edit
//   them one-by-one. This function backfills / repairs them in bulk, safely.
//
// For every ACTIVE GroupScheduleItem that has a valid group_id, activity_space_id,
// date, start_time and end_time, it guarantees:
//   • exactly ONE CalendarSync record
//   • exactly ONE live Google Calendar event on KEREN_HADOR calendar
//   • no duplicate events
//
// It is DRY-RUN by default: pass { apply: true } to actually write changes.
// Google Calendar is only a mirror — failures are reported, never fatal.
// ─────────────────────────────────────────────────────────────────────────────

const KEREN_HADOR_CALENDAR_ID = 'c_d90deb3b0f276cded4ab5809199860a2b2e99c8ced3c62dc8432cae3261a5583@group.calendar.google.com';
const MANAGE_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'OPERATIONS']);

async function resolveEffectiveRole(base44, user) {
  try {
    const rows = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
    return rows[0]?.role || user.role;
  } catch {
    return user.role;
  }
}

function buildEventPayload(item, space, group) {
  const spaceName = space.name || space.code;
  const groupName = group.group_name || 'קבוצה';
  const summary = `${item.activity_name} – ${groupName}`;
  const parts = [];
  parts.push(`📌 מרחב: ${spaceName} (${space.code})`);
  if (item.pax) parts.push(`👥 משתתפים: ${item.pax}`);
  if (item.split_total && item.split_index) parts.push(`🔀 פיצול: ${item.split_index}/${item.split_total}`);
  if (item.notes) parts.push(`📝 הערות: ${item.notes}`);
  const logistics = [];
  if (item.needs_projector) logistics.push('מקרן');
  if (item.needs_screen) logistics.push('מסך');
  if (item.needs_microphone) logistics.push('מיקרופון');
  if (item.needs_sound) logistics.push('הגברה');
  if (item.needs_whiteboard) logistics.push('לוח');
  if (item.needs_chair_circle) logistics.push('מעגל כיסאות');
  if (item.chairs_count) logistics.push(`${item.chairs_count} כיסאות`);
  if (item.logistics_other) logistics.push(item.logistics_other);
  if (logistics.length > 0) parts.push(`🔧 לוגיסטיקה: ${logistics.join(', ')}`);
  return {
    summary,
    description: parts.join('\n'),
    start: { dateTime: `${item.date}T${item.start_time}:00+03:00`, timeZone: 'Asia/Jerusalem' },
    end: { dateTime: `${item.date}T${item.end_time}:00+03:00`, timeZone: 'Asia/Jerusalem' },
    location: spaceName,
  };
}

async function googleEventExists(accessToken, calendarId, eventId) {
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.ok) {
      const e = await res.json();
      return e.status !== 'cancelled';
    }
    return false;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let user = null;
    try { user = await base44.auth.me(); } catch { /* unauth */ }
    if (!user) return Response.json({ success: false, error: 'נדרשת התחברות' }, { status: 401 });
    const role = await resolveEffectiveRole(base44, user);
    if (!MANAGE_ROLES.has(role)) {
      return Response.json({ success: false, error: 'אין הרשאה' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const apply = body?.apply === true;      // false = dry-run (report only)
    const limit = Math.min(Number(body?.limit) || 300, 500);
    const groupId = body?.group_id || null;  // optional: repair a single group only

    // Connection (only needed when we touch Google)
    const connection = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const accessToken = connection.accessToken;
    const authHeaders = { Authorization: `Bearer ${accessToken}` };
    const jsonHeaders = { ...authHeaders, 'Content-Type': 'application/json' };

    // Load candidate items
    const query = groupId
      ? { status: 'ACTIVE', group_id: groupId }
      : { status: 'ACTIVE' };
    const items = await base44.asServiceRole.entities.GroupScheduleItem.filter(query, '-created_date', limit);

    const summary = {
      dry_run: !apply,
      scanned: items.length,
      skipped_no_space: 0,
      skipped_invalid: 0,
      already_ok: 0,
      created_event: 0,
      recreated_missing: 0,
      deduped: 0,
      migrated_calendar: 0,
      errors: 0,
    };
    const details = [];

    // small caches to avoid re-fetching the same group/space
    const groupCache = {};
    const spaceCache = {};
    const getGroup = async (gid) => {
      if (gid in groupCache) return groupCache[gid];
      try { groupCache[gid] = await base44.asServiceRole.entities.Group.get(gid); }
      catch { groupCache[gid] = null; }
      return groupCache[gid];
    };
    const getSpace = async (sid) => {
      if (sid in spaceCache) return spaceCache[sid];
      try { spaceCache[sid] = await base44.asServiceRole.entities.ActivitySpace.get(sid); }
      catch { spaceCache[sid] = null; }
      return spaceCache[sid];
    };

    for (const item of items) {
      // Validate
      if (!item.activity_space_id) { summary.skipped_no_space++; continue; }
      if (!item.group_id || !item.date || !item.start_time || !item.end_time) {
        summary.skipped_invalid++;
        details.push({ id: item.id, action: 'skip_invalid' });
        continue;
      }

      const group = await getGroup(item.group_id);
      const space = await getSpace(item.activity_space_id);
      if (!group || !space) {
        summary.skipped_invalid++;
        details.push({ id: item.id, action: 'skip_missing_group_or_space' });
        continue;
      }

      // Existing sync records for this item
      const syncs = await base44.asServiceRole.entities.CalendarSync.filter({ group_schedule_item_id: item.id });

      // ── Dedupe: keep first, delete the rest (and their Google events) ──
      if (syncs.length > 1) {
        summary.deduped += (syncs.length - 1);
        if (apply) {
          for (const dup of syncs.slice(1)) {
            await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(dup.calendar_id || KEREN_HADOR_CALENDAR_ID)}/events/${encodeURIComponent(dup.calendar_event_id)}`,
              { method: 'DELETE', headers: authHeaders }
            ).catch(() => {});
            await base44.asServiceRole.entities.CalendarSync.delete(dup.id).catch(() => {});
          }
        }
      }

      const primary = syncs[0] || null;
      const eventPayload = buildEventPayload(item, space, group);

      // ── No sync record at all → create event + record ──
      if (!primary) {
        summary.created_event++;
        details.push({ id: item.id, action: apply ? 'created' : 'would_create' });
        if (apply) {
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(KEREN_HADOR_CALENDAR_ID)}/events`,
            { method: 'POST', headers: jsonHeaders, body: JSON.stringify(eventPayload) }
          );
          const created = await res.json();
          if (res.ok) {
            await base44.asServiceRole.entities.CalendarSync.create({
              group_schedule_item_id: item.id,
              calendar_event_id: created.id,
              calendar_id: KEREN_HADOR_CALENDAR_ID,
            });
          } else {
            summary.errors++;
          }
        }
        continue;
      }

      const primaryCal = primary.calendar_id || KEREN_HADOR_CALENDAR_ID;

      // ── Sync record points to a different calendar → migrate to KEREN_HADOR ──
      if (primaryCal !== KEREN_HADOR_CALENDAR_ID) {
        summary.migrated_calendar++;
        details.push({ id: item.id, action: apply ? 'migrated' : 'would_migrate', from: primaryCal });
        if (apply) {
          // best-effort delete old, then create fresh on correct calendar
          await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(primaryCal)}/events/${encodeURIComponent(primary.calendar_event_id)}`,
            { method: 'DELETE', headers: authHeaders }
          ).catch(() => {});
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(KEREN_HADOR_CALENDAR_ID)}/events`,
            { method: 'POST', headers: jsonHeaders, body: JSON.stringify(eventPayload) }
          );
          const created = await res.json();
          if (res.ok) {
            await base44.asServiceRole.entities.CalendarSync.update(primary.id, {
              calendar_event_id: created.id,
              calendar_id: KEREN_HADOR_CALENDAR_ID,
            });
          } else {
            summary.errors++;
          }
        }
        continue;
      }

      // ── Sync record exists on correct calendar ──
      // In dry-run we do NOT hit Google (avoids rate limits) — a present record is
      // assumed OK. Only when applying do we verify the event still exists.
      if (!apply) {
        summary.already_ok++;
        continue;
      }
      const exists = await googleEventExists(accessToken, KEREN_HADOR_CALENDAR_ID, primary.calendar_event_id);
      if (exists) {
        summary.already_ok++;
        continue;
      }

      // Google event missing → recreate and repoint record
      summary.recreated_missing++;
      details.push({ id: item.id, action: apply ? 'recreated_missing' : 'would_recreate_missing' });
      if (apply) {
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(KEREN_HADOR_CALENDAR_ID)}/events`,
          { method: 'POST', headers: jsonHeaders, body: JSON.stringify(eventPayload) }
        );
        const created = await res.json();
        if (res.ok) {
          await base44.asServiceRole.entities.CalendarSync.update(primary.id, {
            calendar_event_id: created.id,
            calendar_id: KEREN_HADOR_CALENDAR_ID,
          });
        } else {
          summary.errors++;
        }
      }
    }

    return Response.json({ success: true, summary, details: details.slice(0, 100) });
  } catch (err) {
    return Response.json({ success: false, error: err?.message }, { status: 500 });
  }
});