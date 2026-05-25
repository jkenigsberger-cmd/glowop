import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, BedDouble, X, Home, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import RoleGate from "@/components/RoleGate";

const ALT_TENT_MARKER = "__alt_tent__";

const GENDER_OPTIONS = [
  { value: "MEN",   label: "גברים" },
  { value: "WOMEN", label: "נשים"  },
  { value: "MIXED", label: "מעורב" },
];

// ── Add Tent Dialog ───────────────────────────────────────────────────────────

function AddAltTentDialog({ availableTents, neighborhoods, profile, groupId, remainingPax, onSaved, onClose }) {
  const [tentId,  setTentId]  = useState("");
  const [pax,     setPax]     = useState(1);
  const [gender,  setGender]  = useState("MIXED");
  const [notes,   setNotes]   = useState("");
  const [saving,  setSaving]  = useState(false);
  const [errors,  setErrors]  = useState([]);

  const selectedTent = availableTents.find(t => t.id === tentId) || null;

  // pax options: 1..min(tent.capacity, remainingPax)
  const maxPax = selectedTent ? Math.min(selectedTent.capacity, remainingPax) : 0;

  // When tent changes, reset pax to max sensible default
  const handleTentChange = (id) => {
    setTentId(id);
    const t = availableTents.find(tt => tt.id === id);
    if (t) {
      setPax(Math.min(t.capacity, remainingPax));
    } else {
      setPax(1);
    }
    setErrors([]);
  };

  // Group tents by neighborhood
  const tentsByHood = useMemo(() => {
    const map = {};
    availableTents.forEach(t => {
      const hood = neighborhoods.find(n => n.id === t.neighborhood_id);
      const hoodName = hood?.name || "שכונה לא ידועה";
      if (!map[hoodName]) map[hoodName] = [];
      map[hoodName].push(t);
    });
    return map;
  }, [availableTents, neighborhoods]);

  const validate = () => {
    const errs = [];
    if (!tentId) errs.push("יש לבחור אוהל");
    if (!selectedTent) errs.push("אוהל לא תקין");
    else {
      if (!pax || pax < 1) errs.push("יש לבחור מספר אנשים");
      if (pax > selectedTent.capacity) errs.push("מספר האנשים גדול מקיבולת האוהל");
      if (pax > remainingPax) errs.push(`לא ניתן לשבץ יותר מ-${remainingPax} אנשים נותרים`);
    }
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (errs.length) { setErrors(errs); return; }
    setSaving(true);
    setErrors([]);
    try {
      const res = await base44.functions.invoke("saveAltTentAllocation", {
        allocation_id:                null,
        group_id:                     groupId,
        operational_group_profile_id: profile.id,
        tent_id:                      tentId,
        gender_group:                 gender,
        allocated_pax:                Number(pax),
        notes:                        notes.trim(),
      });
      if (res.data?.success) {
        toast.success(`אוהל חילופי ${selectedTent?.code} שויך ✓`);
        onSaved();
      } else {
        setErrors([res.data?.error || "שגיאה בשמירה"]);
      }
    } catch (err) {
      setErrors([err?.response?.data?.error || err?.message || "שגיאה בשמירה — נסה שוב"]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-right text-base flex items-center gap-2">
            <Home className="w-4 h-4 text-amber-600" />
            הוספת אוהל חילופי לצוות
          </DialogTitle>
          {remainingPax > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-1">
              נותרו לשיבוץ: <strong>{remainingPax}</strong> אנשים
            </p>
          )}
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto space-y-4 pl-1">

          {/* Tent picker — compact cards grouped by neighborhood */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600">בחר אוהל</label>
            {availableTents.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                אין אוהלים רגילים פנויים בתאריכים אלו.
              </p>
            ) : (
              <div className="space-y-3 max-h-[40vh] overflow-y-auto border border-slate-200 rounded-xl p-2">
                {Object.entries(tentsByHood).map(([hoodName, tents]) => (
                  <div key={hoodName}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 px-1 mb-1">{hoodName}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tents.map(t => {
                        const isSelected = tentId === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleTentChange(t.id)}
                            className={`rounded-lg border-2 px-2.5 py-1.5 text-xs font-medium transition-all flex flex-col items-center gap-0.5 min-w-[56px] ${
                              isSelected
                                ? "border-amber-500 bg-amber-50 text-amber-800 shadow-md"
                                : "border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50/40"
                            }`}
                          >
                            <span className="font-bold text-sm">{t.code}</span>
                            <span className="text-[10px] text-slate-400">{t.capacity}🛏</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pax dropdown — only shown after tent selected */}
          {selectedTent && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">
                מספר אנשים
                <span className="text-slate-400 font-normal mr-1">
                  (קיבולת: {selectedTent.capacity} · נותרו: {remainingPax})
                </span>
              </label>
              <select
                value={pax}
                onChange={e => setPax(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
              >
                {Array.from({ length: maxPax }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n} אנשים</option>
                ))}
              </select>
            </div>
          )}

          {/* Gender */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">מגדר</label>
            <div className="flex gap-2">
              {GENDER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setGender(opt.value)}
                  className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    gender === opt.value
                      ? "border-amber-400 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">הערות <span className="text-slate-400 font-normal">(אופציונלי)</span></label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="הערות לאוהל..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
            />
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-0.5">
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" /> {e}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 flex gap-2 pt-3 border-t border-slate-100">
          <div className="flex-1" />
          <Button type="button" size="sm" variant="outline" onClick={onClose} disabled={saving}>ביטול</Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={saving || !tentId}
            className="bg-amber-600 hover:bg-amber-700 gap-1">
            <BedDouble className="w-3.5 h-3.5" />
            {saving ? "שומר..." : "שמור שיוך"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Tent Dialog ──────────────────────────────────────────────────────────

function EditAltTentDialog({ alloc, tent, neighborhoods, profile, groupId, remainingPax, onSaved, onReleased, onClose }) {
  const [pax,    setPax]    = useState(alloc.allocated_pax || 1);
  const [gender, setGender] = useState(alloc.gender_group || "MIXED");
  const [notes,  setNotes]  = useState((alloc.notes || "").replace(/__alt_tent__\s*/g, "").trim());
  const [saving,   setSaving]   = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [errors,  setErrors]  = useState([]);

  // remaining for edit = remaining + this alloc's current pax (since it's being edited)
  const effectiveRemaining = remainingPax + (alloc.allocated_pax || 0);
  const maxPax = tent ? Math.min(tent.capacity, effectiveRemaining) : 1;

  const handleSave = async () => {
    if (!pax || pax < 1) { setErrors(["יש לבחור מספר אנשים"]); return; }
    setSaving(true);
    setErrors([]);
    try {
      const res = await base44.functions.invoke("saveAltTentAllocation", {
        allocation_id:                alloc.id,
        group_id:                     groupId,
        operational_group_profile_id: profile.id,
        tent_id:                      alloc.tent_id,
        gender_group:                 gender,
        allocated_pax:                Number(pax),
        notes:                        notes.trim(),
      });
      if (res.data?.success) {
        toast.success("אוהל חילופי עודכן ✓");
        onSaved();
      } else {
        setErrors([res.data?.error || "שגיאה בשמירה"]);
      }
    } catch (err) {
      setErrors([err?.response?.data?.error || err?.message || "שגיאה בשמירה"]);
    } finally {
      setSaving(false);
    }
  };

  const handleRelease = async () => {
    if (!window.confirm(`לשחרר את אוהל ${tent?.code || ""}?`)) return;
    setReleasing(true);
    try {
      if (alloc.status === "DRAFT") {
        await base44.entities.SleepingAllocation.delete(alloc.id);
      } else {
        await base44.entities.SleepingAllocation.update(alloc.id, { status: "CANCELLED" });
      }
      toast.success(`אוהל ${tent?.code || ""} שוחרר`);
      onReleased();
    } catch (err) {
      setErrors([err?.message || "שגיאה בשחרור"]);
    } finally {
      setReleasing(false);
    }
  };

  const hoodName = neighborhoods.find(n => tent && n.id === tent.neighborhood_id)?.name || "";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-base flex items-center gap-2">
            <Home className="w-4 h-4 text-amber-600" />
            עריכת אוהל חילופי {tent?.code}
          </DialogTitle>
          {hoodName && <p className="text-xs text-slate-500 mt-0.5">{hoodName}</p>}
        </DialogHeader>

        <div className="space-y-4">
          {/* Pax */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">
              מספר אנשים
              {tent && <span className="text-slate-400 font-normal mr-1">(קיבולת: {tent.capacity})</span>}
            </label>
            <select
              value={pax}
              onChange={e => setPax(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
            >
              {Array.from({ length: maxPax }, (_, i) => i + 1).map(n => (
                <option key={n} value={n}>{n} אנשים</option>
              ))}
            </select>
          </div>

          {/* Gender */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">מגדר</label>
            <div className="flex gap-2">
              {GENDER_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setGender(opt.value)}
                  className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    gender === opt.value ? "border-amber-400 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">הערות</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="הערות לאוהל..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
            />
          </div>

          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 space-y-0.5">
              {errors.map((e, i) => <p key={i} className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> {e}</p>)}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" size="sm" variant="outline" onClick={handleRelease} disabled={releasing || saving}
              className="text-red-500 border-red-200 hover:bg-red-50 gap-1">
              <X className="w-3.5 h-3.5" />{releasing ? "משחרר..." : "שחרר"}
            </Button>
            <div className="flex-1" />
            <Button type="button" size="sm" variant="outline" onClick={onClose} disabled={saving || releasing}>ביטול</Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={saving || releasing}
              className="bg-amber-600 hover:bg-amber-700 gap-1">
              <BedDouble className="w-3.5 h-3.5" />{saving ? "שומר..." : "עדכן"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export default function AltTentAllocationPanel({
  profile,
  groupId,
  allTents,
  neighborhoods,
  myAllocations,
  allConfirmedAllocations,
  arrivalDate,
  departureDate,
  onInvalidate,
}) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editTarget, setEditTarget]       = useState(null); // { alloc, tent }

  const altTentPax   = profile.staff_alt_tent_pax ?? 0;
  const altTentNotes = profile.staff_alt_tent_notes || "";

  // All active alt tent allocations for this group
  const altAllocs = useMemo(
    () => myAllocations.filter(a => a.status !== "CANCELLED" && (a.notes || "").includes(ALT_TENT_MARKER)),
    [myAllocations]
  );

  // Pax already allocated in alt tents
  const allocatedPax = altAllocs.reduce((s, a) => s + (a.allocated_pax || 0), 0);

  // Remaining pax to assign
  const remainingPax = Math.max(altTentPax - allocatedPax, 0);
  const allDone = altTentPax > 0 && remainingPax === 0;

  // Tents occupied by other groups (date-overlapping, any active allocation)
  const occupiedTentIds = useMemo(() => {
    const ids = new Set();
    if (!arrivalDate || !departureDate) return ids;
    allConfirmedAllocations.forEach(a => {
      if (a.group_id === groupId) return;
      if (a.status === "CANCELLED") return;
      if (a.arrival_date && a.departure_date && a.arrival_date < departureDate && a.departure_date > arrivalDate) {
        ids.add(a.tent_id);
      }
    });
    return ids;
  }, [allConfirmedAllocations, groupId, arrivalDate, departureDate]);

  // Tent IDs already used by this group's alt allocs (to exclude from picker)
  const myAltTentIds = useMemo(() => new Set(altAllocs.map(a => a.tent_id)), [altAllocs]);

  // Available regular tents: not VIP, working, not occupied by others, not already in my alt allocs
  const availableTents = useMemo(() => {
    if (!arrivalDate || !departureDate) return [];
    return allTents.filter(t => {
      if (t.tent_type === "VIP") return false;
      if (t.working_status !== "WORKING") return false;
      if (myAltTentIds.has(t.id)) return false; // already assigned by me
      if (occupiedTentIds.has(t.id)) return false;
      return true;
    });
  }, [allTents, occupiedTentIds, myAltTentIds, arrivalDate, departureDate]);

  if (altTentPax <= 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
        <Home className="w-4 h-4 text-amber-600" />
        אוהל חילופי לצוות
      </h3>

      {/* Status bar */}
      <div className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 flex-wrap ${
        allDone ? "bg-emerald-50 border-emerald-300" : "bg-amber-50 border-amber-300"
      }`}>
        <div className="space-y-0.5">
          <p className={`text-sm font-semibold ${allDone ? "text-emerald-800" : "text-amber-800"}`}>
            {allDone ? "כל אנשי הצוות שובצו לאוהל חילופי ✓" : `נותרו לשיבוץ: ${remainingPax} אנשים`}
          </p>
          <p className="text-xs text-slate-500">
            סה״כ נדרש: {altTentPax} · שובץ: {allocatedPax} · נותרו: {remainingPax}
          </p>
          {altTentNotes && <p className="text-xs text-amber-700">הערות: {altTentNotes}</p>}
        </div>
        {!allDone && (
          <RoleGate permission="MANAGE_ALLOCATION">
            <Button size="sm" variant="outline" onClick={() => setAddDialogOpen(true)}
              className="gap-1 border-amber-400 text-amber-700 hover:bg-amber-100 shrink-0">
              <Plus className="w-3.5 h-3.5" /> הוסף אוהל חילופי
            </Button>
          </RoleGate>
        )}
      </div>

      {/* Assigned alt tent list */}
      {altAllocs.length > 0 && (
        <div className="space-y-2">
          {altAllocs.map(alloc => {
            const tent = allTents.find(t => t.id === alloc.tent_id);
            const hoodName = tent ? (neighborhoods.find(n => n.id === tent.neighborhood_id)?.name || "") : "";
            const cleanNotes = (alloc.notes || "").replace(/__alt_tent__\s*/g, "").trim();
            const isConfirmed = alloc.status === "CONFIRMED";
            return (
              <div key={alloc.id} className={`rounded-xl border-2 px-4 py-3 flex items-center gap-3 ${
                isConfirmed ? "border-emerald-400 bg-emerald-50" : "border-amber-400 bg-amber-50"
              }`}>
                <BedDouble className={`w-4 h-4 shrink-0 ${isConfirmed ? "text-emerald-600" : "text-amber-600"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isConfirmed ? "text-emerald-800" : "text-amber-800"}`}>
                    אוהל {tent?.code ?? "?"} — {cleanNotes || "צוות"} — {alloc.allocated_pax}/{tent?.capacity ?? "?"}
                  </p>
                  <p className="text-xs text-slate-500 flex items-center gap-2">
                    {hoodName && <span>{hoodName}</span>}
                    {isConfirmed
                      ? <span className="text-emerald-600 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />מאושר</span>
                      : <span className="text-amber-600">טיוטה</span>}
                  </p>
                </div>
                {!isConfirmed && tent && (
                  <RoleGate permission="MANAGE_ALLOCATION">
                    <Button size="sm" variant="outline" onClick={() => setEditTarget({ alloc, tent })}
                      className="text-xs border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0">
                      עריכה
                    </Button>
                  </RoleGate>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add dialog */}
      {addDialogOpen && (
        <AddAltTentDialog
          availableTents={availableTents}
          neighborhoods={neighborhoods}
          profile={profile}
          groupId={groupId}
          remainingPax={remainingPax}
          onSaved={() => { setAddDialogOpen(false); onInvalidate(); }}
          onClose={() => setAddDialogOpen(false)}
        />
      )}

      {/* Edit dialog */}
      {editTarget && (
        <EditAltTentDialog
          alloc={editTarget.alloc}
          tent={editTarget.tent}
          neighborhoods={neighborhoods}
          profile={profile}
          groupId={groupId}
          remainingPax={remainingPax}
          onSaved={() => { setEditTarget(null); onInvalidate(); }}
          onReleased={() => { setEditTarget(null); onInvalidate(); }}
          onClose={() => setEditTarget(null)}
        />
      )}
    </section>
  );
}