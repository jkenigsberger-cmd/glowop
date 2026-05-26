import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, X } from "lucide-react";
import CleaningShiftForm from "./CleaningShiftForm";
import { base44 } from "@/api/base44Client";

const SHIFT_LABELS = { MORNING: "בוקר", EVENING: "ערב", OTHER: "אחר" };

function fmtMins(mins) {
  if (!mins || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export default function CleaningShiftRow({ shift, canEdit, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    setCancelling(true);
    await base44.entities.CleaningWorkShift.update(shift.id, {
      status: "CANCELLED",
      notes: (shift.notes ? shift.notes + "\n" : "") + "בוטל ידנית",
    });
    onRefresh();
    setCancelling(false);
  };

  const handleSave = async (data) => {
    await base44.entities.CleaningWorkShift.update(shift.id, data);
    setEditing(false);
    onRefresh();
  };

  if (editing) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <CleaningShiftForm initial={shift} onSave={handleSave} onCancel={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-4 py-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-semibold text-slate-700">{SHIFT_LABELS[shift.shift_type]}</span>
        {shift.label && <span className="text-slate-500">— {shift.label}</span>}
        <span className="text-slate-600">{shift.workers_count} עובדות</span>
        <span className="text-slate-500">{shift.start_time}–{shift.end_time}</span>
        <span className="text-slate-600">לעובדת: <span className="font-medium">{fmtMins(shift.minutes_per_worker)}</span></span>
        <span className="text-primary font-semibold">סה״כ: {fmtMins(shift.total_worker_minutes)}</span>
        {shift.notes && <span className="text-slate-400 text-xs">({shift.notes})</span>}
      </div>
      {canEdit && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="gap-1 h-7 px-2">
            <Pencil className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={cancelling} className="gap-1 h-7 px-2 text-red-500 hover:text-red-700">
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}