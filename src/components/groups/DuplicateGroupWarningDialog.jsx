import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const statusLabels = {
  DRAFT: "בהכנה", PENDING_APPROVAL: "בהכנה", CONFIRMED: "מאושר",
  COMPLETED: "הסתיים", ARCHIVED: "מוקפא", CANCELLED: "מבוטל",
};

const formatDate = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString("he-IL") : "—";

export default function DuplicateGroupWarningDialog({ candidates, saving, onOpen, onOverride, onClose }) {
  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader><DialogTitle className="text-right text-amber-800">⚠️ ייתכן שהקבוצה כבר קיימת</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">נמצאו קבוצות עם פרטי הזמנה דומים. מומלץ לפתוח את הקבוצה הקיימת לפני יצירת קבוצה נוספת.</p>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {candidates.map(candidate => (
            <div key={candidate.group_id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="font-semibold text-foreground">{candidate.group_name}</p>
              <p>{formatDate(candidate.arrival_date)} — {formatDate(candidate.departure_date)}</p>
              <p>{candidate.total_pax ?? "—"} משתתפים · סטטוס: {statusLabels[candidate.status] || candidate.status}</p>
              {candidate.quote_linked && <p className="font-semibold text-primary">מקור: הצעת מחיר</p>}
              <Button type="button" size="sm" className="mt-2" onClick={() => onOpen(candidate.group_id)}>פתח קבוצה קיימת</Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>חזרה לעריכה</Button>
          <Button type="button" variant="destructive" onClick={onOverride} disabled={saving}>{saving ? "יוצר..." : "צור קבוצה חדשה בכל זאת"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}