import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { ensureQuotePreparation, quoteGroupFields, auditLog, isQuoteApproved } from '../../shared/quotePreparation.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    const internal = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
    const role = internal[0]?.role || user.role;
    if (!['SUPER_ADMIN', 'ADMIN'].includes(role)) return Response.json({ success: false, error: 'FORBIDDEN' }, { status: 403 });
    const { quote_id } = await req.json();
    if (!quote_id) return Response.json({ success: false, error: 'MISSING_QUOTE_ID' }, { status: 400 });

    const result = await ensureQuotePreparation(base44, quote_id);
    const beforeQuoteStatus = result.quote.status;
    if (isQuoteApproved(result.quote) && result.group.status === 'CONFIRMED') {
      auditLog('approve_already_complete', user, result, beforeQuoteStatus, 'APPROVED');
      return Response.json({ success: true, status: 'already_approved', message: 'ההצעה כבר אושרה', quote_id, group_id: result.group.id, operational_group_profile_id: result.operationalProfile.id, warnings: result.warnings });
    }

    const previousGroupStatus = result.group.status;
    const snapshot = JSON.stringify({ capturedAt: new Date().toISOString(), groupName: result.group.group_name, groupType: result.group.group_type, totalPax: result.quote.estimated_pax || 0, staffTotal: result.quote.staff_count || 0, studentsTotal: result.quote.participant_count || 0, total_price: result.quote.total_price || 0 });
    await base44.asServiceRole.entities.Group.update(result.group.id, { ...quoteGroupFields(result.quote), status: 'CONFIRMED', quote_preparation_flow: true });
    try {
      await base44.asServiceRole.entities.Quote.update(quote_id, { status: 'APPROVED', approved_at: new Date().toISOString(), approved_by: user.email, snapshot });
    } catch (error) {
      await base44.asServiceRole.entities.Group.update(result.group.id, { status: previousGroupStatus });
      throw Object.assign(error, { code: 'APPROVAL_ROLLED_BACK' });
    }
    result.group.status = 'CONFIRMED';
    result.quote.status = 'APPROVED';
    auditLog('approve_activate', user, result, beforeQuoteStatus, 'APPROVED');
    return Response.json({ success: true, status: 'approved', quote_id, group_id: result.group.id, operational_group_profile_id: result.operationalProfile.id, created_group: result.createdGroup, created_profile: result.createdProfile, warnings: result.warnings, integrations_activated: ['GROUP_CONFIRMED', 'OPERATIONAL_PROFILE_READY', 'QUOTE_APPROVED', 'SNAPSHOT_CAPTURED'] });
  } catch (error) {
    console.error('[approveQuoteAndActivateGroup]', error?.code || error?.message);
    return Response.json({ success: false, error: error?.code || 'INTERNAL_ERROR', quote_id: error?.quote_id, group_id: error?.group_id, profile_ids: error?.profile_ids, recovery: error?.recovery, partial_state: error?.code === 'PROFILE_CREATE_FAILED_RETRYABLE' ? 'QUOTE_LINKED_GROUP_EXISTS_PROFILE_MISSING' : undefined }, { status: error?.code ? 409 : 500 });
  }
});