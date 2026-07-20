import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { ensureQuotePreparation, auditLog } from '../../shared/quotePreparation.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    const internal = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
    const role = internal[0]?.role || user.role;
    if (role !== 'SUPER_ADMIN') return Response.json({ success: false, error: 'FEATURE_NOT_ENABLED_FOR_ROLE' }, { status: 403 });
    const { quote_id } = await req.json();
    if (!quote_id) return Response.json({ success: false, error: 'MISSING_QUOTE_ID' }, { status: 400 });
    const result = await ensureQuotePreparation(base44, quote_id);
    auditLog('ensure_preparation', user, result, result.quote.status, result.quote.status);
    return Response.json({ success: true, quote: result.quote, group: result.group, operationalProfile: result.operationalProfile, created_group: result.createdGroup, created_profile: result.createdProfile, warnings: result.warnings });
  } catch (error) {
    console.error('[ensureQuotePreparationGroup]', error?.code || error?.message);
    return Response.json({ success: false, error: error?.code || 'INTERNAL_ERROR', group_id: error?.group_id, profile_ids: error?.profile_ids }, { status: error?.code ? 409 : 500 });
  }
});