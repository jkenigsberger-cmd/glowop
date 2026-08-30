import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function SpaceDeactivationDialog({ space, defaultStartDate, saving, onClose, onSubmit }) {
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setStartDate(defaultStartDate);
    setEndDate("");
    setError("");
  }, [space?.id, defaultStartDate]);

  const submit = event => {
    event.preventDefault();
    if (endDate && endDate < startDate) return setError("תאריך הסיום חייב להיות אחרי תאריך ההתחלה");
    onSubmit({ start_date: startDate, end_date: endDate });
  };

  return (
    <Dialog open={!!space} onOpenChange={open => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader><DialogTitle className="text-right">השבת מרחב — {space?.name}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1 text-sm"><span>מתאריך</span><input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full rounded-lg border px-3 py-2" /></label>
          <label className="block space-y-1 text-sm"><span>עד תאריך — אופציונלי</span><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full rounded-lg border px-3 py-2" /></label>
          {!endDate && <p className="text-xs text-slate-500">ללא תאריך סיום: עד להודעה חדשה</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>ביטול</Button><Button type="submit" disabled={saving}>{saving ? "שומר..." : "השבת מרחב"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}