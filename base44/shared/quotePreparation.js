export const OPEN_QUOTE_STATUSES = new Set(['DRAFT', 'SENT']);
export const isQuoteOpen = (quote) => OPEN_QUOTE_STATUSES.has(String(quote?.status || '').toUpperCase());
export const isQuoteApproved = (quote) => String(quote?.status || '').toUpperCase() === 'APPROVED';

const nonEmpty = (value) => value !== undefined && value !== null && value !== '';

export function quoteGroupFields(quote) {
  const total = nonEmpty(quote.estimated_pax) ? Number(quote.estimated_pax) : null;
  const staff = nonEmpty(quote.staff_count) ? Number(quote.staff_count) : null;
  const participants = nonEmpty(quote.participant_count) ? Number(quote.participant_count) : (total != null && staff != null ? Math.max(0, total - staff) : null);
  const singleDay = quote.quote_type === 'day_use' || (quote.arrival_date && (!quote.departure_date || quote.departure_date === quote.arrival_date));
  const values = {
    group_name: quote.client_name || quote.contact_person || quote.quote_number || 'קבוצה בהכנה',
    group_type: singleDay ? 'DAY_USE' : 'LODGING',
    arrival_date: quote.arrival_date,
    departure_date: quote.departure_date || quote.arrival_date,
    arrival_time: quote.arrival_time,
    departure_time: quote.departure_time,
    total_pax: total,
    staff_count: staff,
    participant_count: participants,
    contact_name: quote.contact_person || quote.client_name,
    contact_phone: quote.client_phone,
    contact_email: quote.client_email,
  };
  return Object.fromEntries(Object.entries(values).filter(([, value]) => nonEmpty(value)));
}

export function quoteProfileFields(quote) {
  const groupFields = quoteGroupFields(quote);
  return Object.fromEntries(['total_pax', 'staff_count', 'participant_count'].filter(key => nonEmpty(groupFields[key])).map(key => [key, groupFields[key]]));
}

export async function ensureQuotePreparation(base44, quoteId) {
  const quote = await base44.asServiceRole.entities.Quote.get(quoteId);
  if (!quote) throw Object.assign(new Error('QUOTE_NOT_FOUND'), { code: 'QUOTE_NOT_FOUND' });
  if (!quote.preparation_flow_enabled) throw Object.assign(new Error('NOT_PREPARATION_FLOW'), { code: 'NOT_PREPARATION_FLOW' });

  const warnings = [];
  let group = null;
  let createdGroup = false;
  if (quote.group_id) {
    try { group = await base44.asServiceRole.entities.Group.get(quote.group_id); } catch { group = null; }
    if (!group) throw Object.assign(new Error('QUOTE_GROUP_LINK_BROKEN'), { code: 'QUOTE_GROUP_LINK_BROKEN', group_id: quote.group_id });
  } else {
    group = await base44.asServiceRole.entities.Group.create({
      ...quoteGroupFields(quote), status: 'DRAFT', quote_preparation_flow: true,
    });
    createdGroup = true;
    await base44.asServiceRole.entities.Quote.update(quote.id, { group_id: group.id });
    quote.group_id = group.id;
  }

  if (isQuoteOpen(quote)) {
    group = await base44.asServiceRole.entities.Group.update(group.id, {
      ...quoteGroupFields(quote), quote_preparation_flow: true,
    });
  }

  const profiles = await base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id: group.id });
  if (profiles.length > 1) throw Object.assign(new Error('MULTIPLE_OPERATIONAL_PROFILES'), { code: 'MULTIPLE_OPERATIONAL_PROFILES', profile_ids: profiles.map(p => p.id), group_id: group.id });
  let profile = profiles[0] || null;
  let createdProfile = false;
  if (!profile) {
    profile = await base44.asServiceRole.entities.OperationalGroupProfile.create({
      group_id: group.id, quote_id: quote.id, status: 'ACCEPTED', ...quoteProfileFields(quote),
      is_sleeping_group: group.group_type === 'LODGING',
    });
    createdProfile = true;
  } else {
    const update = isQuoteOpen(quote) ? quoteProfileFields(quote) : {};
    if (!profile.quote_id) update.quote_id = quote.id;
    else if (String(profile.quote_id) !== String(quote.id)) warnings.push('PROFILE_LINKED_TO_DIFFERENT_QUOTE');
    if (Object.keys(update).length) profile = await base44.asServiceRole.entities.OperationalGroupProfile.update(profile.id, update);
  }

  const after = await base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id: group.id });
  if (after.length !== 1) throw Object.assign(new Error('PROFILE_CARDINALITY_ERROR'), { code: 'PROFILE_CARDINALITY_ERROR', profile_ids: after.map(p => p.id) });
  return { quote, group, operationalProfile: after[0], createdGroup, createdProfile, warnings };
}

export function auditLog(action, user, result, beforeStatus, afterStatus) {
  console.log('[quotePreparationFlow]', JSON.stringify({ action, quote_id: result.quote?.id, group_id: result.group?.id, operational_profile_id: result.operationalProfile?.id, before_status: beforeStatus, after_status: afterStatus, created_group: result.createdGroup, created_profile: result.createdProfile, warnings: result.warnings || [], user: user?.email, timestamp: new Date().toISOString() }));
}