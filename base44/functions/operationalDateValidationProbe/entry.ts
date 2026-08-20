import { isValidDateString } from '../../shared/groupStayPeriods.js';

export default async function() {
  const values = ['2027-05-04', '20274-05-04', '0027-05-04', '2027-02-31', '2000-01-01', '2100-12-31', '2101-01-01'];
  return Response.json({ results: Object.fromEntries(values.map(value => [value, isValidDateString(value)])) });
}