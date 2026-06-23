import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Modal for admin to approve or reject a Mechina booking request.
 * Props:
 *   open, onClose, onConfirm(adminNotes), mode: "approve" | "reject", request
 */
export default function MechinaDecisionModal({ open, onClose, onConfirm, mode, request }) {
  const [adminNotes, setAdminNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const isApprove = mode === "approve";

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(adminNotes.trim());
    setLoading(false);
    setAdminNotes("");
  };

  const handleClose = () => {
    if (loading) return;
    setAdminNotes("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md w-full" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {isApprove ? "אישור בקשת מרחב" : "דחיית בקשת מרחב"}
          </DialogTitle>
        </DialogHeader>

        {request && (
          <div className="bg-slate-50 rounded-lg px-4 py-3 space-y-1 text-sm text-slate-700">
            <p><span className="font-medium">פעילות:</span> {request.activity_title}</p>
            <p><span className="font-medium">מרחב:</span> {request.space_name}</p>
            <p><span className="font-medium">תאריך:</span> {request.date}</p>
            <p><span className="font-medium">שעות:</span> {request.start_time}–{request.end_time}</p>
            <p><span className="font-medium">פונה:</span> {request.requested_by_name || request.requested_by_email}</p>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">
            {isApprove ? "הערה לפונה (אופציונלי)" : "סיבת דחייה (מומלץ)"}
          </label>
          <textarea
            value={adminNotes}
            onChange={e => setAdminNotes(e.target.value)}
            placeholder={isApprove ? "הערות לפונה..." : "סיבת הדחייה..."}
            rows={3}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={handleClose} disabled={loading}>ביטול</Button>
          <Button
            className={`flex-1 ${isApprove ? "" : "bg-red-600 hover:bg-red-700"}`}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "מעבד..." : isApprove ? "אשר בקשה" : "דחה בקשה"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}