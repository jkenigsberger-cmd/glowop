import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const { quote_id } = body;

  if (!quote_id) {
    return Response.json({ error: 'quote_id is required' }, { status: 400 });
  }

  const quotes = await base44.asServiceRole.entities.Quote.list();
  const quote = quotes.find(q => q.id === quote_id);

  if (!quote) {
    return Response.json({ error: 'Quote not found' }, { status: 404 });
  }

  if (quote.status !== 'APPROVED') {
    return Response.json({ error: 'This quote is not available for guest form submission' }, { status: 403 });
  }

  // Return only safe, public-facing fields
  return Response.json({
    quote_id: quote.id,
    group_id: quote.group_id,
    quote_number: quote.quote_number,
    client_name: quote.client_name || '',
    client_phone: quote.client_phone || '',
    client_email: quote.client_email || '',
    arrival_date: quote.arrival_date || '',
    departure_date: quote.departure_date || '',
    estimated_pax: quote.estimated_pax || null,
    staff_count: quote.staff_count || null,
    participant_count: quote.participant_count || null,
  });
});