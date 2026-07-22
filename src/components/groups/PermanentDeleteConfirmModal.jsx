import { Button } from "@/components/ui/button";

export default function PermanentDeleteConfirmModal({ loading, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" dir="rtl">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div>
          <h2 className="font-heading text-base font-bold text-foreground">מחיקת קבוצה</h2>
          <p className="mt-1 text-sm text-muted-foreground">האם למחוק את הקבוצה וכל המידע המקושר אליה?</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>ביטול</Button>
          <Button variant="destructive" size="sm" onClick={onConfirm} disabled={loading}>{loading ? "מוחק..." : "מחיקה"}</Button>
        </div>
      </div>
    </div>
  );
}