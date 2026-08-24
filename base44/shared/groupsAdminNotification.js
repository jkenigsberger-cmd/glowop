/**
 * Groups-admin operational handoff notification.
 *
 * Sends an email to the designated groups administrator when a quote is
 * FIRST commercially approved (DRAFT/SENT → APPROVED).
 *
 * Recipient is resolved exclusively from InternalUser by exact email match.
 * Email failures are non-fatal — they produce a warning, never a rollback.
 */

const GROUPS_ADMIN_EMAIL = 'vered@keren-hador.com';

/**
 * Resolves the groups-admin recipient from InternalUser.
 * Returns { email, name } or null if missing/inactive.
 */
export async function resolveGroupsAdminRecipient(base44) {
  const users = await base44.asServiceRole.entities.InternalUser.filter({ email: GROUPS_ADMIN_EMAIL });
  const admin = users?.find(u => u.email === GROUPS_ADMIN_EMAIL);
  if (!admin || admin.active === false) return null;
  return { email: admin.email, name: admin.name || admin.email };
}

/**
 * Builds the Hebrew email body for the operational handoff.
 */
function buildGroupsAdminEmailBody({ groupName, arrivalDate, departureDate, totalPax, groupUrl }) {
  const dates = [arrivalDate, departureDate].filter(Boolean).join('–') || '—';
  const cta = groupUrl
    ? `<a href="${groupUrl}" style="display:inline-block;background:#1a56a0;color:#fff;text-decoration:none;padding:10px 24px;border-radius:6px;font-weight:700;font-size:14px;margin-top:12px;">פתחי את הקבוצה</a>`
    : '';
  return `
<div dir="rtl" style="font-family: Arial, sans-serif; font-size: 15px; color: #222; line-height: 1.7;">
  <p>שלום ורד,</p>
  <p>הצעת המחיר עבור <strong>${groupName}</strong> אושרה.</p>
  <p>הקבוצה כבר נוצרה במערכת וממתינה לאישור תפעולי.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
  <p>📅 <strong>תאריכים:</strong> ${dates}</p>
  <p>👥 <strong>מספר משתתפים:</strong> ${totalPax ?? '—'}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
  <p>יש לפתוח את הקבוצה הקיימת, לבדוק את הנתונים ולאשר אותה לתפעול.</p>
  ${cta}
  <br/>
  <p>בברכה,<br/>צוות הניהול של קרן הדר וגלאו גלמפינג</p>
</div>`.trim();
}

/**
 * Sends the groups-admin handoff email.
 *
 * @returns {Promise<{ sent: boolean, warning?: string, recipient?: string }>}
 *   - sent=true on success
 *   - sent=false with warning on resolution failure or send failure
 *
 * Never throws — caller can treat the result as advisory.
 */
export async function sendGroupsAdminApprovalEmail(base44, { group, quote, requestOrigin }) {
  try {
    const recipient = await resolveGroupsAdminRecipient(base44);
    if (!recipient) {
      return { sent: false, warning: 'GROUPS_ADMIN_EMAIL_FAILED', reason: 'RECIPIENT_MISSING_OR_INACTIVE' };
    }

    const groupName = group?.group_name || quote?.group_name || 'קבוצה בהכנה';
    const arrivalDate = quote?.arrival_date || group?.arrival_date || '';
    const departureDate = quote?.departure_date || group?.departure_date || '';
    const totalPax = quote?.estimated_pax ?? group?.total_pax ?? null;
    const groupUrl = requestOrigin && group?.id ? `${requestOrigin}/groups/${group.id}` : null;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: recipient.email,
      subject: `קבוצה חדשה מוכנה לאישור תפעולי – ${groupName}`,
      body: buildGroupsAdminEmailBody({ groupName, arrivalDate, departureDate, totalPax, groupUrl }),
    });

    return { sent: true, recipient: recipient.email };
  } catch (error) {
    console.error('[groupsAdminNotification] send failed', JSON.stringify({ error: error?.message, group_id: group?.id, quote_id: quote?.id }));
    return { sent: false, warning: 'GROUPS_ADMIN_EMAIL_FAILED', reason: error?.message || 'SEND_ERROR' };
  }
}