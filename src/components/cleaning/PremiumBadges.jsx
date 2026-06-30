/**
 * Small badge row showing the calculated rate reason(s) for a shift.
 * Display only — no manual override (MVP).
 */
import { REASON_LABELS } from "@/lib/cleaningPayrollCalculator";

const STYLES = {
  REGULAR: "bg-slate-100 text-slate-600 border-slate-200",
  FRIDAY_AFTER_14: "bg-amber-100 text-amber-700 border-amber-300",
  SATURDAY: "bg-amber-100 text-amber-700 border-amber-300",
  HOLIDAY: "bg-rose-100 text-rose-700 border-rose-300",
};

export default function PremiumBadges({ breakdown }) {
  if (!breakdown || breakdown.incomplete) return null;
  const reasons = breakdown.premium_reasons || [];

  if (reasons.length === 0) {
    return (
      <span className={`text-xs rounded-full px-2 py-0.5 font-medium border ${STYLES.REGULAR}`}>
        {REASON_LABELS.REGULAR}
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="text-xs rounded-full px-2 py-0.5 font-medium border bg-amber-50 text-amber-800 border-amber-300">
        150%
      </span>
      {reasons.map((r) => (
        <span key={r} className={`text-xs rounded-full px-2 py-0.5 font-medium border ${STYLES[r] || STYLES.REGULAR}`}>
          {REASON_LABELS[r] || r}
        </span>
      ))}
    </span>
  );
}