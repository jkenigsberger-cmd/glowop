import { Button } from "@/components/ui/button";
import { dayOfWeekHe, fmtDate } from "@/lib/mealDuplication";

export default function PrisaDateSelector({ dates, takenDates, selectedDates, onToggle, onSelectAll, onBack, onConfirm, creating }) {
  const available = dates.filter((date) => !takenDates.has(date));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><p className="text-xs text-slate-500">בחר תאריכים להעתקת הפריסה:</p><Button size="sm" variant="ghost" onClick={onSelectAll}>{selectedDates.length === available.length ? "בטל בחירת הכל" : "בחר הכל"}</Button></div>
      <div className="max-h-64 overflow-y-auto space-y-1.5 border border-slate-100 rounded-lg p-2">
        {dates.map((date) => {
          const taken = takenDates.has(date);
          return <label key={date} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm ${taken ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"}`}>
            <input type="checkbox" className="w-4 h-4 accent-primary" disabled={taken} checked={!taken && selectedDates.includes(date)} onChange={() => !taken && onToggle(date)} />
            <span className="font-medium">{fmtDate(date)}</span><span className="text-xs text-slate-400">· יום {dayOfWeekHe(date)}</span>
            {taken && <span className="text-xs text-amber-600 mr-auto">כבר קיימת פריסה זהה</span>}
          </label>;
        })}
      </div>
      <div className="flex gap-2 justify-end"><Button variant="outline" size="sm" onClick={onBack}>חזרה</Button><Button size="sm" onClick={onConfirm} disabled={creating || selectedDates.length === 0}>{creating ? "יוצר..." : selectedDates.length ? `צור ${selectedDates.length} פריסות` : "לא נבחרו תאריכים"}</Button></div>
    </div>
  );
}