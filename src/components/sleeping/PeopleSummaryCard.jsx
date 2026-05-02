function StatRow({ label, value, sub }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={`text-xs ${sub ? "text-slate-400 pr-3" : "text-slate-600 font-medium"}`}>{label}</span>
      <span className={`text-sm font-semibold ${sub ? "text-slate-500" : "text-slate-800"}`}>
        {value != null ? value : <span className="text-slate-300 font-normal text-xs">—</span>}
      </span>
    </div>
  );
}

function SummaryGroup({ color, title, children }) {
  return (
    <div className={`rounded-xl border p-3 space-y-1 ${color}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">{title}</p>
      {children}
    </div>
  );
}

export default function PeopleSummaryCard({ profile }) {
  const staffMen   = profile.staff_men_count   ?? null;
  const staffWomen = profile.staff_women_count  ?? null;
  const staffTotal = profile.staff_count        ?? null;

  const driversMen   = profile.drivers_men_count   ?? null;
  const driversWomen = profile.drivers_women_count ?? null;
  const driversTotal = (driversMen != null || driversWomen != null)
    ? (driversMen ?? 0) + (driversWomen ?? 0)
    : null;

  // Gender known for staff?
  const staffGenderKnown = staffMen != null || staffWomen != null;
  // Gender known for drivers?
  const driversGenderKnown = driversMen != null || driversWomen != null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-bold text-slate-700">סיכום לינה לקבוצה</p>
        {profile.total_pax != null && (
          <span className="text-xs bg-slate-100 border border-slate-200 rounded-full px-3 py-1 font-semibold text-slate-600">
            סה״כ: {profile.total_pax} אנשים
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

        {/* Students */}
        <SummaryGroup color="bg-blue-50 border-blue-200" title="חניכים / תלמידים">
          <StatRow label='סה״כ חניכים' value={profile.participant_count} />
          <StatRow label="בנים"  value={profile.boys_count}  sub />
          <StatRow label="בנות"  value={profile.girls_count} sub />
        </SummaryGroup>

        {/* Staff / VIP */}
        <SummaryGroup color="bg-purple-50 border-purple-200" title="צוות / מורים / VIP">
          <StatRow label='סה״כ צוות / מלווים' value={staffTotal} />
          {staffGenderKnown ? (
            <>
              <StatRow label="גברים" value={staffMen}   sub />
              <StatRow label="נשים"  value={staffWomen} sub />
            </>
          ) : (
            <p className="text-[11px] text-slate-400 pr-3">מגדר לא הוגדר</p>
          )}
          <p className="text-[11px] text-purple-500 pt-1">→ אוהלי VIP (80–89)</p>
        </SummaryGroup>

        {/* Drivers / Security */}
        <SummaryGroup color="bg-amber-50 border-amber-200" title="נהגים / אבטחה / נוספים">
          <StatRow label='סה״כ נהגים / אבטחה' value={driversTotal} />
          {driversGenderKnown ? (
            <>
              <StatRow label="גברים" value={driversMen}   sub />
              <StatRow label="נשים"  value={driversWomen} sub />
            </>
          ) : driversTotal != null ? (
            <p className="text-[11px] text-slate-400 pr-3">מגדר לא הוגדר</p>
          ) : null}
          <p className="text-[11px] text-amber-600 pt-1">→ ניתן להוסיף שורות VIP לפי צורך</p>
        </SummaryGroup>

      </div>
    </div>
  );
}