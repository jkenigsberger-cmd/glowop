import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function PermanentDeleteConfirmModal({ groupName, loading, onCancel, onConfirm }) {
  const [typedName, setTypedName] = useState("");
  const matches = typedName === groupName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" dir="rtl">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-red-200 bg-card p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-lg bg-red-100 p-2"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
          <div>
            <h2 className="font-heading text-base font-bold text-foreground">מחיקה מוחלטת ובלתי הפיכה</h2>
            <p className="mt-1 text-sm text-muted-foreground">הקבוצה, הצעת המחיר, אפשרויות המחיר, הנתונים הכספיים וכל המידע התפעולי המקושר יימחקו לצמיתות.</p>
          </div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">פעולה זו שונה מביטול או ארכוב ואינה ניתנת לשחזור.</div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">כדי לאשר, הקלד את שם הקבוצה: <span className="select-all">{groupName}</span></label>
          <Input value={typedName} onChange={(event) => setTypedName(event.target.value)} disabled={loading} autoFocus />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>ביטול</Button>
          <Button variant="destructive" size="sm" onClick={() => onConfirm(typedName)} disabled={loading || !matches}>{loading ? "מוחק..." : "מחק קבוצה והצעה לצמיתות"}</Button>
        </div>
      </div>
    </div>
  );
}