import { useState } from "react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Strong confirmation dialog shown when approving a quote that exceeds capacity.
 *
 * Props:
 *   warnings: array of warning objects from checkSiteAvailability
 *   onConfirm(overrideReason): called when admin proceeds
 *   onCancel(): called when admin cancels
 */
export default function ApprovalCapacityDialog({ warnings, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");

  return (
    <AlertDialog open>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="w-5 h-5" />
            אזהרת קיבולת — אישור הצעה
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p className="text-sm text-slate-700 font-medium">
                אישור הצעה זו יעבור את הקיבולת המוגדרת:
              </p>
              <div className="space-y-1.5">
                {warnings.map((w, i) => (
                  <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                    {w.message}
                  </div>
                ))}
              </div>
              <div className="space-y-1 pt-1">
                <Label className="text-xs text-slate-600">סיבת החריגה (לא חובה)</Label>
                <Input
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="לדוגמה: אישור מיוחד ממנהל..."
                  className="text-sm"
                />
              </div>
              <p className="text-xs text-slate-400">
                ניתן להמשיך — החריגה תתועד ב-Operational Hold.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>ביטול</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(reason)}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            אשר בכל זאת
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}