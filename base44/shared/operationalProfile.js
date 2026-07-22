export async function ensureExactlyOneOperationalProfile(base44, group, duplicateCode = 'DUPLICATE_OPERATIONAL_PROFILE') {
  const existing = await base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id: group.id });
  if (existing.length > 1) throw Object.assign(new Error(duplicateCode), { code: duplicateCode, profile_ids: existing.map(p => p.id) });
  if (existing.length === 1) return { profile: existing[0], created: false };

  const data = { group_id: group.id, status: 'ACCEPTED' };
  if (group.total_pax != null) data.total_pax = group.total_pax;
  if (group.internal_notes) data.general_notes = group.internal_notes;
  const created = await base44.asServiceRole.entities.OperationalGroupProfile.create(data);
  const verified = await base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id: group.id });
  if (verified.length !== 1) throw Object.assign(new Error(duplicateCode), { code: duplicateCode, profile_ids: verified.map(p => p.id) });
  return { profile: created, created: true };
}