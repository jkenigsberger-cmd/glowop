/**
 * Displays sleeping requirements and allocation progress.
 * Counts allocated pax directly from SleepingAllocation records (by gender_group),
 * so BOYS tents inside MIXED neighborhoods correctly count toward boys, not a third "mixed" category.
 */
export default function SleepingRequirementsSummary({ profile, allocations, nhoodReservations = [], allTents = [], neighborhoods = [] }) {
  if (!profile) return null;

  // Detect inconsistency: boys_beds_needed + girls_beds_needed must equal participant_count for LODGING groups
  const profParticipants = Number(profile.participant_count) || 0;
  const profBoys  = Number(profile.boys_beds_needed) || 0;
  const profGirls = Number(profile.girls_beds_needed) || 0;
  const hasGenderData = profBoys + profGirls > 0;
  const isInconsistent = profile.is_sleeping_group && hasGenderData && profParticipants > 0 && (profBoys + profGirls) !== profParticipants;

  const hasGenderSplit = hasGenderData;
  const boysNeeded    = Number(profile.boys_beds_needed)  || 0;
  const girlsNeeded   = Number(profile.girls_beds_needed) || 0;
  const generalNeeded = !hasGenderSplit
    ? (Number(profile.participant_count) || Number(profile.total_pax) || 0)
    : 0;

  // Count from actual allocation records — gender_group on each SleepingAllocation is the source of truth
  const activeStudentAllocs = (allocations || []).filter(
    a => a.status !== "CANCELLED" && a.allocation_type === "STUDENT"
  );

  const allocatedBoys    = activeStudentAllocs.filter(a => a.gender_group === "BOYS")
    .reduce((s, a) => s + (a.allocated_pax || 0), 0);
  const allocatedGirls   = activeStudentAllocs.filter(a => a.gender_group === "GIRLS")
    .reduce((s, a) => s + (a.allocated_pax || 0), 0);
  const allocatedMixed   = activeStudentAllocs.filter(a => a.gender_group === "MIXED")
    .reduce((s, a) => s + (a.allocated_pax || 0), 0);
  const allocatedGeneral = hasGenderSplit ? 0 : (allocatedBoys + allocatedGirls + allocatedMixed);

  // For gender-split: boys/girls allocated = their own + any MIXED allocs (legacy) split proportionally
  // Simpler and more correct: just show MIXED allocs as informational if they exist alongside boys/girls
  const remBoys    = boysNeeded  - allocatedBoys;
  const remGirls   = girlsNeeded - allocatedGirls;
  const totalNeeded     = boysNeeded + girlsNeeded;
  const totalAllocated  = allocatedBoys + allocatedGirls + (hasGenderSplit ? allocatedMixed : 0);
  const remTotal   = totalNeeded - totalAllocated;
  const remGeneral = generalNeeded - allocatedGeneral;

  const activeNhoods = (nhoodReservations || []).filter(r => r.status === "ACTIVE");

  const Counter = ({ label, required, allocated, remaining, blockComplete = false }) => {
    const isComplete = remaining === 0 && !blockComplete;
    const isOver     = remaining < 0;
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

      {isInconsistent && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 whitespace-pre-line">
          ⛔ קיימת אי התאמה בין מספר החניכים לבין חלוקת בנים/בנות.{"\n"}יש לערוך את הקבוצה ולתקן את החלוקה לפני המשך שיבוץ הלינה.
        </div>
      )}

      {hasGenderSplit ? (
        <div className="grid grid-cols-3 gap-2">
          <Counter label="בנים"  required={boysNeeded}  allocated={allocatedBoys}   remaining={remBoys}  blockComplete={isInconsistent} />
          <Counter label="בנות"  required={girlsNeeded} allocated={allocatedGirls}  remaining={remGirls} blockComplete={isInconsistent} />
          <Counter label="סה״כ"  required={totalNeeded} allocated={totalAllocated}  remaining={remTotal} blockComplete={isInconsistent} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Counter label="משתתפים" required={generalNeeded} allocated={allocatedGeneral} remaining={remGeneral} blockComplete={false} />
        </div>
      )}

      {/* Mixed allocs info note — only shown if MIXED-tagged allocs exist alongside a gender-split group */}
      {hasGenderSplit && allocatedMixed > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠️ {allocatedMixed} אנשים שובצו עם תגית "מעורב" — מומלץ לשבץ מחדש עם בנים/בנות לצורך ספירה מדויקת
        </div>
      )}

      {/* Gender split not defined notice */}
      {!hasGenderSplit && profile.is_sleeping_group && (
        <div className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
          ℹ️ חלוקת בנים/בנות טרם הוגדרה — ניתן להשלים בעריכת הקבוצה.
        </div>
      )}

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
                {" "}({r.planned_tents || "?"} אוהלים
                {r.gender_group !== "MIXED" ? ` · ${r.gender_group === "BOYS" ? "בנים" : "בנות"}` : " · מעורב"})
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}