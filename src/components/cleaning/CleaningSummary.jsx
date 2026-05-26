/**
 * Monthly/date-range summary for cleaning worker shifts.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";

const SHIFT_LABELS = { MORNING: "בוקר", EVENING: "ערב", OTHER: "אחר" };

function fmtMins(mins) {
  if (!mins || mins <= 0) return "0:00";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function decimalHours(mins) {
  return (mins / 60).toFixed(1);
}

function getMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const last = new Date(y, now.getMonth() + 1, 0).getDate();
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${last}` };
}

export default function CleaningSummary({ shifts, onPrint }) {
  const def = getMonthRange();
  const [from, setFrom] = useState(def.from);
  const [to, setTo]   = useState(def.to);
  const [applied, setApplied] = useState({ from: def.from, to: def.to });

  const filtered = shifts.filter(s =>
    s.status === "ACTIVE" && s.date >= applied.from && s.date <= applied.to
  );

  const totalMins   = filtered.reduce((sum, s) => sum + (s.total_worker_minutes || 0), 0);
  const morningMins = filtered.filter(s => s.shift_type === "MORNING").reduce((sum, s) => sum + (s.total_worker_minutes || 0), 0);
  const eveningMins = filtered.filter(s => s.shift_type === "EVENING").reduce((sum, s) => sum + (s.total_worker_minutes || 0), 0);
  const otherMins   = filtered.filter(s => s.shift_type === "OTHER").reduce((sum, s) => sum + (s.total_worker_minutes || 0), 0);
  const uniqueDays  = new Set(filtered.map(s => s.date)).size;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <h3 className="text-base font-bold text-slate-800">סיכום שעות לפי תאריכים</h3>

      {/* Range picker */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-slate-500">מתאריך</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border border-input rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">עד תאריך</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border border-input rounded-md px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <Button size="sm" variant="outline" onClick={() => setApplied({ from, to })}>הצג סיכום</Button>
        <Button size="sm" variant="outline" onClick={() => onPrint(applied)}>🖨️ הדפס דוח</Button>
      </div>

      {/* Totals grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'סה״כ משמרות',     value: filtered.length },
          { label: 'סה״כ ימי עבודה',  value: uniqueDays },
          { label: 'סה״כ שעות עבודה', value: `${fmtMins(totalMins)} (${decimalHours(totalMins)} ש')`, highlight: true },
          { label: 'סה״כ שעות בוקר',  value: fmtMins(morningMins) },
          { label: 'סה״כ שעות ערב',   value: fmtMins(eveningMins) },
          { label: 'סה״כ שעות אחר',   value: fmtMins(otherMins) },
        ].map(({ label, value, highlight }) => (
          <div key={label} className={`rounded-lg border px-4 py-3 text-center ${highlight ? "border-primary/30 bg-primary/5" : "border-slate-200 bg-slate-50"}`}>
            <p className={`text-lg font-bold ${highlight ? "text-primary" : "text-slate-800"}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}