const formatDate = value => value ? value.split("-").reverse().join(".") : "—";
const formatList = values => values?.length ? values.map(formatDate).join(", ") : "—";

export default function StayPeriodsPreview({ result, messages }) {
  if (!result) return null;
  if (!result.valid) return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 space-y-2">
      <p className="font-semibold">לא ניתן להמשיך לפני תיקון התקופות</p>
      <ul className="list-disc pr-5 text-xs space-y-1">{messages.map(message => <li key={message}>{message}</li>)}</ul>
    </div>
  );
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800 space-y-2">
      <p className="font-semibold">התקופות תקינות</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <span>טווח כללי</span><strong>{formatDate(result.derived_envelope?.start_date)}–{formatDate(result.derived_envelope?.end_date)}</strong>
        <span>מספר תקופות</span><strong>{result.normalized_periods.filter(period => period.status !== "CANCELLED").length}</strong>
        <span>ימי שהייה בפועל</span><strong>{result.operational_dates.length}</strong>
        <span>ימי היעדרות</span><strong>{result.gaps.length}{result.gaps.length ? ` (${formatList(result.gaps)})` : ""}</strong>
        <span>תאריכי כניסה</span><strong>{formatList(result.arrival_dates)}</strong>
        <span>תאריכי יציאה</span><strong>{formatList(result.departure_dates)}</strong>
      </div>
    </div>
  );
}