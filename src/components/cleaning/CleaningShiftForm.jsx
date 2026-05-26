import { useState } from "react";
import { Button } from "@/components/ui/button";

const SHIFT_OPTIONS = [
  { value: "MORNING", label: "בוקר" },
  { value: "EVENING", label: "ערב" },
  { value: "OTHER",   label: "אחר" },
];

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

const EMPTY = {
  date: new Date().toISOString().slice(0, 10),
  shift_type: "MORNING",
  label: "",
  workers_count: 2,
  start_time: "",
  end_time: "",
  notes: "",
};

export default function CleaningShiftForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial ? {
    date: initial.date || EMPTY.date,
    shift_type: initial.shift_type || EMPTY.shift_type,
    label: initial.label || "",
    workers_count: initial.workers_count || 2,
    start_time: initial.start_time || "",
    end_time: initial.end_time || "",
    notes: initial.notes || "",
  } : { ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const durationMinutes = () => {
    if (!form.start_time || !form.end_time) return null;
    return timeToMinutes(form.end_time) - timeToMinutes(form.start_time);
  };

  const fmt = (mins) => {
    if (mins == null || mins <= 0) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}:${String(m).padStart(2, "0")}`;
  };

  const perWorker = durationMinutes();
  const total = perWorker != null && perWorker > 0 ? perWorker * Number(form.workers_count) : null;

  const handleSave = async () => {
    setError(null);
    if (!form.date) return setError("יש לבחור תאריך");
    if (!form.shift_type) return setError("יש לבחור משמרת");
    if (!form.workers_count || Number(form.workers_count) < 1) return setError("יש להזין מספר עובדות");
    if (!form.start_time) return setError("יש להזין שעת התחלה");
    if (!form.end_time) return setError("יש להזין שעת סיום");
    const dur = durationMinutes();
    if (dur == null || dur <= 0) return setError("שעת הסיום חייבת להיות אחרי שעת ההתחלה");

    const mins = dur;
    const totalMins = mins * Number(form.workers_count);

    setSaving(true);
    await onSave({
      date: form.date,
      shift_type: form.shift_type,
      label: form.label || null,
      workers_count: Number(form.workers_count),
      start_time: form.start_time,
      end_time: form.end_time,
      minutes_per_worker: mins,
      total_worker_minutes: totalMins,
      notes: form.notes || null,
      status: "ACTIVE",
    });
    setSaving(false);
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="grid grid-cols-2 gap-3">
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
        {/* Shift */}
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

      <div className="grid grid-cols-2 gap-3">
        {/* Workers */}
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
        {/* Label */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">תווית (אופציונלי)</label>
          <input
            type="text"
            value={form.label}
            onChange={e => set("label", e.target.value)}
            placeholder="צוות ראשון..."
            className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">שעת התחלה</label>
          <input
            type="time"
            value={form.start_time}
            onChange={e => set("start_time", e.target.value)}
            className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">שעת סיום</label>
          <input
            type="time"
            value={form.end_time}
            onChange={e => set("end_time", e.target.value)}
            className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background"
          />
        </div>
      </div>

      {/* Live calc preview */}
      {perWorker != null && perWorker > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-600">שעות לעובדת אחת:</span>
            <span className="font-semibold">{fmt(perWorker)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">סה״כ שעות עבודה ({form.workers_count} עובדות):</span>
            <span className="font-bold text-primary">{fmt(total)}</span>
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