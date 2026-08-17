/**
 * getGroupPublicData
 * Returns safe public data for a direct (non-quote) group's GuestForm link.
 * Used when link is /guest-form?group=<group_id>
 * Does NOT require authentication — public endpoint for client use.
 * Does NOT expose internal_notes or admin data.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { getOperationalStayDates, normalizeStayPeriods } from '../../shared/groupStayPeriods.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { group_id, token } = body;

    if (!group_id) {
      return Response.json({ error: 'group_id is required' }, { status: 400 });
    }

    let groups = [];
    try {
      groups = await base44.asServiceRole.entities.Group.filter({ id: group_id });
    } catch {
      return Response.json({ error: 'הקבוצה לא נמצאה — בדקו שהקישור תקין' }, { status: 404 });
    }
    const group = groups[0];

    if (!group) {
      return Response.json({ error: 'הקבוצה לא נמצאה — בדקו שהקישור תקין' }, { status: 404 });
    }

    // Only allow sending form for active groups (not CANCELLED/ARCHIVED)
    if (['CANCELLED', 'ARCHIVED'].includes(group.status)) {
      return Response.json({ error: 'הקישור אינו פעיל עוד — פנו לצוות בית הדור הבא' }, { status: 403 });
    }

    // ── Token validation ─────────────────────────────────────────────────────
    // Check if this group has any token-based links (i.e. new system is in use)
    const allLinks = await base44.asServiceRole.entities.GroupExternalFormLink.filter({ group_id });
    const hasTokenSystem = allLinks.length > 0;

    if (hasTokenSystem) {
      // Token system is in use for this group — require a valid token
      if (!token) {
        return Response.json({ error: 'הקישור אינו בתוקף. נא לבקש קישור חדש.' }, { status: 403 });
      }
      const activeLink = allLinks.find(l => l.token === token && l.status === 'ACTIVE');
      if (!activeLink) {
        return Response.json({ error: 'הקישור אינו בתוקף. נא לבקש קישור חדש.' }, { status: 403 });
      }
      // Check if this specific token was already submitted
      const existingSubs = await base44.asServiceRole.entities.GuestFormSubmission.filter({ group_id });
      const submittedWithThisToken = existingSubs.find(
        s => s.form_link_token === token && ['SUBMITTED', 'REVIEWED'].includes(s.status)
      );
      if (submittedWithThisToken) {
        return Response.json({
          error: 'הקישור כבר שומש לשליחת הטופס. אם יש צורך בשינוי, בקשו קישור חדש מהצוות.'
        }, { status: 409 });
      }
    } else {
      // Legacy path — no token system in use yet for this group
      // Allow access (backward compat), but once admin generates a new token, legacy links stop working
      // No submission check here — submitGuestForm already allows direct-group resubmission
    }

    const group_type = group.group_type || 'LODGING';
    const arrival_date = group.arrival_date || '';
    const departure_date = group_type === 'DAY_USE' ? arrival_date : (group.departure_date || '');

    const activeStayPeriods = group.stay_mode === 'MULTI_PERIOD'
      ? normalizeStayPeriods(await base44.asServiceRole.entities.GroupStayPeriod.filter({ group_id, status: 'ACTIVE' }))
      : [];
    const publicStayPeriods = activeStayPeriods.map(({ start_date, end_date }) => ({ start_date, end_date }));
    const operationalDates = group.stay_mode === 'MULTI_PERIOD'
      ? getOperationalStayDates(activeStayPeriods)
      : [];

    // OperationalGroupProfile is the operational source of truth for participant counts.
    // Expose its pax so the guest form can prefill an editable value (DAY_USE especially).
    let ogp = null;
    try {
      const profiles = await base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id });
      ogp = profiles[0] || null;
    } catch { /* non-fatal — fall back to Group values */ }

    return Response.json({
      // No quote_id — direct group link
      quote_id:          null,
      group_id:          group.id,
      quote_number:      null,
      snapshot:          null,
      group_name:        group.group_name || '',
      group_type,
      stay_mode:         group.stay_mode || 'CONTINUOUS',
      arrival_date,
      departure_date,
      stay_periods:      publicStayPeriods,
      operational_dates: operationalDates,
      total_pax:         ogp?.total_pax         ?? group.total_pax         ?? null,
      staff_count:       ogp?.staff_count       ?? group.staff_count        ?? null,
      participant_count: ogp?.participant_count ?? group.participant_count   ?? null,
      boys_count:        ogp?.boys_count        ?? group.boys_count          ?? null,
      girls_count:       ogp?.girls_count       ?? group.girls_count         ?? null,
      contact_name:      group.contact_name        || '',
      contact_phone:     group.contact_phone       || '',
      contact_email:     group.contact_email       || '',
      client_tax_id:     '',   // not stored on Group, never expose
      talks:             [],   // no quotes, no talks
      is_direct_group:   true, // flag for GuestForm UI
      form_link_token:   token || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});