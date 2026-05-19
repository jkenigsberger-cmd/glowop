/**
 * Displays sleeping requirements and neighbourhood-based allocation progress.
 * For students: uses boys_beds_needed / girls_beds_needed from profile.
 * For VIP/staff: uses SleepingAllocation records.
 */
export default function SleepingRequirementsSummary({ profile, allocations, nhoodReservations = [], allTents = [], neighborhoods = [] }) {
  if (!profile) return null;

  const hasGenderSplit = (Number(profile.boys_beds_needed) + Number(profile.girls_beds_needed)) > 0;
  const boysNeeded   = Number(profile.boys_beds_needed)  || 0;
  const girlsNeeded  = Number(profile.girls_beds_needed) || 0;
  const generalNeeded = !hasGenderSplit
    ? (Number(profile.boys_beds_needed) || Number(profile.participant_count) || Number(profile.total_pax) || 0)
    : 0;

  const activeAllocs = allocations.filter(a => a.status !== "CANCELLED");
  const activeNhoods = nhoodReservations.filter(r => r.status === "ACTIVE");

  function bedsInReservations(resList) {
    let beds = 0;
    resList.forEach(r => {
      const tentCount = r.planned_tents || 0;
      const tentsInHood = allTents.filter(t => t.neighborhood_id === r.neighborhood_id && t.working_status === "WORKING");
      const sorted = [...tentsInHood].sort((a, b) => (b.capacity || 0) - (a.capacity || 0));
      sorted.slice(0, tentCount).forEach(t => { beds += t.capacity || 0; });
    });
    return beds;
  }

  const boysNhoods    = activeNhoods.filter(r => r.gender_group === "BOYS");
  const girlsNhoods   = activeNhoods.filter(r => r.gender_group === "GIRLS");
  const generalNhoods = activeNhoods.filter(r => r.gender_group === "MIXED");

  const allocatedBoysBeds    = bedsInReservations(boysNhoods);
  const allocatedGirlsBeds   = bedsInReservations(girlsNhoods);
  const allocatedGeneralBeds = bedsInReservations(generalNhoods);

  const remBoys    = boysNeeded  - allocatedBoysBeds;
  const remGirls   = girlsNeeded - allocatedGirlsBeds;
  const remGeneral = generalNeeded - allocatedGeneralBeds;

  const Counter = ({ label, required, allocated, remaining, color }) => (
    <div className={`rounded-xl border px-3 py-2.5 flex flex-col items-center gap-0.5 ${color}`}>
      <span className="text-[10px] text-slate-500 font-medium text-center">{label}</span>
      <span className="text-xl font-bold leading-none">{remaining < 0 ? `+${Math.abs(remaining)}` : remaining}</span>
      <span className="text-[10px] text-slate-400">{allocated} / {required} מיטות</span>
    </div>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">דרישות לינה — נותרו לשיבוץ</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {hasGenderSplit ? (
          <>
            <Counter
              label="בנים נותרו"
              required={boysNeeded}
              allocated={allocatedBoysBeds}
              remaining={remBoys}
              color={remBoys === 0 ? "bg-green-50 border-green-200 text-green-700" : remBoys < 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}
            />
            <Counter
              label="בנות נותרו"
              required={girlsNeeded}
              allocated={allocatedGirlsBeds}
              remaining={remGirls}
              color={remGirls === 0 ? "bg-green-50 border-green-200 text-green-700" : remGirls < 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-orange-50 border-orange-200 text-orange-700"}
            />
          </>
        ) : (
          <Counter
            label="משתתפים נותרו"
            required={generalNeeded}
            allocated={allocatedGeneralBeds}
            remaining={remGeneral}
            color={remGeneral === 0 ? "bg-green-50 border-green-200 text-green-700" : remGeneral < 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-blue-50 border-blue-200 text-blue-700"}
          />
        )}
      </div>

      {/* Neighbourhood summary */}
      {activeNhoods.length > 0 && (
        <div className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
          <span className="font-medium text-slate-600">שכונות שנבחרו: </span>
          {activeNhoods.map((r, i) => {
            const nName = neighborhoods.find(n => n.id === r.neighborhood_id)?.name || r.neighborhood_id;
            return (
              <span key={r.id}>
                {i > 0 && ", "}
                <span className="text-slate-700 font-medium">{nName}</span>
                {" "}({r.planned_tents || "?"} אוהלים · {r.gender_group})
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}