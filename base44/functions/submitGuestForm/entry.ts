import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const { quote_id, group_id, ...fields } = body;

  if (!quote_id || !group_id) {
    return Response.json({ error: 'quote_id and group_id are required' }, { status: 400 });
  }

  // Validate quote exists and is APPROVED
  const quotes = await base44.asServiceRole.entities.Quote.list();
  const quote = quotes.find(q => q.id === quote_id);

  if (!quote) {
    return Response.json({ error: 'Quote not found' }, { status: 404 });
  }

  if (quote.status !== 'APPROVED') {
    return Response.json({ error: 'This quote is not open for submission' }, { status: 403 });
  }

  const now = new Date().toISOString();

  const submission = await base44.asServiceRole.entities.GuestFormSubmission.create({
    quote_id,
    group_id,
    contact_name:               fields.contact_name              || '',
    contact_phone:              fields.contact_phone             || '',
    contact_email:              fields.contact_email             || '',
    total_pax:                  fields.total_pax                 ? Number(fields.total_pax)        : undefined,
    staff_count:                fields.staff_count               ? Number(fields.staff_count)      : undefined,
    participant_count:          fields.participant_count         ? Number(fields.participant_count): undefined,
    boys_count:                 fields.boys_count                ? Number(fields.boys_count)       : undefined,
    girls_count:                fields.girls_count               ? Number(fields.girls_count)      : undefined,
    special_diets:              fields.special_diets             || '',
    tent_distribution_notes:    fields.tent_distribution_notes   || '',
    schedule_notes:             fields.schedule_notes            || '',
    general_notes:              fields.general_notes             || '',
    submitted_at:               now,
    source:                     'LINK',
    status:                     'SUBMITTED',
  });

  return Response.json({ success: true, submission_id: submission.id });
});