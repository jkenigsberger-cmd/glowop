import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Admin notification recipients — reused from sendFormNotification
const ADMIN_EMAILS = ["hospitality@glow-glamping.com", "shelly.fleischman@gmail.com", "vered@keren-hador.com"];

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "OPERATIONS"];

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function timesOverlap(s1, e1, s2, e2) {
  return timeToMinutes(s1) < timeToMinutes(e2) && timeToMinutes(s2) < timeToMinutes(e1);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let user = null;
    try { user = await base44.auth.me(); } catch {}
    if (!user) return Response.json({ success: false, error: "לא מחובר" }, { status: 401 });

    const body = await req.json();
    const {
      mechina_group_id, space_id, date, start_time, end_time,
      activity_title, participants_count,
      needs_projector, needs_screen, needs_microphone, needs_sound,
      needs_whiteboard, needs_chair_circle, chairs_count, logistics_other,
      notes,
    } = body;

    // ── Required field validation ────────────────────────────────────────────
    if (!mechina_group_id) return Response.json({ success: false, error: "חסר מזהה מכינה" }, { status: 200 });
    if (!space_id)         return Response.json({ success: false, error: "חסר מרחב" }, { status: 200 });
    if (!date)             return Response.json({ success: false, error: "חסר תאריך" }, { status: 200 });
    if (!start_time)       return Response.json({ success: false, error: "חסרה שעת התחלה" }, { status: 200 });
    if (!end_time)         return Response.json({ success: false, error: "חסרה שעת סיום" }, { status: 200 });
    if (!activity_title)   return Response.json({ success: false, error: "חסר שם הפעילות" }, { status: 200 });

    if (timeToMinutes(end_time) <= timeToMinutes(start_time)) {
      return Response.json({ success: false, error: "שעת סיום חייבת להיות אחרי שעת התחלה" }, { status: 200 });
    }

    // ── Fetch InternalUser to check role ────────────────────────────────────
    const internalUsers = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
    const internalUser = internalUsers[0];
    const userRole = internalUser?.role || null;
    const isAdmin = ADMIN_ROLES.includes(userRole);

    // ── Verify group assignment if not admin ─────────────────────────────────
    if (!isAdmin) {
      const assignments = await base44.asServiceRole.entities.MechinaGroupAssignment.filter({
        user_email: user.email,
        group_id: mechina_group_id,
        is_active: true,
      });
      if (!assignments || assignments.length === 0) {
        return Response.json({ success: false, error: "אין הרשאה לשלוח בקשה עבור מכינה זו" }, { status: 200 });
      }
    }

    // ── Validate space exists ────────────────────────────────────────────────
    let space = null;
    try {
      space = await base44.asServiceRole.entities.ActivitySpace.get(space_id);
    } catch {}
    if (!space) return Response.json({ success: false, error: "מרחב לא נמצא" }, { status: 200 });

    // ── Blocked spaces for Mechina requests (does not affect admin/general modules) ──
    const MECHINA_BLOCKED_CODES = ["bunker_2", "bunker_3", "bunker_4", "bunker_5", "dining_hall"];
    if (MECHINA_BLOCKED_CODES.includes(space.code)) {
      return Response.json({ success: false, error: "המרחב הזה לא זמין לבקשות מכינה" }, { status: 200 });
    }

    // ── Validate group exists ────────────────────────────────────────────────
    let group = null;
    try {
      group = await base44.asServiceRole.entities.Group.get(mechina_group_id);
    } catch {}
    if (!group) return Response.json({ success: false, error: "מכינה לא נמצאה" }, { status: 200 });

    // ── Only relevant/active groups may submit Mechina requests ─────────────
    const RELEVANT_GROUP_STATUSES = ["CONFIRMED", "PENDING_APPROVAL"];
    if (!RELEVANT_GROUP_STATUSES.includes(group.status)) {
      return Response.json({ success: false, error: "הקבוצה הזו לא זמינה לבקשות מכינה" }, { status: 200 });
    }

    // ── Physical space blocks are the source of truth for temporary closures ──
    const activeBlocks = await base44.asServiceRole.entities.ActivitySpaceBlock.filter({
      activity_space_id: space_id,
      status: "ACTIVE",
    });
    const blocking = activeBlocks.find(block =>
      block.start_date <= date && block.end_date >= date &&
      timesOverlap(start_time, end_time, block.start_time, block.end_time)
    );
    if (blocking) {
      return Response.json({
        success: false,
        error: "המרחב הזה לא זמין בזמן הזה",
        block: { space_name: space.name, reason_type: blocking.reason_type, start_date: blocking.start_date, end_date: blocking.end_date, start_time: blocking.start_time, end_time: blocking.end_time, notes: blocking.reason_notes || "" },
      }, { status: 200 });
    }

    // ── Conflict A: ACTIVE GroupScheduleItem ────────────────────────────────
    const activeBookings = await base44.asServiceRole.entities.GroupScheduleItem.filter({
      activity_space_id: space_id,
      date: date,
      status: "ACTIVE",
    });
    for (const b of activeBookings) {
      if (timesOverlap(start_time, end_time, b.start_time, b.end_time)) {
        return Response.json({ success: false, error: "המרחב תפוס בשעה זו" }, { status: 200 });
      }
    }

    // ── Conflict B: PENDING CommonSpaceBookingRequest ────────────────────────
    const pendingRequests = await base44.asServiceRole.entities.CommonSpaceBookingRequest.filter({
      space_id: space_id,
      date: date,
      status: "PENDING",
    });
    for (const r of pendingRequests) {
      if (timesOverlap(start_time, end_time, r.start_time, r.end_time)) {
        return Response.json({ success: false, error: "כבר קיימת בקשה ממתינה לאישור עבור מרחב זה בשעה זו" }, { status: 200 });
      }
    }

    // ── Save request ─────────────────────────────────────────────────────────
    const newRequest = await base44.asServiceRole.entities.CommonSpaceBookingRequest.create({
      mechina_group_id,
      requested_by_user_id: user.id,
      requested_by_name: internalUser?.name || user.full_name || "",
      requested_by_email: user.email,
      space_id,
      space_name: space.name || "",
      date,
      start_time,
      end_time,
      activity_title,
      participants_count: participants_count || null,
      needs_projector: !!needs_projector,
      needs_screen: !!needs_screen,
      needs_microphone: !!needs_microphone,
      needs_sound: !!needs_sound,
      needs_whiteboard: !!needs_whiteboard,
      needs_chair_circle: !!needs_chair_circle,
      chairs_count: chairs_count || null,
      logistics_other: logistics_other || "",
      notes: notes || "",
      status: "PENDING",
    });

    // ── Email notification ───────────────────────────────────────────────────
    const equipmentLines = [
      needs_projector    ? "מקרן" : null,
      needs_screen       ? "מסך" : null,
      needs_microphone   ? "מיקרופון" : null,
      needs_sound        ? "מערכת סאונד" : null,
      needs_whiteboard   ? "לוח לבן" : null,
      needs_chair_circle ? "עיגול כיסאות" : null,
      chairs_count       ? `כיסאות: ${chairs_count}` : null,
      logistics_other    ? `אחר: ${logistics_other}` : null,
    ].filter(Boolean).join(", ") || "—";

    const emailBody = `
<div dir="rtl" style="font-family: Arial, sans-serif; font-size: 15px; color: #222; line-height: 1.7;">
  <p>שלום רב,</p>
  <p>התקבלה בקשה חדשה להזמנת מרחב מכינה:</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 12px 0;" />
  <p>🏕️ <strong>מכינה:</strong> ${group.group_name}</p>
  <p>👤 <strong>שם הפונה:</strong> ${internalUser?.name || user.full_name || "—"}</p>
  <p>📧 <strong>אימייל:</strong> ${user.email}</p>
  <p>📍 <strong>מרחב:</strong> ${space.name}</p>
  <p>📅 <strong>תאריך:</strong> ${date}</p>
  <p>⏰ <strong>שעות:</strong> ${start_time} – ${end_time}</p>
  <p>🎯 <strong>שם הפעילות:</strong> ${activity_title}</p>
  <p>👥 <strong>מספר משתתפים:</strong> ${participants_count || "—"}</p>
  <p>🔧 <strong>ציוד נדרש:</strong> ${equipmentLines}</p>
  ${notes ? `<p>📝 <strong>הערות:</strong> ${notes}</p>` : ""}
  <hr style="border: none; border-top: 1px solid #eee; margin: 12px 0;" />
  <p>יש לאשר את הבקשה במערכת.</p>
  <p>בברכה,<br/>מערכת הדור הבא</p>
</div>`.trim();

    try {
      for (const email of ADMIN_EMAILS) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject: `בקשה חדשה להזמנת מרחב — מכינה`,
          body: emailBody,
        });
      }
    } catch (emailErr) {
      console.warn("Email send failed (non-fatal):", emailErr?.message);
    }

    return Response.json({ success: true, request_id: newRequest.id });

  } catch (err) {
    console.error("[submitMechinaBookingRequest]", err?.message, err?.stack);
    return Response.json({ success: false, error: "שגיאה פנימית — נסה שוב" }, { status: 500 });
  }
});