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

function CountdownBadge({ total, assigned, color }) {
  if (total == null) return null;
  const remaining = total - assigned;
  const done = remaining === 0;
  return (
    <div className={`mt-2 rounded-lg px-3 py-1.5 text-xs flex items-center justify-between border ${
      done
        ? "bg-emerald-50 border-emerald-300 text-emerald-700"
        : remaining < 0
          ? "bg-red-50 border-red-300 text-red-700"
          : `${color}`
    }`}>
      <span>שובצו: <strong>{assigned}</strong> / {total}</span>
      <span className="font-bold">
        {done ? "✓ הכל שובץ" : remaining < 0 ? `${Math.abs(remaining)} עודף!` : `נותרו: ${remaining}`}
      </span>
    </div>
  );
}

function SummaryGroup({ color, borderColor, title, children }) {
  return (
    <div className={`rounded-xl border p-3 space-y-1 ${color} ${borderColor}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">{title}</p>
      {children}
    </div>
  );
}

export default function PeopleSummaryCard({ profile, vipRows = [], boysDist = [], girlsDist = [], staffAltTentPax, staffAltTentNotes }) {
  const staffTotal   = profile.staff_count        ?? null;
  const staffBoys    = profile.staff_men_count     ?? null;  // "בנים" in staff = men
  const staffGirls   = profile.staff_women_count   ?? null;  // "בנות" in staff = women
  const staffGenderKnown = staffBoys != null || staffGirls != null;

  const driversBoys  = profile.drivers_men_count   ?? null;
  const driversGirls = profile.drivers_women_count ?? null;
  const driversTotal = (driversBoys != null || driversGirls != null)
    ? (driversBoys ?? 0) + (driversGirls ?? 0)
    : null;
  const driversGenderKnown = driversBoys != null || driversGirls != null;

  const NON_STAFF = ["DRIVER", "SECURITY", "GUIDE", "OTHER"];

  // VIP countdown: staff-only rows vs staff_count
  const vipPeopleAssigned = vipRows
    .filter(r => !NON_STAFF.includes(r.purpose))
    .reduce((s, r) => s + (Number(r.people_count) || 0), 0);

  // Drivers/security countdown: non-staff VIP rows vs driversTotal
  const vipDriversAssigned = vipRows
    .filter(r => NON_STAFF.includes(r.purpose))
    .reduce((s, r) => s + (Number(r.people_count) || 0), 0);

  // Student countdown
  const boysAssigned  = boysDist.reduce((s, r) => s + (r.tent_count || 0) * (r.people_per_tent || 0), 0);
  const girlsAssigned = girlsDist.reduce((s, r) => s + (r.tent_count || 0) * (r.people_per_tent || 0), 0);

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

        {/* Students — green for boys, orange for girls */}
        <SummaryGroup color="bg-emerald-50" borderColor="border-emerald-200" title="חניכים / תלמידים">
          <StatRow label='סה״כ חניכים' value={profile.participant_count} />
          <div className="flex gap-2 mt-1">
            <div className="flex-1 bg-emerald-100 border border-emerald-300 rounded-lg px-2 py-1.5 text-center">
              <p className="text-[10px] text-emerald-700 font-semibold">בנים</p>
              <p className="text-base font-bold text-emerald-800">{profile.boys_count ?? "—"}</p>
            </div>
            <div className="flex-1 bg-orange-100 border border-orange-300 rounded-lg px-2 py-1.5 text-center">
              <p className="text-[10px] text-orange-700 font-semibold">בנות</p>
              <p className="text-base font-bold text-orange-800">{profile.girls_count ?? "—"}</p>
            </div>
          </div>
          <CountdownBadge
            total={profile.boys_count}
            assigned={boysAssigned}
            color="bg-emerald-50 border-emerald-200 text-emerald-700"
          />
          <CountdownBadge
            total={profile.girls_count}
            assigned={girlsAssigned}
            color="bg-orange-50 border-orange-200 text-orange-700"
          />
        </SummaryGroup>

        {/* Staff / VIP — with countdown */}
        <SummaryGroup color="bg-violet-50" borderColor="border-violet-200" title="צוות / מורים / VIP">
          <StatRow label='סה״כ צוות / מלווים' value={staffTotal} />
          {staffGenderKnown ? (
            <div className="flex gap-2 mt-1">
              <div className="flex-1 bg-emerald-100 border border-emerald-300 rounded-lg px-2 py-1.5 text-center">
                <p className="text-[10px] text-emerald-700 font-semibold">בנים</p>
                <p className="text-base font-bold text-emerald-800">{staffBoys ?? "—"}</p>
              </div>
              <div className="flex-1 bg-orange-100 border border-orange-300 rounded-lg px-2 py-1.5 text-center">
                <p className="text-[10px] text-orange-700 font-semibold">בנות</p>
                <p className="text-base font-bold text-orange-800">{staffGirls ?? "—"}</p>
              </div>
            </div>
          ) : staffTotal != null ? (
            <p className="text-[11px] text-slate-400 pr-1 mt-1">מגדר לא הוגדר</p>
          ) : null}
          <CountdownBadge
            total={staffTotal}
            assigned={vipPeopleAssigned}
            color="bg-violet-50 border-violet-200 text-violet-700"
          />
          <p className="text-[10px] text-violet-500 pt-0.5">→ אוהלי VIP (80–89)</p>
          {staffAltTentPax > 0 && (
            <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs space-y-0.5">
              <p className="font-semibold text-amber-800">צוות לאוהל חילופי: {staffAltTentPax} אנשים</p>
              {staffAltTentNotes && <p className="text-amber-700">הערות: {staffAltTentNotes}</p>}
            </div>
          )}
        </SummaryGroup>

        {/* Drivers / Security — pink */}
        <SummaryGroup color="bg-pink-50" borderColor="border-pink-200" title="נהגים / אבטחה / נוספים">
          <StatRow label='סה״כ נהגים / אבטחה' value={driversTotal} />
          {driversGenderKnown ? (
            <div className="flex gap-2 mt-1">
              <div className="flex-1 bg-emerald-100 border border-emerald-300 rounded-lg px-2 py-1.5 text-center">
                <p className="text-[10px] text-emerald-700 font-semibold">בנים</p>
                <p className="text-base font-bold text-emerald-800">{driversBoys ?? "—"}</p>
              </div>
              <div className="flex-1 bg-orange-100 border border-orange-300 rounded-lg px-2 py-1.5 text-center">
                <p className="text-[10px] text-orange-700 font-semibold">בנות</p>
                <p className="text-base font-bold text-orange-800">{driversGirls ?? "—"}</p>
              </div>
            </div>
          ) : driversTotal != null ? (
            <p className="text-[11px] text-slate-400 pr-1 mt-1">מגדר לא הוגדר</p>
          ) : null}
          <CountdownBadge
            total={driversTotal}
            assigned={vipDriversAssigned}
            color="bg-pink-50 border-pink-200 text-pink-700"
          />
          <p className="text-[10px] text-pink-500 pt-0.5">→ שורות VIP מסומנות *</p>
        </SummaryGroup>

      </div>
    </div>
  );
}