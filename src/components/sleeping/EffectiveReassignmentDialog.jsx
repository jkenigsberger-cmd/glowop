import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function EffectiveReassignmentDialog({ allocation, tents, today, onClose, onSaved }) {
  const [date, setDate] = useState(today > allocation.arrival_date ? today : allocation.arrival_date);
  const [tentId, setTentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setSaving(true); setError("");
    try {
      const res = await base44.functions.invoke("reassignSleepingAllocation", { allocation_id: allocation.id, group_id: allocation.group_id, destination_tent_id: tentId, effective_date: date });
      if (!res.data?.success) throw new Error(res.data?.error || "השינוי נכשל");
      onSaved();
    } catch (err) { setError(err?.response?.data?.error || err.message); }
    finally { setSaving(false); }
  };
  return <Dialog open onOpenChange={onClose}><DialogContent className="max-w-sm" dir="rtl"><DialogHeader><DialogTitle>שינוי מקום לינה</DialogTitle></DialogHeader>
    <label className="text-xs font-semibold">החל מתאריך</label><Input type="date" min={allocation.arrival_date} max={allocation.departure_date} value={date} onChange={e => setDate(e.target.value)} />
    <label className="text-xs font-semibold">אוהל חדש</label><select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={tentId} onChange={e => setTentId(e.target.value)}><option value="">בחר אוהל</option>{tents.filter(t => t.id !== allocation.tent_id).map(t => <option key={t.id} value={t.id}>{t.code}</option>)}</select>
    {error && <p className="text-xs text-red-600">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>ביטול</Button><Button disabled={saving || !tentId || !(allocation.arrival_date <= date && date < allocation.departure_date)} onClick={save}>{saving ? "שומר..." : "שמור שינוי"}</Button></div>
  </DialogContent></Dialog>;
}