import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Check, X, MapPin } from "lucide-react";

const LOCATION_OPTIONS = ["כיתה", "מתחם חוץ", "מחוץ לחווה", "אחר"];

export default function ScheduleItemRow({ item, activitySpaces, onSave, onCancel, saving }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...item });
  const [error, setError] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setError(null);
    const err = await onSave(form);
    if (err) { setError(err); return; }
    setEditing(false);
  };

  const handleCancel = () => {
    setForm({ ...item });
    setEditing(false);
    setError(null);
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
            <label className="text-xs text-slate-500">שם פעילות</label>
            <Input value={form.activity_name} onChange={e => set("activity_name", e.target.value)} placeholder="שם הפעילות" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">שעת התחלה</label>
            <Input type="time" value={form.start_time} onChange={e => set("start_time", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">שעת סיום</label>
            <Input type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">מיקום מבוקש (לקוח)</label>
            <Select value={form.requested_location || ""} onValueChange={v => set("requested_location", v)}>
              <SelectTrigger><SelectValue placeholder="בחר..." /></SelectTrigger>
              <SelectContent>
                {LOCATION_OPTIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">מרחב פעילות פנימי (אופציונלי)</label>
            <Select
              value={form.activity_space_id || "none"}
              onValueChange={v => set("activity_space_id", v === "none" ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="לא הוקצה" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— לא הוקצה —</SelectItem>
                {activitySpaces.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">משתתפים</label>
            <Input type="number" min="0" value={form.pax || ""} onChange={e => set("pax", e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">הערות</label>
            <Input value={form.notes || ""} onChange={e => set("notes", e.target.value)} placeholder="הערות..." />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

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

  const space = activitySpaces.find(s => s.id === item.activity_space_id);

  return (
    <div className={`bg-card border rounded-xl px-4 py-3 flex items-start gap-3 ${item.status === "CANCELLED" ? "opacity-50" : "border-border"}`}>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{item.activity_name}</span>
          {item.source === "manual" && (
            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5">ידני</span>
          )}
          {item.status === "CANCELLED" && (
            <span className="text-xs bg-red-50 text-red-600 border border-red-200 rounded px-1.5 py-0.5">בוטל</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {item.date} · {item.start_time}–{item.end_time}
          {item.pax ? ` · ${item.pax} משתתפים` : ""}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {item.requested_location && (
            <span>📍 {item.requested_location}</span>
          )}
          {space && (
            <span className="flex items-center gap-1 text-primary font-medium">
              <MapPin className="w-3 h-3" /> {space.name}
            </span>
          )}
        </div>
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