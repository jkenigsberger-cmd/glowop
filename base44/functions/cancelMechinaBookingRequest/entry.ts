import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "OPERATIONS"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: "לא מחובר" }, { status: 401 });

    const { request_id, cancel_reason } = await req.json();
    if (!request_id) return Response.json({ success: false, error: "חסר מזהה בקשה" });

    // Load InternalUser
    const internalUsers = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
    const internalUser = internalUsers[0];
    const role = internalUser?.role || "";
    const isAdmin = ADMIN_ROLES.includes(role);
    const isMechina = role === "MECHINA_USER";

    if (!isAdmin && !isMechina) {
      return Response.json({ success: false, error: "אין הרשאה" }, { status: 403 });
    }

    // Load request
    let request;
    try {
      request = await base44.asServiceRole.entities.CommonSpaceBookingRequest.get(request_id);
    } catch {
      return Response.json({ success: false, error: "בקשה לא נמצאה" });
    }
    if (!request) return Response.json({ success: false, error: "בקשה לא נמצאה" });

    // Permission checks for MECHINA_USER
    if (isMechina) {
      // Verify assignment
      const assignments = await base44.asServiceRole.entities.MechinaGroupAssignment.filter({
        user_email: user.email,
        group_id: request.mechina_group_id,
        is_active: true,
      });
      if (assignments.length === 0) {
        return Response.json({ success: false, error: "אין הרשאה לביטול בקשה זו" }, { status: 403 });
      }
      if (request.status === "APPROVED") {
        return Response.json({ success: false, error: "בקשה מאושרת ניתן לבטל רק דרך מנהל" });
      }
      if (!["PENDING", "CHANGE_REQUESTED"].includes(request.status)) {
        return Response.json({ success: false, error: "לא ניתן לבטל בקשה בסטטוס זה" });
      }
    }

    // Admin: check allowed statuses
    if (isAdmin && !["PENDING", "CHANGE_REQUESTED", "APPROVED"].includes(request.status)) {
      return Response.json({ success: false, error: "לא ניתן לבטל בקשה בסטטוס זה" });
    }

    const now = new Date().toISOString();
    let cancelledScheduleItemId = null;

    // If APPROVED — cancel linked GroupScheduleItem
    if (request.status === "APPROVED" && request.approved_schedule_item_id) {
      try {
        const scheduleItem = await base44.asServiceRole.entities.GroupScheduleItem.get(request.approved_schedule_item_id);
        if (scheduleItem) {
          const existingNotes = scheduleItem.notes ? scheduleItem.notes + "\n" : "";
          await base44.asServiceRole.entities.GroupScheduleItem.update(request.approved_schedule_item_id, {
            status: "CANCELLED",
            notes: existingNotes + "בוטל דרך בקשת מרחב מכינה",
          });
          cancelledScheduleItemId = request.approved_schedule_item_id;
        }
      } catch (e) {
        // log but continue
        console.error("Failed to cancel GroupScheduleItem:", e.message);
      }
    }

    // Update request
    const updateData = {
      status: "CANCELLED",
      admin_decision_at: now,
    };
    if (isAdmin) {
      updateData.admin_decision_by_user_id = user.id;
      updateData.admin_decision_by_name = user.full_name || user.email;
    }
    if (cancel_reason) {
      updateData.admin_notes = cancel_reason;
    }

    await base44.asServiceRole.entities.CommonSpaceBookingRequest.update(request_id, updateData);

    // Email notification
    const cancelledByAdmin = isAdmin;
    const emailBody = `
<div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #dc2626;">הבקשה להזמנת מרחב בוטלה</h2>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding: 8px; font-weight: bold; width: 40%;">מרחב:</td><td style="padding: 8px;">${request.space_name || ""}</td></tr>
    <tr style="background:#f9fafb;"><td style="padding: 8px; font-weight: bold;">תאריך:</td><td style="padding: 8px;">${request.date || ""}</td></tr>
    <tr><td style="padding: 8px; font-weight: bold;">שעות:</td><td style="padding: 8px;">${request.start_time || ""}–${request.end_time || ""}</td></tr>
    <tr style="background:#f9fafb;"><td style="padding: 8px; font-weight: bold;">פעילות:</td><td style="padding: 8px;">${request.activity_title || ""}</td></tr>
    ${cancel_reason ? `<tr><td style="padding: 8px; font-weight: bold;">סיבת ביטול:</td><td style="padding: 8px;">${cancel_reason}</td></tr>` : ""}
  </table>
  ${cancelledByAdmin ? `<p style="color: #6b7280; font-size: 13px;">הבקשה בוטלה על ידי המערכת / מנהל.</p>` : ""}
  <p style="color: #6b7280; font-size: 13px;">לשאלות ניתן לפנות לצוות הניהול.</p>
</div>`;

    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: request.requested_by_email,
        subject: "הבקשה להזמנת מרחב בוטלה",
        body: emailBody,
      });
    } catch (emailErr) {
      console.warn("Email failed:", emailErr.message);
      return Response.json({
        success: true,
        request_id,
        cancelled_schedule_item_id: cancelledScheduleItemId,
        warning: "הביטול בוצע אך שליחת המייל נכשלה",
      });
    }

    return Response.json({ success: true, request_id, cancelled_schedule_item_id: cancelledScheduleItemId });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});