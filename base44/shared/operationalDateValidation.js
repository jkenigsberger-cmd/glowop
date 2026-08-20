import { isValidDateString } from './groupStayPeriods.js';

export const INVALID_OPERATIONAL_DATE_CODE = 'INVALID_QUOTE_OPERATIONAL_DATE';
export const INVALID_OPERATIONAL_DATE_MESSAGE = 'תאריכי הצעת המחיר אינם תקינים. יש לתקן את ההצעה לפני העברה לתפעול.';
export const INVALID_GROUP_OPERATIONAL_DATE_CODE = 'INVALID_GROUP_OPERATIONAL_DATE';
export const INVALID_GROUP_OPERATIONAL_DATE_MESSAGE = 'תאריכי הקבוצה אינם תקינים. יש לתקן את הקבוצה לפני הפעלה תפעולית.';

function invalid(value) {
  return value !== undefined && value !== null && value !== '' && !isValidDateString(value);
}

export function assertValidQuoteOperationalDates(quote) {
  if (invalid(quote?.arrival_date) || invalid(quote?.departure_date)) {
    throw Object.assign(new Error(INVALID_OPERATIONAL_DATE_MESSAGE), {
      code: INVALID_OPERATIONAL_DATE_CODE,
    });
  }
}

export function assertValidGroupOperationalDates(group) {
  if (!isValidDateString(group?.arrival_date) || invalid(group?.departure_date)) {
    throw Object.assign(new Error(INVALID_GROUP_OPERATIONAL_DATE_MESSAGE), {
      code: INVALID_GROUP_OPERATIONAL_DATE_CODE,
    });
  }
}