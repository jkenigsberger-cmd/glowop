import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const { quote_id, group_id, ...fields } = body;

  if (!quote_id || !group_id) {
    return Response.json({ error: 'quote_id and group_id are required' }, { status: 400 });
  }

  // Validate quote exists and is APPROVED
  const quotes = await base44.asServiceRole.entities.Quote.filter({ id: quote_id });
  const quote = quotes[0];

  if (!quote) {
    return Response.json({ error: 'Quote not found' }, { status: 404 });
  }

  if (String(quote.status || '').toLowerCase() !== 'approved') {
    return Response.json({ error: 'This quote is not open for submission' }, { status: 403 });
  }

  const num = (v) => (v !== undefined && v !== '' ? Number(v) : undefined);
  const now = new Date().toISOString();

  const submission = await base44.asServiceRole.entities.GuestFormSubmission.create({
    quote_id,
    group_id,
    // Contact
    contact_name:            fields.contact_name       || '',
    contact_phone:           fields.contact_phone      || '',
    contact_email:           fields.contact_email      || '',
    client_org:              fields.client_org         || '',
    group_type_label:        fields.group_type_label   || '',
    // Derived totals
    total_pax:               num(fields.total_pax),
    staff_count:             num(fields.staff_count),
    participant_count:       num(fields.participant_count),
    // Students
    boys_count:              num(fields.boys_count),
    girls_count:             num(fields.girls_count),
    // Staff
    staff_men_count:         num(fields.staff_men_count),
    staff_women_count:       num(fields.staff_women_count),
    // Drivers/security
    drivers_men_count:       num(fields.drivers_men_count),
    drivers_women_count:     num(fields.drivers_women_count),
    // Flags
    is_sleeping_group:       !!fields.is_sleeping_group,
    arrival_lunch:           !!fields.arrival_lunch,
    departure_lunch:         !!fields.departure_lunch,
    // Serialized JSON fields
    special_diets:           fields.special_diets            || '',
    meal_plan:               fields.meal_plan                || '',
    tent_distribution_notes: fields.tent_distribution_notes  || '',
    schedule_notes:          fields.schedule_notes           || '',
    general_notes:           fields.general_notes            || '',
    // Metadata
    submitted_at: now,
    source:       'LINK',
    status:       'SUBMITTED',
  });

  return Response.json({ success: true, submission_id: submission.id });
});