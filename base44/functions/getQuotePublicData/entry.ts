import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { quote_id } = body;

    if (!quote_id) {
      return Response.json({ error: 'quote_id is required' }, { status: 400 });
    }

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

    let snapshot = null;
    if (quote.snapshot) {
      try { snapshot = JSON.parse(quote.snapshot); } catch {}
    }

    let group = null;
    let ogp = null;
    if (quote.group_id) {
      const groups = await base44.asServiceRole.entities.Group.filter({ id: quote.group_id });
      group = groups[0] || null;
      // OperationalGroupProfile is the operational source of truth for participant counts.
      try {
        const profiles = await base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id: quote.group_id });
        ogp = profiles[0] || null;
      } catch { /* non-fatal — fall back to snapshot/quote values */ }
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

    // Build safe talks array for GuestForm (name + type + stable id only — NO pricing)
    const parseSafe = (field) => { try { return JSON.parse(field || '[]') || []; } catch { return []; } };
    const talks = [];
    parseSafe(quote.lecture_lines).forEach((l, i) => {
      if (l.name) talks.push({ quote_item_id: `lecture__${i}`, name: l.name, type: 'הרצאה' });
    });
    parseSafe(quote.workshop_lines).forEach((l, i) => {
      if (l.name) talks.push({ quote_item_id: `workshop__${i}`, name: l.name, type: 'סדנה' });
    });

    return Response.json({
      quote_id:          quote.id,
      group_id:          quote.group_id,
      quote_number:      quote.quote_number || '',
      snapshot,
      group_name,
      group_type,
      arrival_date,
      departure_date,
      total_pax:         ogp?.total_pax         ?? snapshot?.totalPax         ?? quote.estimated_pax    ?? null,
      staff_count:       ogp?.staff_count       ?? snapshot?.staffTotal        ?? quote.staff_count      ?? null,
      participant_count: ogp?.participant_count ?? snapshot?.studentsTotal     ?? quote.participant_count ?? null,
      boys_count:        quote.boys_count            ?? null,
      girls_count:       quote.girls_count           ?? null,
      contact_name:      snapshot?.clientName  || quote.client_name  || '',
      contact_phone:     snapshot?.clientPhone || quote.client_phone || '',
      contact_email:     snapshot?.clientEmail || quote.client_email || '',
      client_tax_id:     snapshot?.clientTaxId || quote.client_tax_id || '',
      talks,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});