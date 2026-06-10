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

  const Counter = ({ label, required, allocated, remaining }) => {
    const isComplete  = remaining === 0;
    const isOver      = remaining < 0;
    const containerColor = isComplete
      ? "bg-green-50 border-green-200"
      : isOver
      ? "bg-red-50 border-red-200"
      : "bg-amber-50 border-amber-200";
    const mainColor = isComplete ? "text-green-700" : isOver ? "text-red-700" : "text-amber-700";

    return (
      <div className={`rounded-xl border px-3 py-3 flex flex-col gap-1.5 ${containerColor}`} dir="rtl">
        <span className="text-xs font-bold text-slate-700">{label}</span>
        <div className="flex justify-between text-xs text-slate-500">
          <span>נדרש</span><span className="font-semibold text-slate-700">{required}</span>
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>שובץ</span><span className="font-semibold text-slate-700">{allocated}</span>
        </div>
        <div className={`flex justify-between text-xs font-bold mt-0.5 ${mainColor}`}>
          {isComplete ? (
            <span className="w-full text-center">✓ הכל שובץ</span>
          ) : isOver ? (
            <>
              <span>חריגה</span>
              <span>+{Math.abs(remaining)}</span>
            </>
          ) : (
            <>
              <span>נותרו</span>
              <span>{remaining}</span>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">דרישות לינה — נותרו לשיבוץ</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {hasGenderSplit ? (
          <>
            <Counter label="בנים" required={boysNeeded}   allocated={allocatedBoysBeds}    remaining={remBoys}    />
            <Counter label="בנות" required={girlsNeeded}  allocated={allocatedGirlsBeds}   remaining={remGirls}   />
            {allocatedGeneralBeds > 0 && (
              <Counter label="מעורב" required={boysNeeded + girlsNeeded} allocated={allocatedBoysBeds + allocatedGirlsBeds + allocatedGeneralBeds} remaining={(boysNeeded + girlsNeeded) - (allocatedBoysBeds + allocatedGirlsBeds + allocatedGeneralBeds)} />
            )}
          </>
        ) : (
          <Counter label="משתתפים" required={generalNeeded} allocated={allocatedGeneralBeds} remaining={remGeneral} />
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