import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BLOCK_REASON_LABELS } from "@/lib/activitySpaceBlocks";

const empty = { activity_space_id: "", start_date: "", end_date: "", start_time: "08:00", end_time: "18:00", reason_type: "MAINTENANCE", reason_notes: "" };

export default function SpaceBlockForm({ spaces, initial, saving, onSubmit, onClose }) {
  const [form, setForm] = useState(initial || empty);
  useEffect(() => setForm(initial || empty), [initial]);
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  return (
    <form onSubmit={event => { event.preventDefault(); onSubmit(form); }} className="border border-slate-200 rounded-xl bg-white p-4 space-y-4" dir="rtl">
      <h3 className="font-semibold text-slate-800">{initial ? "עריכת חסימה" : "חסימת מרחב חדשה"}</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="text-sm space-y-1"><span>מרחב</span><select required value={form.activity_space_id} onChange={e => set("activity_space_id", e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-white"><option value="">בחר מרחב...</option>{spaces.map(space => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
        <label className="text-sm space-y-1"><span>תאריך התחלה</span><input required type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} className="w-full border rounded-lg px-3 py-2" /></label>
        <label className="text-sm space-y-1"><span>תאריך סיום</span><input required type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} className="w-full border rounded-lg px-3 py-2" /></label>
        <label className="text-sm space-y-1"><span>שעת התחלה</span><input required type="time" value={form.start_time} onChange={e => set("start_time", e.target.value)} className="w-full border rounded-lg px-3 py-2" /></label>
        <label className="text-sm space-y-1"><span>שעת סיום</span><input required type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)} className="w-full border rounded-lg px-3 py-2" /></label>
        <label className="text-sm space-y-1"><span>סיבה</span><select value={form.reason_type} onChange={e => set("reason_type", e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-white">{Object.entries(BLOCK_REASON_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <label className="text-sm space-y-1 block"><span>הערות</span><textarea value={form.reason_notes || ""} onChange={e => set("reason_notes", e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2 resize-none" /></label>
      <div className="flex gap-2 justify-end"><Button type="button" variant="outline" onClick={onClose}>ביטול</Button><Button type="submit" disabled={saving}>{saving ? "שומר..." : "חסום מרחב"}</Button></div>
    </form>
  );
}