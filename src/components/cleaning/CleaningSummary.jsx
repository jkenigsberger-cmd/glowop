/**
 * Monthly housekeeping HOURS report (hours only — no money).
 * Date-range picker + print, rendering the transparent payroll-hours breakdown.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import CleaningPayrollReport from "./CleaningPayrollReport";

function getMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const last = new Date(y, now.getMonth() + 1, 0).getDate();
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${last}` };
}

export default function CleaningSummary({ shifts, holidays = [], onPrint }) {
  const def = getMonthRange();
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [applied, setApplied] = useState({ from: def.from, to: def.to });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <h3 className="text-base font-bold text-slate-800">דוח שעות — חישוב 150%</h3>

      {/* Range picker */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-slate-500">מתאריך</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="border border-input rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">עד תאריך</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="border border-input rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <Button size="sm" variant="outline" onClick={() => setApplied({ from, to })}>הצג דוח</Button>
        <Button size="sm" variant="outline" onClick={() => onPrint(applied)}>🖨️ הדפס דוח</Button>
      </div>

      <CleaningPayrollReport shifts={shifts} holidays={holidays} from={applied.from} to={applied.to} />
    </div>
  );
}