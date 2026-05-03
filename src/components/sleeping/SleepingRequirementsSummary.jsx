/**
 * Displays sleeping requirements and neighbourhood-based allocation progress.
 * For students: uses boys_beds_needed / girls_beds_needed from profile.
 * For VIP/staff: uses SleepingAllocation records.
 */
export default function SleepingRequirementsSummary({ profile, allocations, nhoodReservations = [], allTents = [], neighborhoods = [] }) {
  if (!profile) return null;

  const boysNeeded  = Number(profile.boys_beds_needed)  || 0;
  const girlsNeeded = Number(profile.girls_beds_needed) || 0;
  const staffM = Number(profile.drivers_men_count)   || 0;
  const staffW = Number(profile.drivers_women_count) || 0;

  // Student allocation from neighbourhood reservations:
  // sum beds in tents of reserved neighbourhoods (using planned_tents * avg capacity is imprecise;
  // better: sum capacity of all tents in reserved neighbourhoods, capped at planned_tents)
  const activeAllocs = allocations.filter(a => a.status !== "CANCELLED");

  // VIP/staff from SleepingAllocation records
  const allocatedMen   = activeAllocs.filter(a => a.gender_group === "MEN").reduce((s, a)   => s + Number(a.allocated_pax), 0);
  const allocatedWomen = activeAllocs.filter(a => a.gender_group === "WOMEN").reduce((s, a) => s + Number(a.allocated_pax), 0);

  // Student progress from NeighborhoodReservations
  const activeNhoods = nhoodReservations.filter(r => r.status === "ACTIVE");
  const boysNhoods  = activeNhoods.filter(r => r.gender_group === "BOYS" || r.gender_group === "MIXED");
  const girlsNhoods = activeNhoods.filter(r => r.gender_group === "GIRLS" || r.gender_group === "MIXED");

  function bedsInReservations(resList) {
    let beds = 0;
    resList.forEach(r => {
      const tentCount = r.planned_tents || 0;
      const tentsInHood = allTents.filter(t => t.neighborhood_id === r.neighborhood_id && t.working_status === "WORKING");
      // use planned_tents count of tents, taking capacity from actual tents
      const sorted = [...tentsInHood].sort((a, b) => (b.capacity || 0) - (a.capacity || 0));
      sorted.slice(0, tentCount).forEach(t => { beds += t.capacity || 0; });
    });
    return beds;
  }

  const allocatedBoysBeds  = bedsInReservations(boysNhoods);
  const allocatedGirlsBeds = bedsInReservations(girlsNhoods);
  const remBoys  = boysNeeded  - allocatedBoysBeds;
  const remGirls = girlsNeeded - allocatedGirlsBeds;

  const Counter = ({ label, required, allocated, remaining, color }) => (
    <div className={`rounded-xl border px-3 py-2.5 flex flex-col items-center gap-0.5 ${color}`}>
      <span className="text-[10px] text-slate-500 font-medium text-center">{label}</span>
      <span className="text-xl font-bold leading-none">{remaining < 0 ? `+${Math.abs(remaining)}` : remaining}</span>
      <span className="text-[10px] text-slate-400">{allocated} / {required} מיטות</span>
    </div>
  );

  const remMen   = staffM - allocatedMen;
  const remWomen = staffW - allocatedWomen;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">דרישות לינה — נותרו לשיבוץ</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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