import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN", "OPERATIONS"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // A. Auth / permission
    let user = null;
    try { user = await base44.auth.me(); } catch {}
    if (!user) return Response.json({ success: false, error: "לא מחובר" }, { status: 401 });

    const internalUsers = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
    const internalUser = internalUsers[0];
    if (!internalUser || !ADMIN_ROLES.includes(internalUser.role)) {
      return Response.json({ success: false, error: "אין הרשאה לדחות בקשות" }, { status: 403 });
    }

    const body = await req.json();
    const { request_id, admin_notes } = body;
    if (!request_id) return Response.json({ success: false, error: "חסר מזהה בקשה" }, { status: 200 });

    // B. Load request
    let request = null;
    try { request = await base44.asServiceRole.entities.CommonSpaceBookingRequest.get(request_id); } catch {}
    if (!request) return Response.json({ success: false, error: "בקשה לא נמצאה" }, { status: 200 });

    if (request.status === "APPROVED") {
      return Response.json({ success: false, error: "לא ניתן לדחות בקשה שכבר אושרה" }, { status: 200 });
    }
    if (request.status !== "PENDING" && request.status !== "CHANGE_REQUESTED") {
      return Response.json({ success: false, error: "הבקשה אינה במצב הניתן לדחייה" }, { status: 200 });
    }

    // Load space for email
    let space = null;
    try { space = await base44.asServiceRole.entities.ActivitySpace.get(request.space_id); } catch {}

    // C. Update request — no GroupScheduleItem created
    await base44.asServiceRole.entities.CommonSpaceBookingRequest.update(request_id, {
      status: "REJECTED",
      admin_decision_by_user_id: user.id,
      admin_decision_by_name: internalUser.name || user.full_name || "",
      admin_decision_at: new Date().toISOString(),
      admin_notes: admin_notes || "",
    });

    // D+E. Do not touch GroupScheduleItem at all.

    // F. Email requester
    const emailBody = `
<div dir="rtl" style="font-family: Arial, sans-serif; font-size: 15px; color: #222; line-height: 1.7;">
  <p>שלום רב,</p>
  <p>לצערנו, הבקשה להזמנת מרחב <strong>נדחתה</strong>.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 12px 0;" />
  <p>📍 <strong>מרחב:</strong> ${space?.name || request.space_name || "—"}</p>
  <p>📅 <strong>תאריך:</strong> ${request.date}</p>
  <p>⏰ <strong>שעות:</strong> ${request.start_time} – ${request.end_time}</p>
  <p>🎯 <strong>שם הפעילות:</strong> ${request.activity_title}</p>
  ${admin_notes ? `<p>💬 <strong>סיבה / הערת מנהל:</strong> ${admin_notes}</p>` : ""}
  <hr style="border: none; border-top: 1px solid #eee; margin: 12px 0;" />
  <p>לשאלות ניתן לפנות למנהל המערכת.</p>
  <p>בברכה,<br/>מערכת הדור הבא</p>
</div>`.trim();

    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: request.requested_by_email,
        subject: "הבקשה להזמנת מרחב נדחתה",
        body: emailBody,
      });
    } catch (emailErr) {
      console.warn("Email send failed (non-fatal):", emailErr?.message);
    }

    return Response.json({ success: true, request_id });

  } catch (err) {
    console.error("[rejectMechinaBookingRequest]", err?.message, err?.stack);
    return Response.json({ success: false, error: "שגיאה פנימית — נסה שוב" }, { status: 500 });
  }
});