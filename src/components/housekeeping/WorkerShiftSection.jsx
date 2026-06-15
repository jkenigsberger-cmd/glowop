import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCheck, Plus, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

const TODAY = new Date().toISOString().slice(0, 10);

function getNowTimeIsrael() {
  return new Date().toLocaleTimeString("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function calcDuration(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return mins > 0 ? mins : null;
}

function formatDuration(mins) {
  if (!mins || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} דק׳`;
  if (m === 0) return `${h} שע׳`;
  return `${h}:${String(m).padStart(2, "0")} שע׳`;
}

// ── Start Shift Modal ──────────────────────────────────────────────────────────
function StartShiftModal({ workers, todayShifts, onClose, onSaved }) {
  const [workerId, setWorkerId] = useState("");
  const [date, setDate] = useState(TODAY);
  const [startTime, setStartTime] = useState(getNowTimeIsrael());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedWorker = workers.find(w => w.id === workerId);

  // Check if this worker already has an open shift today
  const existingOpen = useMemo(() => {
    if (!workerId || !date) return null;
    return todayShifts.find(s => s.worker_id === workerId && s.date === date && s.status === "OPEN");
  }, [workerId, date, todayShifts]);

  const handleSave = async () => {
    if (!workerId) { setError("יש לבחור עובדת"); return; }
    if (!startTime) { setError("יש להזין שעת כניסה"); return; }
    if (existingOpen) { setError("לעובדת זו כבר יש משמרת פתוחה ביום זה"); return; }
    setSaving(true);
    setError("");
    const user = await base44.auth.me();
    await base44.entities.HousekeepingShift.create({
      worker_id: workerId,
      worker_name: selectedWorker?.name || "",
      date,
      start_time: startTime,
      status: "OPEN",
      start_notes: notes || undefined,
      created_by: user?.email || undefined,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">התחלת משמרת</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>עובדת *</Label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger><SelectValue placeholder="בחר עובדת..." /></SelectTrigger>
              <SelectContent>
                {workers.filter(w => w.active !== false).map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {existingOpen && (
            <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
              ⚠️ לעובדת זו יש משמרת פתוחה מ-{existingOpen.start_time} — ניתן לסגור אותה מהרשימה
            </div>
          )}

          <div className="space-y-1">
            <Label>תאריך</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>שעת כניסה</Label>
            <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>הערות</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="הערות אופציונלי..." />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
        </div>

        <div className="flex gap-2 pt-1">
          <Button onClick={handleSave} disabled={saving || !!existingOpen} className="flex-1">
            {saving ? "שומר..." : "פתח משמרת"}
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">ביטול</Button>
        </div>
      </div>
    </div>
  );
}

// ── End Shift Modal ────────────────────────────────────────────────────────────
function EndShiftModal({ shift, onClose, onSaved }) {
  const [endTime, setEndTime] = useState(getNowTimeIsrael());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!endTime) { setError("יש להזין שעת יציאה"); return; }
    const dur = calcDuration(shift.start_time, endTime);
    if (dur === null) { setError("שעת יציאה חייבת להיות אחרי שעת כניסה"); return; }
    setSaving(true);
    setError("");
    const user = await base44.auth.me();
    await base44.entities.HousekeepingShift.update(shift.id, {
      end_time: endTime,
      status: "CLOSED",
      duration_minutes: dur,
      end_notes: notes || undefined,
      closed_by: user?.email || undefined,
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">סיום משמרת</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="bg-slate-50 rounded-lg px-3 py-2 text-sm">
          <span className="text-slate-500">עובדת: </span>
          <span className="font-semibold text-slate-800">{shift.worker_name}</span>
          <span className="text-slate-400 mr-3">כניסה: {shift.start_time}</span>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>שעת יציאה</Label>
            <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>הערות סיום</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="הערות אופציונלי..." />
          </div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
        </div>

        <div className="flex gap-2 pt-1">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? "שומר..." : "סגור משמרת"}
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">ביטול</Button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Shift Modal ───────────────────────────────────────────────────────────
function EditShiftModal({ shift, onClose, onSaved }) {
  const [startTime, setStartTime] = useState(shift.start_time || "");
  const [endTime, setEndTime] = useState(shift.end_time || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!startTime) { setError("יש להזין שעת כניסה"); return; }
    if (endTime) {
      const dur = calcDuration(startTime, endTime);
      if (dur === null) { setError("שעת יציאה חייבת להיות אחרי שעת כניסה"); return; }
      setSaving(true);
      setError("");
      await base44.entities.HousekeepingShift.update(shift.id, {
        start_time: startTime,
        end_time: endTime,
        duration_minutes: dur,
      });
    } else {
      setSaving(true);
      setError("");
      await base44.entities.HousekeepingShift.update(shift.id, {
        start_time: startTime,
        end_time: null,
        duration_minutes: null,
        status: "OPEN",
      });
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">עריכת משמרת — {shift.worker_name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>שעת כניסה</Label>
            <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>שעת יציאה</Label>
            <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            <p className="text-[11px] text-slate-400">ריק = השאר משמרת פתוחה</p>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
        </div>

        <div className="flex gap-2 pt-1">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? "שומר..." : "שמור שינויים"}
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">ביטול</Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Section ───────────────────────────────────────────────────────────────
export default function WorkerShiftSection({ date }) {
  const queryClient = useQueryClient();
  const [showStart, setShowStart] = useState(false);
  const [endingShift, setEndingShift] = useState(null);
  const [editingShift, setEditingShift] = useState(null);

  const { data: workers = [] } = useQuery({
    queryKey: ["housekeepingWorkers"],
    queryFn: () => base44.entities.HousekeepingWorker.list(),
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ["housekeepingShifts", date],
    queryFn: () => base44.entities.HousekeepingShift.filter({ date }),
    enabled: !!date,
  });

  // Also load today's shifts for duplicate check in start modal
  const { data: todayShifts = [] } = useQuery({
    queryKey: ["housekeepingShifts", TODAY],
    queryFn: () => base44.entities.HousekeepingShift.filter({ date: TODAY }),
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["housekeepingShifts", date] });
    queryClient.invalidateQueries({ queryKey: ["housekeepingShifts", TODAY] });
  };

  const sorted = [...shifts].sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-semibold text-slate-700">משמרות עובדות — {date}</span>
          {shifts.length > 0 && (
            <span className="text-xs bg-slate-200 text-slate-600 rounded-full px-2 py-0.5">{shifts.length}</span>
          )}
        </div>
        <Button size="sm" onClick={() => setShowStart(true)} className="gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" /> התחלת משמרת
        </Button>
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-400">
          אין משמרות רשומות ליום זה
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap">עובדת</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap">שעת כניסה</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap">שעת יציאה</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap">סטטוס</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap">סה״כ שעות</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap">הערות</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 whitespace-nowrap">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map(shift => {
                const isOpen = shift.status === "OPEN";
                const dur = shift.duration_minutes || calcDuration(shift.start_time, shift.end_time);
                return (
                  <tr key={shift.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{shift.worker_name}</td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap font-mono">{shift.start_time}</td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap font-mono">{shift.end_time || "—"}</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        isOpen
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      )}>
                        {isOpen ? "פתוחה" : "סגורה"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap font-medium">
                      {isOpen ? "—" : formatDuration(dur)}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400 max-w-[120px] truncate">
                      {[shift.start_notes, shift.end_notes].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {isOpen && (
                          <Button size="sm" variant="outline" className="text-xs h-7 px-2 gap-1"
                            onClick={() => setEndingShift(shift)}>
                            סיום משמרת
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-xs h-7 px-2 gap-1 text-slate-500"
                          onClick={() => setEditingShift(shift)}>
                          <Pencil className="w-3 h-3" /> עריכה
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showStart && (
        <StartShiftModal
          workers={workers}
          todayShifts={todayShifts}
          onClose={() => setShowStart(false)}
          onSaved={() => { setShowStart(false); refetch(); }}
        />
      )}
      {endingShift && (
        <EndShiftModal
          shift={endingShift}
          onClose={() => setEndingShift(null)}
          onSaved={() => { setEndingShift(null); refetch(); }}
        />
      )}
      {editingShift && (
        <EditShiftModal
          shift={editingShift}
          onClose={() => setEditingShift(null)}
          onSaved={() => { setEditingShift(null); refetch(); }}
        />
      )}
    </div>
  );
}