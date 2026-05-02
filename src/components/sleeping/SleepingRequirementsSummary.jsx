/**
 * Color-coded sleeping requirements + live remaining counters.
 * Boys = blue, Girls = pink, Security/Drivers = amber, Staff = purple.
 * Shows selected neighbourhoods inline.
 */
export default function SleepingRequirementsSummary({
  profile,
  allocations = [],
  nhoodReservations = [],
  allTents = [],
  neighborhoods = [],
}) {
  if (!profile) return null;

  const boysNeeded  = Number(profile.boys_beds_needed)    || 0;
  const girlsNeeded = Number(profile.girls_beds_needed)   || 0;
  const staffMen    = Number(profile.staff_men_count)     || 0;
  const staffWomen  = Number(profile.staff_women_count)   || 0;
  const driversMen  = Number(profile.drivers_men_count)   || 0;
  const driversWomen= Number(profile.drivers_women_count) || 0;
  const securityMen    = driversMen;
  const securityWomen  = driversWomen;

  // Student progress: from NeighborhoodReservations
  const activeNhoods = nhoodReservations.filter(r => r.status === "ACTIVE");
  const boysNhoods   = activeNhoods.filter(r => r.gender_group === "BOYS"  || r.gender_group === "MIXED");
  const girlsNhoods  = activeNhoods.filter(r => r.gender_group === "GIRLS" || r.gender_group === "MIXED");

  function bedsInReservations(resList) {
    let beds = 0;
    resList.forEach(r => {
      const tentCount  = r.planned_tents || 0;
      const tentsInHood = allTents.filter(t => t.neighborhood_id === r.neighborhood_id && t.working_status === "WORKING");
      const sorted = [...tentsInHood].sort((a, b) => (b.capacity || 0) - (a.capacity || 0));
      sorted.slice(0, tentCount).forEach(t => { beds += t.capacity || 0; });
    });
    return beds;
  }

  const allocatedBoys  = bedsInReservations(boysNhoods);
  const allocatedGirls = bedsInReservations(girlsNhoods);
  const remBoys   = boysNeeded  - allocatedBoys;
  const remGirls  = girlsNeeded - allocatedGirls;

  // VIP/staff from SleepingAllocation records
  const activeAllocs      = allocations.filter(a => a.status !== "CANCELLED");
  const allocatedStaffMen   = activeAllocs.filter(a => a.gender_group === "MEN").reduce((s, a)   => s + Number(a.allocated_pax), 0);
  const allocatedStaffWomen = activeAllocs.filter(a => a.gender_group === "WOMEN").reduce((s, a) => s + Number(a.allocated_pax), 0);
  const remStaffMen   = staffMen   + securityMen   - allocatedStaffMen;
  const remStaffWomen = staffWomen + securityWomen - allocatedStaffWomen;

  const totalStaffMen   = staffMen   + securityMen;
  const totalStaffWomen = staffWomen + securityWomen;

  function statusColor(rem, base) {
    if (rem === 0) return base + "-green";
    if (rem < 0)  return base + "-red";
    return null; // pending = gender color
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-700">דרישות לינה — מצב שיבוץ</h3>
      </div>

      <div className="p-4 space-y-4">

        {/* ── STUDENTS ──────────────────────────────────────────────────── */}
        {(boysNeeded > 0 || girlsNeeded > 0) && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">חניכים</p>
            <div className="grid grid-cols-2 gap-2">
              {/* BOYS */}
              {boysNeeded > 0 && (
                <div className={`rounded-xl border-2 px-3 py-3 flex flex-col gap-1 ${
                  remBoys === 0 ? "bg-emerald-50 border-emerald-300" :
                  remBoys < 0  ? "bg-red-50 border-red-300" :
                                 "bg-blue-50 border-blue-300"
                }`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">👦</span>
                    <span className="text-xs font-bold text-blue-800">בנים</span>
                    {remBoys === 0 && <span className="text-[10px] bg-emerald-200 text-emerald-800 rounded-full px-1.5 font-semibold mr-auto">✓ מלא</span>}
                    {remBoys < 0  && <span className="text-[10px] bg-red-200 text-red-800 rounded-full px-1.5 font-semibold mr-auto">חריגה!</span>}
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className={`text-2xl font-black leading-none ${remBoys < 0 ? "text-red-700" : remBoys === 0 ? "text-emerald-700" : "text-blue-700"}`}>
                        {remBoys < 0 ? `+${Math.abs(remBoys)}` : remBoys}
                      </span>
                      <span className="text-[10px] text-slate-500 mr-1">נותרו</span>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] text-slate-500 text-left">{allocatedBoys} / {boysNeeded}</p>
                      <p className="text-[10px] text-slate-400 text-left">מיטות שובצו</p>
                    </div>
                  </div>
                </div>
              )}

              {/* GIRLS */}
              {girlsNeeded > 0 && (
                <div className={`rounded-xl border-2 px-3 py-3 flex flex-col gap-1 ${
                  remGirls === 0 ? "bg-emerald-50 border-emerald-300" :
                  remGirls < 0  ? "bg-red-50 border-red-300" :
                                  "bg-pink-50 border-pink-300"
                }`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">👧</span>
                    <span className="text-xs font-bold text-pink-800">בנות</span>
                    {remGirls === 0 && <span className="text-[10px] bg-emerald-200 text-emerald-800 rounded-full px-1.5 font-semibold mr-auto">✓ מלא</span>}
                    {remGirls < 0  && <span className="text-[10px] bg-red-200 text-red-800 rounded-full px-1.5 font-semibold mr-auto">חריגה!</span>}
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className={`text-2xl font-black leading-none ${remGirls < 0 ? "text-red-700" : remGirls === 0 ? "text-emerald-700" : "text-pink-700"}`}>
                        {remGirls < 0 ? `+${Math.abs(remGirls)}` : remGirls}
                      </span>
                      <span className="text-[10px] text-slate-500 mr-1">נותרו</span>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] text-slate-500 text-left">{allocatedGirls} / {girlsNeeded}</p>
                      <p className="text-[10px] text-slate-400 text-left">מיטות שובצו</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STAFF / SECURITY (VIP) ───────────────────────────────────── */}
        {(totalStaffMen > 0 || totalStaffWomen > 0) && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              צוות ואבטחה — שיבוץ VIP
            </p>
            <div className="grid grid-cols-2 gap-2">
              {totalStaffMen > 0 && (
                <div className={`rounded-xl border-2 px-3 py-3 flex flex-col gap-1 ${
                  remStaffMen === 0 ? "bg-emerald-50 border-emerald-300" :
                  remStaffMen < 0  ? "bg-red-50 border-red-300" :
                                     "bg-amber-50 border-amber-300"
                }`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🛡️</span>
                    <span className="text-xs font-bold text-amber-800">גברים</span>
                    <span className="text-[10px] text-amber-600 border border-amber-300 rounded px-1 bg-amber-100">צוות+אבטחה</span>
                    {remStaffMen === 0 && <span className="text-[10px] bg-emerald-200 text-emerald-800 rounded-full px-1.5 font-semibold mr-auto">✓ מלא</span>}
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className={`text-2xl font-black leading-none ${remStaffMen < 0 ? "text-red-700" : remStaffMen === 0 ? "text-emerald-700" : "text-amber-700"}`}>
                        {remStaffMen < 0 ? `+${Math.abs(remStaffMen)}` : remStaffMen}
                      </span>
                      <span className="text-[10px] text-slate-500 mr-1">נותרו</span>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] text-slate-500 text-left">{allocatedStaffMen} / {totalStaffMen}</p>
                      <p className="text-[10px] text-slate-400 text-left">מיטות שובצו</p>
                    </div>
                  </div>
                </div>
              )}

              {totalStaffWomen > 0 && (
                <div className={`rounded-xl border-2 px-3 py-3 flex flex-col gap-1 ${
                  remStaffWomen === 0 ? "bg-emerald-50 border-emerald-300" :
                  remStaffWomen < 0  ? "bg-red-50 border-red-300" :
                                       "bg-purple-50 border-purple-300"
                }`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🛡️</span>
                    <span className="text-xs font-bold text-purple-800">נשים</span>
                    <span className="text-[10px] text-purple-600 border border-purple-300 rounded px-1 bg-purple-100">צוות+אבטחה</span>
                    {remStaffWomen === 0 && <span className="text-[10px] bg-emerald-200 text-emerald-800 rounded-full px-1.5 font-semibold mr-auto">✓ מלא</span>}
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className={`text-2xl font-black leading-none ${remStaffWomen < 0 ? "text-red-700" : remStaffWomen === 0 ? "text-emerald-700" : "text-purple-700"}`}>
                        {remStaffWomen < 0 ? `+${Math.abs(remStaffWomen)}` : remStaffWomen}
                      </span>
                      <span className="text-[10px] text-slate-500 mr-1">נותרו</span>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] text-slate-500 text-left">{allocatedStaffWomen} / {totalStaffWomen}</p>
                      <p className="text-[10px] text-slate-400 text-left">מיטות שובצו</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Selected neighbourhoods summary ─────────────────────────── */}
        {activeNhoods.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">שכונות שנבחרו</p>
            <div className="flex flex-wrap gap-1.5">
              {activeNhoods.map(r => {
                const nName = neighborhoods.find(n => n.id === r.neighborhood_id)?.name || r.neighborhood_id;
                const isBoys  = r.gender_group === "BOYS";
                const isGirls = r.gender_group === "GIRLS";
                const colorClass = isBoys ? "bg-blue-100 text-blue-800 border-blue-300"
                  : isGirls ? "bg-pink-100 text-pink-800 border-pink-300"
                  : "bg-slate-100 text-slate-700 border-slate-300";
                const emoji = isBoys ? "👦" : isGirls ? "👧" : "👥";
                return (
                  <span key={r.id} className={`inline-flex items-center gap-1 text-[11px] font-medium border rounded-full px-2.5 py-0.5 ${colorClass}`}>
                    {emoji} {nName} · {r.planned_tents} אוהלים
                  </span>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}