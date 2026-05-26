/**
 * getGroupPublicData
 * Returns safe public data for a direct (non-quote) group's GuestForm link.
 * Used when link is /guest-form?group=<group_id>
 * Does NOT require authentication — public endpoint for client use.
 * Does NOT expose internal_notes or admin data.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { group_id } = body;

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

    // Check if there's already a submitted/reviewed form for this group (direct-group path, no quote_id)
    const existingSubs = await base44.asServiceRole.entities.GuestFormSubmission.filter({ group_id });
    const hasSubmitted = existingSubs.some(s => ['SUBMITTED', 'REVIEWED'].includes(s.status) && !s.quote_id);
    if (hasSubmitted) {
      return Response.json({
        error: 'השאלון כבר נשלח ולא ניתן לערוך אותו. אם יש צורך בשינוי, יש לפנות לצוות בית הדור הבא.'
      }, { status: 409 });
    }

    const group_type = group.group_type || 'LODGING';
    const arrival_date = group.arrival_date || '';
    const departure_date = group_type === 'DAY_USE' ? arrival_date : (group.departure_date || '');

    return Response.json({
      // No quote_id — direct group link
      quote_id:          null,
      group_id:          group.id,
      quote_number:      null,
      snapshot:          null,
      group_name:        group.group_name || '',
      group_type,
      arrival_date,
      departure_date,
      total_pax:         group.total_pax         ?? null,
      staff_count:       group.staff_count        ?? null,
      participant_count: group.participant_count   ?? null,
      boys_count:        group.boys_count          ?? null,
      girls_count:       group.girls_count         ?? null,
      contact_name:      group.contact_name        || '',
      contact_phone:     group.contact_phone       || '',
      contact_email:     group.contact_email       || '',
      client_tax_id:     '',   // not stored on Group, never expose
      talks:             [],   // no quotes, no talks
      is_direct_group:   true, // flag for GuestForm UI
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});