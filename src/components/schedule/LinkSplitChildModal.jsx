/**
 * LinkSplitChildModal — link ONE split child item to additional groups
 * (safest MVP scope: only the selected split space is shared; siblings are untouched).
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Users } from "lucide-react";
import SharedGroupSelector from "./SharedGroupSelector";

export default function LinkSplitChildModal({ item, spaceName, onSave, onClose, saving }) {
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setError("");
    if (groups.length === 0) {
      setError("יש לבחור לפחות קבוצה אחת לשיוך");
      return;
    }
    setSubmitting(true);
    const err = await onSave({ ...item, extra_group_ids: groups.map(g => g.id) });
    setSubmitting(false);
    if (err) setError(err);
    else onClose();
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-violet-600" /> שיוך מרחב מפוצל לקבוצות נוספות
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 text-xs text-violet-700 space-y-0.5">
            <p className="font-semibold">{item.activity_name} — {spaceName || "ללא מרחב"}</p>
            <p>{item.date} · {item.start_time}–{item.end_time}</p>
            <p className="text-violet-500">
              השיוך יחול רק על המרחב הזה מתוך הפעילות המפוצלת. שאר המרחבים לא ישויכו.
            </p>
          </div>

          <SharedGroupSelector
            currentGroupId={item.group_id}
            selectedGroups={groups}
            onChange={setGroups}
          />

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>ביטול</Button>
          <Button onClick={handleConfirm} disabled={submitting || saving} className="bg-violet-600 hover:bg-violet-700">
            {submitting ? "משייך..." : "שייך קבוצות"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}