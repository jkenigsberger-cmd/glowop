import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ensureQuotePreparation, quoteGroupFields, auditLog, isQuoteApproved } from '../../shared/quotePreparation.js';
import { assertQuoteMultiOptionEnabled, resolveSelectedQuoteOption, buildApprovedOptionSnapshot, markSelectedQuoteOption } from '../../shared/quoteOptions.js';
import { assertValidQuoteOperationalDates } from '../../shared/operationalDateValidation.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    const internal = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
    const role = internal[0]?.role || user.role;
    if (!['SUPER_ADMIN', 'ADMIN'].includes(role)) return Response.json({ success: false, error: 'FORBIDDEN' }, { status: 403 });
    const { quote_id, selected_option_key } = await req.json();
    if (!quote_id) return Response.json({ success: false, error: 'MISSING_QUOTE_ID' }, { status: 400 });
    const quote = await base44.asServiceRole.entities.Quote.get(quote_id);
    if (!quote) return Response.json({ success: false, error: 'QUOTE_NOT_FOUND' }, { status: 404 });
    assertValidQuoteOperationalDates(quote);
    if (quote.multi_option_enabled) assertQuoteMultiOptionEnabled(role);
    const selection = await resolveSelectedQuoteOption(base44, quote, selected_option_key);

    const result = await ensureQuotePreparation(base44, quote_id);
    const beforeQuoteStatus = result.quote.status;
    const alreadyApproved = isQuoteApproved(result.quote);
    const snapshot = result.quote.approved_option_snapshot || buildApprovedOptionSnapshot(result.quote, selection, user, { groupId: result.group.id, profileId: result.operationalProfile.id });

    if (result.quote.multi_option_enabled) await markSelectedQuoteOption(base44, quote_id, selection.key);
    if (!alreadyApproved) await base44.asServiceRole.entities.Quote.update(quote_id, { status: 'APPROVED', approved_at: new Date().toISOString(), approved_by: user.email, snapshot, approved_option_key: selection.key, approved_option_total_price: Number(selection.effectiveQuote.total_price || 0), approved_option_snapshot: snapshot });
    if (result.group.status !== 'CONFIRMED') await base44.asServiceRole.entities.Group.update(result.group.id, { ...quoteGroupFields(result.quote), status: 'CONFIRMED', quote_preparation_flow: true });

    const finalQuote = await base44.asServiceRole.entities.Quote.get(quote_id);
    const finalGroup = await base44.asServiceRole.entities.Group.get(result.group.id);
    const finalProfiles = await base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id: result.group.id });
    if (finalProfiles.length !== 1) throw Object.assign(new Error('DUPLICATE_OPERATIONAL_PROFILE'), { code: 'DUPLICATE_OPERATIONAL_PROFILE', profile_ids: finalProfiles.map(p => p.id) });
    auditLog(alreadyApproved ? 'approve_repaired' : 'approve_activate', user, { ...result, quote: finalQuote, group: finalGroup }, beforeQuoteStatus, 'APPROVED');
    return Response.json({ success: true, status: alreadyApproved ? 'already_approved_repaired' : 'approved', quote: finalQuote, group: finalGroup, profile: finalProfiles[0], quote_id, group_id: finalGroup.id, operational_group_profile_id: finalProfiles[0].id, warnings: result.warnings });
  } catch (error) {
    console.error('[approveQuoteAndActivateGroup]', error?.code || error?.message);
    return Response.json({ success: false, error: error?.code || 'INTERNAL_ERROR', message: error?.message, quote_id: error?.quote_id, group_id: error?.group_id, profile_ids: error?.profile_ids, recovery: error?.recovery, partial_state: error?.code === 'PROFILE_CREATE_FAILED_RETRYABLE' ? 'QUOTE_LINKED_GROUP_EXISTS_PROFILE_MISSING' : undefined }, { status: error?.code === 'INVALID_QUOTE_OPERATIONAL_DATE' ? 400 : error?.code ? 409 : 500 });
  }
});