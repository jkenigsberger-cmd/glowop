import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { quote_id, group_id, ...fields } = body;

    if (!quote_id || !group_id) {
      return Response.json({ error: 'quote_id and group_id are required' }, { status: 400 });
    }

    // Validate quote exists and is APPROVED
    let quotes = [];
    try {
      quotes = await base44.asServiceRole.entities.Quote.filter({ id: quote_id });
    } catch {
      return Response.json({ error: 'הטופס לא נמצא — בדקו שהקישור תקין' }, { status: 404 });
    }
    const quote = quotes[0];

    if (!quote) {
      return Response.json({ error: 'הטופס לא נמצא — בדקו שהקישור תקין' }, { status: 404 });
    }

    if (String(quote.status || '').toUpperCase() !== 'APPROVED') {
      return Response.json({ error: 'הצעת המחיר אינה מאושרת — הטופס זמין רק לאחר אישור הצעה' }, { status: 403 });
    }

    // Prevent duplicate submissions
    const existing = await base44.asServiceRole.entities.GuestFormSubmission.filter({ quote_id });
    const locked = existing.find(s => ['SUBMITTED', 'REVIEWED'].includes(s.status));
    if (locked) {
      return Response.json({
        error: 'השאלון כבר נשלח ולא ניתן לערוך אותו. אם יש צורך בשינוי, יש לפנות לצוות בית הדור הבא.'
      }, { status: 409 });
    }

    const num = (v) => (v !== undefined && v !== '' ? Number(v) : undefined);
    const now = new Date().toISOString();

    const submission = await base44.asServiceRole.entities.GuestFormSubmission.create({
      quote_id,
      group_id,
      contact_name:            fields.contact_name       || '',
      contact_phone:           fields.contact_phone      || '',
      contact_email:           fields.contact_email      || '',
      client_org:              fields.client_org         || '',
      group_type_label:        fields.group_type_label   || '',
      total_pax:               num(fields.total_pax),
      staff_count:             num(fields.staff_count),
      participant_count:       num(fields.participant_count),
      boys_count:              num(fields.boys_count),
      girls_count:             num(fields.girls_count),
      staff_men_count:         num(fields.staff_men_count),
      staff_women_count:       num(fields.staff_women_count),
      drivers_men_count:       num(fields.drivers_men_count),
      drivers_women_count:     num(fields.drivers_women_count),
      is_sleeping_group:       !!fields.is_sleeping_group,
      arrival_lunch:           !!fields.arrival_lunch,
      departure_lunch:         !!fields.departure_lunch,
      special_diets:           fields.special_diets            || '',
      meal_plan:               fields.meal_plan                || '',
      tent_distribution_notes: fields.tent_distribution_notes  || '',
      schedule_notes:          fields.schedule_notes           || '',
      general_notes:           fields.general_notes            || '',
      submitted_at: now,
      source:       'LINK',
      status:       'SUBMITTED',
    });

    return Response.json({ success: true, submission_id: submission.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});