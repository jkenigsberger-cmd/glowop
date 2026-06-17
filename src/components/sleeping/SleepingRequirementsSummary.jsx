/**
 * Displays sleeping requirements and allocation progress.
 * Now uses unified allocationCounts utility that counts ALL active allocations:
 * students (STUDENT), VIP (STAFF + __vip_req_N__), alt tent (STAFF + __alt_tent__).
 */
import { computeAllocationCounts } from "@/lib/allocationCounts";

export default function SleepingRequirementsSummary({ profile, allocations, nhoodReservations = [], allTents = [], neighborhoods = [] }) {
  if (!profile) return null;

  // ── Unified counts from actual SleepingAllocation records ──────────────
  const counts = computeAllocationCounts(allocations, profile);

  // ── Legacy gender-split display (students only) ────────────────────────
  const profBoys  = Number(profile.boys_count)  || 0;
  const profGirls = Number(profile.girls_count) || 0;
  const hasGenderData = profBoys + profGirls > 0;
  const profParticipants = Number(profile.participant_count) || 0;
  const genderSum = profBoys + profGirls;
  const isInconsistent = profile.is_sleeping_group && hasGenderData && profParticipants > 0 && genderSum !== profParticipants;
  const hasGenderSplit = hasGenderData && !isInconsistent;

  const boysNeeded  = Number(profile.boys_beds_needed  ?? profile.boys_count)  || 0;
  const girlsNeeded = Number(profile.girls_beds_needed ?? profile.girls_count) || 0;
  const generalNeeded = !hasGenderData
    ? (Number(profile.participant_count) || Number(profile.total_pax) || 0)
    : 0;

  const activeStudentAllocs = (allocations || []).filter(
    a => a.status !== "CANCELLED" && a.allocation_type === "STUDENT"
  );
  const allocatedBoys  = activeStudentAllocs.filter(a => a.gender_group === "BOYS").reduce((s, a) => s + (a.allocated_pax || 0), 0);
  const allocatedGirls = activeStudentAllocs.filter(a => a.gender_group === "GIRLS").reduce((s, a) => s + (a.allocated_pax || 0), 0);
  const allocatedMixed = activeStudentAllocs.filter(a => a.gender_group === "MIXED").reduce((s, a) => s + (a.allocated_pax || 0), 0);

  const remBoys    = boysNeeded  - allocatedBoys;
  const remGirls   = girlsNeeded - allocatedGirls;
  const totalNeeded    = boysNeeded + girlsNeeded;
  const totalAllocated = allocatedBoys + allocatedGirls + (hasGenderSplit ? allocatedMixed : 0);
  const remTotal  = totalNeeded - totalAllocated;
  const allocatedGeneral = hasGenderSplit ? 0 : (allocatedBoys + allocatedGirls + allocatedMixed);
  const remGeneral = generalNeeded - allocatedGeneral;

  const activeNhoods = (nhoodReservations || []).filter(r => r.status === "ACTIVE");

  const Counter = ({ label, required, allocated, remaining, blockComplete = false, sub = false }) => {
    const isComplete = remaining === 0 && !blockComplete;
    const isOver     = remaining < 0;
    const containerColor = isComplete
      ? "bg-green-50 border-green-200"
      : isOver
      ? "bg-red-50 border-red-200"
      : "bg-amber-50 border-amber-200";
    const mainColor = isComplete ? "text-green-700" : isOver ? "text-red-700" : "text-amber-700";

    return (
      <div className={`rounded-xl border px-3 py-3 flex flex-col gap-1.5 ${containerColor} ${sub ? "opacity-80" : ""}`} dir="rtl">
        <span className={`${sub ? "text-[10px]" : "text-xs"} font-bold text-slate-700`}>{label}</span>
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
      <h3 className="text-sm font-semibold text-slate-700">דרישות לינה — סיכום שיבוץ</h3>

      {isInconsistent && (() => {
        const missing = profParticipants - genderSum;
        return (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-0.5">
            <p className="font-semibold">⛔ חלוקת בנים/בנות לא תואמת למספר החניכים</p>
            <p>סה״כ חניכים: <strong>{profParticipants}</strong></p>
            <p>בנים + בנות: <strong>{genderSum}</strong></p>
            <p className="font-bold">{missing > 0 ? `חסרים ${missing} חניכים בחלוקה.` : `יש ${Math.abs(missing)} חניכים יותר מדי בחלוקה.`}</p>
            <p className="text-red-600 pt-0.5">יש לערוך את הקבוצה ולתקן את החלוקה לפני המשך שיבוץ הלינה.</p>
          </div>
        );
      })()}

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

      {/* ── Unified totals (ALL allocation types) ────────────────────────── */}
      {counts.totalRequired > 0 && (
        <div className={`rounded-xl border px-4 py-3 space-y-1 ${
          counts.isComplete
            ? "bg-emerald-50 border-emerald-300"
            : "bg-amber-50 border-amber-300"
        }`}>
          <p className={`text-xs font-bold ${counts.isComplete ? "text-emerald-800" : "text-amber-800"}`}>
            {counts.isComplete ? "✓ כל האנשים שובצו" : "שיבוץ חלקי"}
          </p>
          <div className="flex gap-4 text-[11px] text-slate-600">
            <span>סה״כ נדרש: <strong>{counts.totalRequired}</strong></span>
            <span>שובץ: <strong>{counts.totalAllocated}</strong></span>
            {counts.totalRemaining > 0 && (
              <span className="font-semibold text-amber-700">נותרו: {counts.totalRemaining}</span>
            )}
          </div>
          {/* Breakdown */}
          <div className="text-[10px] text-slate-500 space-y-0.5 pt-1">
            {counts.studentAllocated > 0 && (
              <p>חניכים: {counts.studentAllocated} / {counts.studentRequired} ({counts.studentTentCount} אוהלים)</p>
            )}
            {counts.vipAllocated > 0 && (
              <p>VIP: {counts.vipAllocated} ({counts.vipTentCount} אוהלים)</p>
            )}
            {counts.altTentAllocated > 0 && (
              <p>אוהל חילופי: {counts.altTentAllocated} ({counts.altTentCount} אוהלים)</p>
            )}
            {counts.otherStaffAllocated > 0 && (
              <p>צוות אחר: {counts.otherStaffAllocated}</p>
            )}
          </div>
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