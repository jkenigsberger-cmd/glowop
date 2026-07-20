export const QUOTE_PREPARATION_FLOW_ENABLED = true;

export function assertQuotePreparationEnabled() {
  if (!QUOTE_PREPARATION_FLOW_ENABLED) {
    throw Object.assign(new Error('FEATURE_DISABLED'), { code: 'FEATURE_DISABLED' });
  }
}

export function isPreparationGroupOperational(group) {
  return !(group?.quote_preparation_flow === true && group?.status !== 'CONFIRMED');
}

export function assertOperationalGroup(group) {
  if (!group) throw Object.assign(new Error('GROUP_NOT_FOUND'), { code: 'GROUP_NOT_FOUND' });
  if (!isPreparationGroupOperational(group)) {
    throw Object.assign(new Error('PREPARATION_GROUP_NOT_OPERATIONAL'), { code: 'PREPARATION_GROUP_NOT_OPERATIONAL', group_id: group.id });
  }
}