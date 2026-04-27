import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const { quote_id } = body;

  if (!quote_id) {
    return Response.json({ error: 'quote_id is required' }, { status: 400 });
  }

  const quotes = await base44.asServiceRole.entities.Quote.filter({ id: quote_id });
  const quote = quotes[0];

  if (!quote) {
    return Response.json({ error: 'Quote not found' }, { status: 404 });
  }

  if (String(quote.status || '').toLowerCase() !== 'approved') {
    return Response.json({ error: 'This quote is not available for guest form submission' }, { status: 403 });
  }

  let snapshot = null;
  if (quote.snapshot) {
    try { snapshot = JSON.parse(quote.snapshot); } catch {}
  }

  let group = null;
  if (quote.group_id) {
    const groups = await base44.asServiceRole.entities.Group.filter({ id: quote.group_id });
    group = groups[0] || null;
  }

  const group_name =
    snapshot?.groupName ||
    snapshot?.group_name ||
    quote.client_name ||
    '';

  const group_type = group?.group_type || snapshot?.groupType || '';

  const arrival_date   = quote.arrival_date   || snapshot?.startDate || '';
  const departure_date = group_type === 'DAY_USE'
    ? arrival_date
    : (quote.departure_date || snapshot?.endDate || '');

  return Response.json({
    quote_id:          quote.id,
    group_id:          quote.group_id,
    quote_number:      quote.quote_number || '',
    snapshot,
    group_name,
    group_type,
    arrival_date,
    departure_date,
    total_pax:         snapshot?.totalPax         ?? quote.estimated_pax    ?? null,
    staff_count:       snapshot?.staffTotal        ?? quote.staff_count      ?? null,
    participant_count: snapshot?.studentsTotal     ?? quote.participant_count ?? null,
    boys_count:        quote.boys_count            ?? null,
    girls_count:       quote.girls_count           ?? null,
    contact_name:      snapshot?.clientName  || quote.client_name  || '',
    contact_phone:     snapshot?.clientPhone || quote.client_phone || '',
    contact_email:     snapshot?.clientEmail || quote.client_email || '',
    client_tax_id:     snapshot?.clientTaxId || quote.client_tax_id || '',
  });
});