import { isValidDateString, validateStayPeriods, deriveStayEnvelope } from '../../shared/groupStayPeriods.js';

export default async function() {
  const values = ['2027-05-04', '20274-05-04', '0027-05-04', '2027-02-31', '2000-01-01', '2100-12-31', '2101-01-01'];
  const periods = [
    { start_date: '2027-05-04', end_date: '2027-05-05', status: 'ACTIVE' },
    { start_date: '2027-05-10', end_date: '2027-05-11', status: 'ACTIVE' },
  ];
  return Response.json({
    results: Object.fromEntries(values.map(value => [value, isValidDateString(value)])),
    multiPeriod: { validation: validateStayPeriods(periods), envelope: deriveStayEnvelope(periods) },
  });
}