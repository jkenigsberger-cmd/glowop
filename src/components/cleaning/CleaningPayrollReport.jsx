/**
 * Transparent monthly housekeeping HOURS report (hours only — no money).
 * Per-shift breakdown grouped by worker, with per-worker and grand totals,
 * plus the calculation explanation box.
 *
 * Note: a shift may cover several workers (workers_count). The breakdown is
 * computed per single worker, then multiplied by workers_count for shift totals,
 * consistent with the existing total_worker_minutes model.
 */
import { useMemo } from "react";
import { calculateCleaningPayrollBreakdown, reasonsText } from "@/lib/cleaningPayrollCalculator";
import PremiumBadges from "./PremiumBadges";

const DOW_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function fmtDate(d) {
  if (!d) return "";
  const [y, mo, day] = d.split("-");
  return `${day}/${mo}/${y}`;
}
function dowLabel(d) {
  const [y, mo, day] = d.split("-").map(Number);
  return DOW_HE[new Date(Date.UTC(y, mo - 1, day)).getUTCDay()];
}
const n2 = (x) => Number(x || 0).toFixed(2);

function emptyTotals() {
  return { regular: 0, premium: 0, actual: 0, payable: 0 };
}

export default function CleaningPayrollReport({ shifts, holidays, from, to }) {
  const holidayDates = useMemo(
    () => (holidays || []).filter((h) => h.is_active).map((h) => h.date),
    [holidays]
  );

  const inRange = useMemo(
    () => shifts.filter((s) => s.status === "ACTIVE" && s.date >= from && s.date <= to),
    [shifts, from, to]
  );

  // Compute breakdown per shift (scaled by workers_count), group by worker name
  const { byWorker, workerNames, grand, incompleteCount } = useMemo(() => {
    const groups = {};
    const grandT = emptyTotals();
    let incomplete = 0;

    inRange.forEach((s) => {
      const name = s.label?.trim() || "ללא שם";
      if (!groups[name]) groups[name] = { rows: [], totals: emptyTotals() };

      const b = calculateCleaningPayrollBreakdown(s, holidayDates);
      const workers = Number(s.workers_count) || 1;

      const row = {
        id: s.id,
        date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        workers_count: workers,
        notes: s.notes,
        breakdown: b,
        // scaled by workers for the shift's contribution to totals
        regular: b.regular_hours * workers,
        premium: b.premium_150_hours * workers,
        actual: b.actual_hours * workers,
        payable: b.payable_hours * workers,
      };
      groups[name].rows.push(row);

      if (b.incomplete) {
        incomplete += 1;
      } else {
        groups[name].totals.regular += row.regular;
        groups[name].totals.premium += row.premium;
        groups[name].totals.actual += row.actual;
        groups[name].totals.payable += row.payable;
        grandT.regular += row.regular;
        grandT.premium += row.premium;
        grandT.actual += row.actual;
        grandT.payable += row.payable;
      }
    });

    Object.values(groups).forEach((g) =>
      g.rows.sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
    );
    const names = Object.keys(groups).sort((a, b) => a.localeCompare(b, "he"));
    return { byWorker: groups, workerNames: names, grand: grandT, incompleteCount: incomplete };
  }, [inRange, holidayDates]);

  return (
    <div className="space-y-5">
      {/* Explanation box */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm">
        <p className="font-bold text-slate-800 mb-1">חישוב שעות לתשלום:</p>
        <p className="text-slate-700" dir="rtl">שעות רגילות × 1.0 + שעות 150% × 1.5 = שעות לתשלום</p>
        <p className="text-slate-500 text-xs mt-1">דוגמה: 1.00 × 1.0 + 2.00 × 1.5 = 4.00</p>
      </div>

      {incompleteCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-xs text-amber-800">
          {incompleteCount} משמרות ללא שעת יציאה / לא הושלמו — אינן נכללות בסיכום השעות.
        </div>
      )}

      {workerNames.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">אין משמרות בטווח התאריכים שנבחר</p>
      ) : (
        workerNames.map((name) => {
          const g = byWorker[name];
          return (
            <div key={name} className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-sm text-slate-800">
                {name}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs" dir="rtl">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600">
                      {["תאריך", "יום", "כניסה", "יציאה", "שעות רגילות", "שעות 150%", "שעות בפועל", "שעות לתשלום", "סיבת 150%", "הערות"].map((h) => (
                        <th key={h} className="px-2.5 py-2 text-right font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.id} className={`border-b border-slate-100 ${r.breakdown.incomplete ? "bg-amber-50/40 text-slate-400" : ""}`}>
                        <td className="px-2.5 py-1.5 whitespace-nowrap">{fmtDate(r.date)}</td>
                        <td className="px-2.5 py-1.5 whitespace-nowrap">{dowLabel(r.date)}</td>
                        <td className="px-2.5 py-1.5">{r.start_time}</td>
                        <td className="px-2.5 py-1.5">{r.end_time || "—"}</td>
                        {r.breakdown.incomplete ? (
                          <td colSpan={6} className="px-2.5 py-1.5 text-amber-600">חסר שעת יציאה / משמרת לא הושלמה</td>
                        ) : (
                          <>
                            <td className="px-2.5 py-1.5">{n2(r.regular)}</td>
                            <td className="px-2.5 py-1.5 font-medium text-amber-700">{n2(r.premium)}</td>
                            <td className="px-2.5 py-1.5">{n2(r.actual)}</td>
                            <td className="px-2.5 py-1.5 font-bold text-primary">{n2(r.payable)}</td>
                            <td className="px-2.5 py-1.5"><PremiumBadges breakdown={r.breakdown} /></td>
                            <td className="px-2.5 py-1.5 text-slate-400">
                              {r.workers_count > 1 ? `×${r.workers_count} עובדות. ` : ""}{r.notes || ""}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                    {/* Per-worker totals */}
                    <tr className="bg-blue-50 font-bold text-slate-800">
                      <td colSpan={4} className="px-2.5 py-2">סה״כ {name}</td>
                      <td className="px-2.5 py-2">{n2(g.totals.regular)}</td>
                      <td className="px-2.5 py-2 text-amber-700">{n2(g.totals.premium)}</td>
                      <td className="px-2.5 py-2">{n2(g.totals.actual)}</td>
                      <td className="px-2.5 py-2 text-primary">{n2(g.totals.payable)}</td>
                      <td colSpan={2} className="px-2.5 py-2" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}

      {/* Grand totals */}
      {workerNames.length > 0 && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
          <p className="font-bold text-slate-800 mb-2 text-sm">סה״כ כללי (כל העובדות)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["סה״כ שעות רגילות", n2(grand.regular)],
              ["סה״כ שעות 150%", n2(grand.premium)],
              ["סה״כ שעות בפועל", n2(grand.actual)],
              ["סה״כ שעות לתשלום", n2(grand.payable)],
            ].map(([label, val], i) => (
              <div key={label} className={`rounded-lg border px-3 py-2 text-center ${i === 3 ? "border-primary/40 bg-primary/5" : "border-slate-200 bg-white"}`}>
                <p className={`text-lg font-bold ${i === 3 ? "text-primary" : "text-slate-800"}`}>{val}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Internal notes */}
      <div className="text-xs text-slate-500 space-y-1 border-t border-slate-200 pt-3">
        <p>החישוב מבוסס על ימי החג והנתונים כפי שמופיעים במערכת בזמן הפקת הדוח.</p>
        <p>יש לוודא את כללי השכר הסופיים מול חשבות שכר / רואה חשבון.</p>
      </div>
    </div>
  );
}