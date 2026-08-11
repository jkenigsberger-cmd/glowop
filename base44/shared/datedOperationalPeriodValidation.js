import { isDateInsideStayPeriods } from './groupStayPeriods.js';

export const DATE_OUTSIDE_ACTIVE_STAY_PERIOD = 'DATE_OUTSIDE_ACTIVE_STAY_PERIOD';
export const DATE_OUTSIDE_ACTIVE_STAY_PERIOD_MESSAGE = 'התאריך שנבחר אינו נמצא בתקופת שהייה פעילה של המכינה';

export async function validateDatedOperationalDate(base44, group, date) {
  if (group?.stay_mode !== 'MULTI_PERIOD') return { valid: true };
  const periods = await base44.asServiceRole.entities.GroupStayPeriod.filter({
    group_id: group.id,
    status: 'ACTIVE',
  });
  return isDateInsideStayPeriods(date, periods)
    ? { valid: true }
    : {
        valid: false,
        code: DATE_OUTSIDE_ACTIVE_STAY_PERIOD,
        message: DATE_OUTSIDE_ACTIVE_STAY_PERIOD_MESSAGE,
      };
}

export async function authorizeDatedOperationalManager(base44, user) {
  const rows = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
  const internal = rows.find(row => row.email === user.email && row.active !== false);
  const role = internal?.role || user.role;
  return ['SUPER_ADMIN', 'ADMIN', 'admin'].includes(role);
}