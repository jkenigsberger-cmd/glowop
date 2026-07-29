import { Button } from "@/components/ui/button";
import { CalendarDays, Check, X } from "lucide-react";

export default function PrisaCopyChoose({ availableCount, candidateCount, hasStayDates, onAll, onSelect, onClose }) {
  if (!hasStayDates) return <div className="py-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3">חסרים תאריכי שהייה לקבוצה — לא ניתן להעתיק לכל השהייה</div>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">הפריסה נשמרה בהצלחה. האם להעתיק אותה לתאריכים נוספים במהלך שהיית הקבוצה?</p>
      <div className="space-y-2">
        <Button onClick={onAll} disabled={availableCount === 0} className="w-full justify-start gap-2">
          <CalendarDays className="w-4 h-4" /> כן, לכל תאריכי השהייה <span className="text-xs opacity-80">({availableCount})</span>
        </Button>
        <Button variant="outline" onClick={onSelect} disabled={candidateCount === 0} className="w-full justify-start gap-2">
          <Check className="w-4 h-4" /> בחירת תאריכים
        </Button>
        <Button variant="ghost" onClick={onClose} className="w-full justify-start gap-2 text-slate-500"><X className="w-4 h-4" /> לא, רק התאריך הזה</Button>
      </div>
      {availableCount === 0 && candidateCount > 0 && <p className="text-xs text-slate-400">בכל תאריכי השהייה כבר קיימת פריסה זהה.</p>}
    </div>
  );
}