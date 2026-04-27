import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Check, X } from "lucide-react";

const MEAL_LABELS = { BREAKFAST: "ארוחת בוקר", LUNCH: "ארוחת צהריים", DINNER: "ארוחת ערב", OTHER: "אחר" };
const MEAL_DURATIONS = { BREAKFAST: 60, LUNCH: 90, DINNER: 90, OTHER: 60 };

function addMinutes(timeStr, mins) {
  const [h, m] = (timeStr || "08:00").split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function MealReservationRow({ item, onSave, onCancel, saving }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...item });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleMealTypeChange = (v) => {
    const duration = MEAL_DURATIONS[v] || 60;
    const newEnd = addMinutes(form.start_time, duration);
    setForm(f => ({ ...f, meal_type: v, end_time: newEnd }));
  };

  const handleStartChange = (v) => {
    const duration = MEAL_DURATIONS[form.meal_type] || 60;
    setForm(f => ({ ...f, start_time: v, end_time: addMinutes(v, duration) }));
  };

  const handleSave = async () => {
    await onSave(form);
    setEditing(false);
  };

  const handleCancel = () => {
    setForm({ ...item });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-slate-50 border border-primary/30 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-500">תאריך</label>
            <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">סוג ארוחה</label>
            <Select value={form.meal_type} onValueChange={handleMealTypeChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(MEAL_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">שעת התחלה</label>
            <Input type="time" value={form.start_time} onChange={e => handleStartChange(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">שעת סיום</label>
            <Input type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">מספר אנשים</label>
            <Input type="number" min="0" value={form.pax || ""} onChange={e => set("pax", e.target.value)} />
          </div>
          <div className="space-y-1 flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id={`sandwich-${item.id}`}
              checked={!!form.sandwich_option}
              onChange={e => set("sandwich_option", e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor={`sandwich-${item.id}`} className="text-xs text-slate-600">כריכים במקום ארוחה חמה</label>
          </div>
          <div className="space-y-1 col-span-2">
            <label className="text-xs text-slate-500">הערות למטבח</label>
            <Input value={form.notes || ""} onChange={e => set("notes", e.target.value)} placeholder="הערות..." />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={handleCancel} className="gap-1">
            <X className="w-3.5 h-3.5" /> ביטול
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
            <Check className="w-3.5 h-3.5" /> {saving ? "שומר..." : "שמור"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card border rounded-xl px-4 py-3 flex items-start gap-3 ${item.status === "CANCELLED" ? "opacity-50" : "border-border"}`}>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{MEAL_LABELS[item.meal_type] || item.meal_type}</span>
          {item.sandwich_option && (
            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5">🥪 כריכים</span>
          )}
          {item.source === "manual" && (
            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5">ידני</span>
          )}
          {item.status === "CANCELLED" && (
            <span className="text-xs bg-red-50 text-red-600 border border-red-200 rounded px-1.5">בוטל</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {item.date} · {item.start_time}–{item.end_time} · {item.pax} אנשים
        </p>
        {item.notes && <p className="text-xs text-muted-foreground italic">{item.notes}</p>}
      </div>
      {item.status !== "CANCELLED" && (
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7 w-7 p-0">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onCancel(item.id)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}