import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    const internal = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
    if ((internal[0]?.role || user.role) !== 'SUPER_ADMIN') return Response.json({ success: false, error: 'FORBIDDEN' }, { status: 403 });
    const { dry_run = true } = await req.json();
    if (dry_run !== true) return Response.json({ success: false, error: 'WRITE_MODE_DISABLED_IN_THIS_RELEASE' }, { status: 400 });
    const [quotes, groups, profiles] = await Promise.all([
      base44.asServiceRole.entities.Quote.list('-created_date', 1000),
      base44.asServiceRole.entities.Group.list('-created_date', 1000),
      base44.asServiceRole.entities.OperationalGroupProfile.list('-created_date', 1000),
    ]);
    const groupById = Object.fromEntries(groups.map(g => [g.id, g]));
    const profilesByGroup = {}; profiles.forEach(p => (profilesByGroup[p.group_id] ||= []).push(p));
    const quotesByGroup = {}; quotes.forEach(q => q.group_id && (quotesByGroup[q.group_id] ||= []).push(q));
    const open = q => ['DRAFT', 'SENT'].includes(q.status);
    const report = {
      correct_open: quotes.filter(q => open(q) && q.group_id && groupById[q.group_id]?.status === 'DRAFT' && profilesByGroup[q.group_id]?.length === 1).map(q => q.id),
      open_without_group: quotes.filter(q => open(q) && !q.group_id).map(q => q.id),
      open_without_profile: quotes.filter(q => open(q) && q.group_id && groupById[q.group_id] && !profilesByGroup[q.group_id]?.length).map(q => ({ quote_id: q.id, group_id: q.group_id })),
      groups_with_multiple_profiles: Object.entries(profilesByGroup).filter(([, rows]) => rows.length > 1).map(([group_id, rows]) => ({ group_id, profile_ids: rows.map(r => r.id) })),
      groups_with_multiple_quotes: Object.entries(quotesByGroup).filter(([, rows]) => rows.length > 1).map(([group_id, rows]) => ({ group_id, quote_ids: rows.map(r => r.id) })),
      broken_links: quotes.filter(q => q.group_id && !groupById[q.group_id]).map(q => ({ quote_id: q.id, group_id: q.group_id })),
      approved_inconsistent: quotes.filter(q => q.status === 'APPROVED' && groupById[q.group_id]?.status !== 'CONFIRMED').map(q => ({ quote_id: q.id, group_id: q.group_id, group_status: groupById[q.group_id]?.status })),
      open_with_confirmed_group: quotes.filter(q => open(q) && groupById[q.group_id]?.status === 'CONFIRMED').map(q => ({ quote_id: q.id, group_id: q.group_id })),
      rejected_inconsistent: quotes.filter(q => ['REJECTED', 'EXPIRED'].includes(q.status) && groupById[q.group_id]?.status === 'CONFIRMED').map(q => ({ quote_id: q.id, group_id: q.group_id })),
    };
    return Response.json({ success: true, dry_run: true, writes_performed: 0, report });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});