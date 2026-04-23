import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const WORKING_STATUSES = [
  { value: "WORKING", label: "תקין" },
  { value: "BROKEN", label: "תקול" },
  { value: "MAINTENANCE", label: "תחזוקה" },
  { value: "CLOSED", label: "סגור" },
];

const BED_STATUSES = [
  { value: "FREE", label: "פנוי" },
  { value: "RESERVED", label: "שמור" },
  { value: "OCCUPIED", label: "תפוס" },
  { value: "BLOCKED", label: "חסום" },
];

export default function EditStatusModal({ open, onClose, entity, entityType, onSave }) {
  const [workingStatus, setWorkingStatus] = useState(entity?.working_status || "WORKING");
  const [bedStatus, setBedStatus] = useState(entity?.bed_status || "FREE");
  const [notes, setNotes] = useState(entity?.notes || "");
  const [saving, setSaving] = useState(false);

  const isBed = entityType === "bed";

  const handleSave = async () => {
    setSaving(true);
    const updates = { working_status: workingStatus, notes };
    if (isBed) updates.bed_status = bedStatus;
    await onSave(entity.id, updates);
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">עריכת סטטוס — {entity?.label || entity?.code || entity?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>סטטוס תפעולי</Label>
            <Select value={workingStatus} onValueChange={setWorkingStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORKING_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isBed && (
            <div className="space-y-1.5">
              <Label>סטטוס מיטה</Label>
              <Select value={bedStatus} onValueChange={setBedStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BED_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>הערות</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות אופציונליות..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>ביטול</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "שומר..." : "שמור"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}