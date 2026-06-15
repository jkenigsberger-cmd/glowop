import { useState } from "react";
import { Button } from "@/components/ui/button";

const SHIFT_OPTIONS = [
  { value: "MORNING", label: "בוקר" },
  { value: "EVENING", label: "ערב" },
  { value: "OTHER",   label: "אחר" },
];

function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function getIsraelTime() {
  // Returns HH:MM in Israel local time
  return new Date().toLocaleTimeString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).slice(0, 5);
}

function calcDuration(start, end) {
  if (!start || !end) return null;
  const startMins = timeToMinutes(start);
  const endMins = timeToMinutes(end);
  if (endMins === null || startMins === null) return null;
  return endMins - startMins;
}

function fmtMins(mins) {
  if (mins == null || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export default function CleaningShiftForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    date: initial?.date || new Date().toISOString().slice(0, 10),
    shift_type: initial?.shift_type || "MORNING",
    label: initial?.label || "",
    workers_count: initial?.workers_count || 1,
    start_time: initial?.start_time || getIsraelTime(),
    end_time: initial?.end_time || "",
    notes: initial?.notes || "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const perWorkerMins = calcDuration(form.start_time, form.end_time);
  const totalMins = perWorkerMins != null && perWorkerMins > 0
    ? perWorkerMins * Number(form.workers_count)
    : null;

  const handleSave = async () => {
    setError(null);
    if (!form.date) return setError("יש לבחור תאריך");
    if (!form.start_time) return setError("יש להזין שעת כניסה");
    if (!form.workers_count || Number(form.workers_count) < 1) return setError("יש להזין מספר עובדות");

    // Validate end_time only if provided
    if (form.end_time) {
      const dur = calcDuration(form.start_time, form.end_time);
      if (dur === null || dur <= 0) return setError("שעת יציאה חייבת להיות אחרי שעת כניסה");
    }

    const mins = form.end_time ? calcDuration(form.start_time, form.end_time) : null;
    const totalWorkerMins = mins != null && mins > 0 ? mins * Number(form.workers_count) : null;

    setSaving(true);
    await onSave({
      date: form.date,
      shift_type: form.shift_type,
      label: form.label || null,
      workers_count: Number(form.workers_count),
      start_time: form.start_time,
      end_time: form.end_time || null,
      minutes_per_worker: mins || null,
      total_worker_minutes: totalWorkerMins || null,
      notes: form.notes || null,
      status: "ACTIVE",
    });
    setSaving(false);
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-2 gap-3">
        {/* Worker name / label */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">עובדת / שם עובדת</label>
          <input
            type="text"
            value={form.label}
            onChange={e => set("label", e.target.value)}
            placeholder="שם העובדת..."
            className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background"
          />
        </div>
        {/* Date */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">תאריך</label>
          <input
            type="date"
            value={form.date}
            onChange={e => set("date", e.target.value)}
            className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Start time */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">שעת כניסה <span className="text-red-500">*</span></label>
          <input
            type="time"
            value={form.start_time}
            onChange={e => set("start_time", e.target.value)}
            className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background"
          />
        </div>
        {/* End time — optional */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">
            שעת יציאה <span className="text-slate-400 font-normal text-xs">(אופציונלי)</span>
          </label>
          <input
            type="time"
            value={form.end_time}
            onChange={e => set("end_time", e.target.value)}
            className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Workers count */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">מספר עובדות</label>
          <select
            value={form.workers_count}
            onChange={e => set("workers_count", e.target.value)}
            className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background"
          >
            {Array.from({ length: 15 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        {/* Shift type */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">משמרת</label>
          <select
            value={form.shift_type}
            onChange={e => set("shift_type", e.target.value)}
            className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background"
          >
            {SHIFT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Live calc preview — only when both times present */}
      {perWorkerMins != null && perWorkerMins > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-600">שעות לעובדת אחת:</span>
            <span className="font-semibold">{fmtMins(perWorkerMins)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">סה״כ שעות ({form.workers_count} עובדות):</span>
            <span className="font-bold text-primary">{fmtMins(totalMins)}</span>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">הערות</label>
        <textarea
          value={form.notes}
          onChange={e => set("notes", e.target.value)}
          rows={2}
          placeholder="הערות נוספות..."
          className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={saving}>ביטול</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? "שומר..." : "שמור"}</Button>
      </div>
    </div>
  );
}