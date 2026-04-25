import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";

const emptyRow = () => ({
  date: "", start_time: "", end_time: "",
  activity: "", location: "", pax: "", notes: "",
});

function ScheduleRow({ row, idx, onChange, onRemove }) {
  const set = (k, v) => onChange(idx, { ...row, [k]: v });
  return (
    <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">פעילות {idx + 1}</span>
        <button type="button" onClick={() => onRemove(idx)} className="text-slate-400 hover:text-red-500 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-0.5">
          <div className="text-[10px] text-slate-400">תאריך</div>
          <Input type="date" value={row.date} onChange={e => set("date", e.target.value)} className="text-xs h-8" />
        </div>
        <div className="space-y-0.5">
          <div className="text-[10px] text-slate-400">שעת התחלה</div>
          <Input type="time" value={row.start_time} onChange={e => set("start_time", e.target.value)} className="text-xs h-8" />
        </div>
        <div className="space-y-0.5">
          <div className="text-[10px] text-slate-400">שעת סיום</div>
          <Input type="time" value={row.end_time} onChange={e => set("end_time", e.target.value)} className="text-xs h-8" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <div className="text-[10px] text-slate-400">פעילות / אירוע</div>
          <Input value={row.activity} onChange={e => set("activity", e.target.value)} placeholder="שם הפעילות" className="text-xs h-8" />
        </div>
        <div className="space-y-0.5">
          <div className="text-[10px] text-slate-400">מיקום</div>
          <Input value={row.location} onChange={e => set("location", e.target.value)} placeholder="אולם, חוץ..." className="text-xs h-8" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-0.5">
          <div className="text-[10px] text-slate-400">מס׳ משתתפים</div>
          <Input type="number" min="0" value={row.pax} onChange={e => set("pax", e.target.value)} className="text-xs h-8" />
        </div>
        <div className="space-y-0.5">
          <div className="text-[10px] text-slate-400">הערות</div>
          <Input value={row.notes} onChange={e => set("notes", e.target.value)} placeholder="בקשות, ציוד..." className="text-xs h-8" />
        </div>
      </div>
    </div>
  );
}

export default function GuestFormStep4({ rows, setRows, quoteData }) {
  const addRow = () => {
    const defaultDate = quoteData?.arrival_date || "";
    setRows(r => [...r, { ...emptyRow(), date: defaultDate }]);
  };

  const updateRow = (idx, updated) => {
    setRows(r => r.map((row, i) => i === idx ? updated : row));
  };

  const removeRow = (idx) => {
    setRows(r => r.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        הוסיפו את הפעילויות המתוכננות לפי סדר. ניתן להשאיר ריק אם לוח הזמנים עדיין לא סגור.
      </p>

      {rows.length === 0 && (
        <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-300 rounded-xl">
          לא נוספו פעילויות עדיין
        </div>
      )}

      {rows.map((row, idx) => (
        <ScheduleRow key={idx} row={row} idx={idx} onChange={updateRow} onRemove={removeRow} />
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addRow}
        className="w-full gap-2 text-sm"
      >
        <Plus className="w-4 h-4" /> הוספת פעילות
      </Button>
    </div>
  );
}