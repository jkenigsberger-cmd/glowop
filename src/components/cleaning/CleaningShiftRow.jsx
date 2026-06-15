import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, X, CheckCircle } from "lucide-react";
import CleaningShiftForm from "./CleaningShiftForm";
import { base44 } from "@/api/base44Client";

const SHIFT_LABELS = { MORNING: "בוקר", EVENING: "ערב", OTHER: "אחר" };

function fmtMins(mins) {
  if (!mins || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function getIsraelTime() {
  return new Date().toLocaleTimeString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).slice(0, 5);
}

function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Inline "end shift" modal
function EndShiftModal({ shift, onSave, onCancel }) {
  const [endTime, setEndTime] = useState(getIsraelTime());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    setError(null);
    if (!endTime) return setError("יש להזין שעת יציאה");
    const startMins = timeToMinutes(shift.start_time);
    const endMins = timeToMinutes(endTime);
    if (endMins <= startMins) return setError("שעת יציאה חייבת להיות אחרי שעת כניסה");

    const mins = endMins - startMins;
    const totalMins = mins * Number(shift.workers_count);

    setSaving(true);
    await onSave({
      end_time: endTime,
      minutes_per_worker: mins,
      total_worker_minutes: totalMins,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
      <div className="bg-white rounded-xl shadow-xl w-80 p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800">סיום משמרת</h3>
        {shift.label && <p className="text-xs text-slate-500">עובדת: {shift.label}</p>}
        <p className="text-xs text-slate-500">שעת כניסה: {shift.start_time}</p>
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">שעת יציאה</label>
          <input
            type="time"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-background"
            autoFocus
          />
        </div>
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</p>
        )}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>ביטול</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "שומר..." : "שמור"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CleaningShiftRow({ shift, canEdit, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [endingShift, setEndingShift] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Derive open/closed from data
  const isOpen = !!shift.start_time && !shift.end_time;

  const handleCancel = async () => {
    setCancelling(true);
    await base44.entities.CleaningWorkShift.update(shift.id, {
      status: "CANCELLED",
      notes: (shift.notes ? shift.notes + "\n" : "") + "בוטל ידנית",
    });
    onRefresh();
    setCancelling(false);
  };

  const handleEditSave = async (data) => {
    // If end_time was cleared, recalculate/clear duration fields
    const updatedData = { ...data };
    if (!updatedData.end_time) {
      updatedData.end_time = null;
      updatedData.minutes_per_worker = null;
      updatedData.total_worker_minutes = null;
    }
    await base44.entities.CleaningWorkShift.update(shift.id, updatedData);
    setEditing(false);
    onRefresh();
  };

  const handleEndShift = async (data) => {
    await base44.entities.CleaningWorkShift.update(shift.id, data);
    setEndingShift(false);
    onRefresh();
  };

  if (editing) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <CleaningShiftForm initial={shift} onSave={handleEditSave} onCancel={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <>
      <div className={`flex items-center justify-between gap-2 rounded-lg px-4 py-3 border ${
        isOpen ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"
      }`}>
        <div className="flex flex-wrap items-center gap-3 text-sm min-w-0">
          {/* Worker name */}
          {shift.label && (
            <span className="font-semibold text-slate-800">{shift.label}</span>
          )}
          <span className="text-slate-500 text-xs">{SHIFT_LABELS[shift.shift_type]}</span>
          {shift.workers_count > 1 && (
            <span className="text-slate-500 text-xs">{shift.workers_count} עובדות</span>
          )}

          {/* Times */}
          <span className="text-slate-600">
            כניסה: <span className="font-medium">{shift.start_time}</span>
          </span>
          {shift.end_time ? (
            <span className="text-slate-600">
              יציאה: <span className="font-medium">{shift.end_time}</span>
            </span>
          ) : null}

          {/* Status badge */}
          {isOpen ? (
            <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5 font-medium">
              פתוחה
            </span>
          ) : (
            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 font-medium">
              סגורה
            </span>
          )}

          {/* Total hours */}
          <span className="text-primary font-semibold text-xs">
            סה״כ שעות: {isOpen ? "—" : fmtMins(shift.total_worker_minutes)}
          </span>

          {shift.notes && <span className="text-slate-400 text-xs">({shift.notes})</span>}
        </div>

        {canEdit && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* End shift button — only for open shifts */}
            {isOpen && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEndingShift(true)}
                className="gap-1 h-7 px-2 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                <CheckCircle className="w-3 h-3" />
                סיום משמרת
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="gap-1 h-7 px-2">
              <Pencil className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={cancelling}
              className="gap-1 h-7 px-2 text-red-500 hover:text-red-700"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {endingShift && (
        <EndShiftModal
          shift={shift}
          onSave={handleEndShift}
          onCancel={() => setEndingShift(false)}
        />
      )}
    </>
  );
}