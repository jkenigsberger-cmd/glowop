import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, BedDouble, X, Home, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import RoleGate from "@/components/RoleGate";

const ALT_TENT_MARKER = "__alt_tent__";

const GENDER_OPTIONS = [
  { value: "MEN",   label: "גברים" },
  { value: "WOMEN", label: "נשים"  },
  { value: "MIXED", label: "מעורב" },
];

const PURPOSE_OPTIONS = [
  "צוות",
  "מורים",
  "VIP",
  "אחר",
];

// ── Assignment Dialog ─────────────────────────────────────────────────────────

function AltTentDialog({ availableTents, neighborhoods, existingAlloc, profile, groupId, defaultPax, onSaved, onReleased, onClose }) {
  const [tentId,   setTentId]   = useState(existingAlloc?.tent_id || "");
  const [pax,      setPax]      = useState(existingAlloc?.allocated_pax ?? defaultPax ?? 1);
  const [gender,   setGender]   = useState(existingAlloc?.gender_group || "MIXED");
  const [purpose,  setPurpose]  = useState("צוות");
  const [notes,    setNotes]    = useState((existingAlloc?.notes || "").replace(/__alt_tent__\s*/g, "").trim());
  const [saving,   setSaving]   = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [errors,   setErrors]   = useState([]);

  const isEdit = !!existingAlloc;

  const selectedTent = availableTents.find(t => t.id === tentId) || null;

  // Group tents by neighborhood for the picker
  const tentsByHood = useMemo(() => {
    const map = {};
    availableTents.forEach(t => {
      const hood = neighborhoods.find(n => n.id === t.neighborhood_id);
      const hoodName = hood?.name || t.neighborhood_id;
      if (!map[hoodName]) map[hoodName] = [];
      map[hoodName].push(t);
    });
    return map;
  }, [availableTents, neighborhoods]);

  const validate = () => {
    const errs = [];
    if (!tentId) errs.push("יש לבחור אוהל");
    if (!pax || pax < 1) errs.push("יש להזין מספר אנשים לאוהל חילופי");
    if (selectedTent && pax > selectedTent.capacity) errs.push("מספר האנשים גדול מקיבולת האוהל");
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (errs.length) { setErrors(errs); return; }
    setSaving(true);
    setErrors([]);
    const fullNotes = [purpose !== "צוות" ? purpose : "", notes].filter(Boolean).join(" — ");
    try {
      const res = await base44.functions.invoke("saveAltTentAllocation", {
        allocation_id:                existingAlloc?.id || null,
        group_id:                     groupId,
        operational_group_profile_id: profile.id,
        tent_id:                      tentId,
        gender_group:                 gender,
        allocated_pax:                Number(pax),
        notes:                        fullNotes,
      });
      if (res.data?.success) {
        toast.success(`אוהל חילופי ${selectedTent?.code} שויך ✓`);
        onSaved();
      } else {
        setErrors([res.data?.error || "שגיאה בשמירה"]);
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "שגיאה בשמירה — נסה שוב";
      setErrors([msg]);
    } finally {
      setSaving(false);
    }
  };

  const handleRelease = async () => {
    if (!existingAlloc) { onReleased(); return; }
    const tentCode = availableTents.find(t => t.id === existingAlloc.tent_id)?.code || "?";
    if (!window.confirm(`לשחרר את אוהל ${tentCode}?`)) return;
    setReleasing(true);
    setErrors([]);
    try {
      if (existingAlloc.status === "DRAFT") {
        await base44.entities.SleepingAllocation.delete(existingAlloc.id);
      } else {
        await base44.entities.SleepingAllocation.update(existingAlloc.id, { status: "CANCELLED" });
      }
      toast.success(`אוהל ${tentCode} שוחרר`);
      onReleased();
    } catch (err) {
      setErrors([err?.message || "שגיאה בשחרור"]);
    } finally {
      setReleasing(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-base flex items-center gap-2">
            <Home className="w-4 h-4 text-amber-600" />
            {isEdit ? "עריכת אוהל חילופי" : "הוספת אוהל חילופי לצוות"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">

          {/* Tent picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">בחר אוהל</label>
            <select
              value={tentId}
              onChange={e => setTentId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            >
              <option value="">— בחר אוהל —</option>
              {Object.entries(tentsByHood).map(([hoodName, tents]) => (
                <optgroup key={hoodName} label={hoodName}>
                  {tents.map(t => (
                    <option key={t.id} value={t.id}>
                      אוהל {t.code} — {hoodName} — קיבולת {t.capacity}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {availableTents.length === 0 && (
              <p className="text-xs text-amber-600">אין אוהלים רגילים פנויים בתאריכים אלו.</p>
            )}
          </div>

          {/* Pax */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">
              מספר אנשים
              {selectedTent && <span className="text-slate-400 font-normal mr-1">(קיבולת: {selectedTent.capacity})</span>}
            </label>
            <input
              type="number"
              min="1"
              max={selectedTent?.capacity || 999}
              value={pax}
              onChange={e => setPax(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            />
          </div>

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

          {/* Purpose */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600">קטגוריה</label>
            <div className="flex flex-wrap gap-2">
              {PURPOSE_OPTIONS.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setPurpose(opt)}
                  className={`px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    purpose === opt
                      ? "border-amber-400 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
                  }`}
                >
                  {opt}
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
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
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

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {isEdit && (
              <Button type="button" size="sm" variant="outline" onClick={handleRelease}
                disabled={releasing || saving} className="text-red-500 border-red-200 hover:bg-red-50 gap-1">
                <X className="w-3.5 h-3.5" />
                {releasing ? "משחרר..." : "שחרר"}
              </Button>
            )}
            <div className="flex-1" />
            <Button type="button" size="sm" variant="outline" onClick={onClose} disabled={saving || releasing}>ביטול</Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={saving || releasing}
              className="bg-amber-600 hover:bg-amber-700 gap-1">
              <BedDouble className="w-3.5 h-3.5" />
              {saving ? "שומר..." : isEdit ? "עדכן" : "שמור שיוך"}
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
  const [dialogOpen, setDialogOpen] = useState(false);

  const altTentPax   = profile.staff_alt_tent_pax   || 0;
  const altTentNotes = profile.staff_alt_tent_notes  || "";

  // Find existing alt tent allocation for this group
  const existingAltAlloc = useMemo(
    () => myAllocations.find(a => a.status !== "CANCELLED" && (a.notes || "").includes(ALT_TENT_MARKER)) || null,
    [myAllocations]
  );

  // Tents occupied by OTHER groups on overlapping dates (CONFIRMED or DRAFT)
  const occupiedTentIds = useMemo(() => {
    const ids = new Set();
    if (!arrivalDate || !departureDate) return ids;
    allConfirmedAllocations.forEach(a => {
      if (a.group_id === groupId) return;
      if (a.status === "CANCELLED") return;
      const arr = a.arrival_date;
      const dep = a.departure_date;
      if (arr && dep && arr < departureDate && dep > arrivalDate) {
        ids.add(a.tent_id);
      }
    });
    return ids;
  }, [allConfirmedAllocations, groupId, arrivalDate, departureDate]);

  // Available regular (non-VIP) tents for the group's dates
  const availableTents = useMemo(() => {
    if (!arrivalDate || !departureDate) return [];
    return allTents.filter(t => {
      if (t.tent_type === "VIP") return false;
      if (t.working_status !== "WORKING") return false;
      // Don't re-show the already-assigned tent as unavailable
      if (existingAltAlloc && t.id === existingAltAlloc.tent_id) return true;
      if (occupiedTentIds.has(t.id)) return false;
      return true;
    });
  }, [allTents, occupiedTentIds, existingAltAlloc, arrivalDate, departureDate]);

  if (altTentPax <= 0) return null;

  // Display info for existing allocation
  const assignedTent    = existingAltAlloc ? allTents.find(t => t.id === existingAltAlloc.tent_id) : null;
  const isConfirmed     = existingAltAlloc?.status === "CONFIRMED";
  const cleanNotes      = existingAltAlloc ? (existingAltAlloc.notes || "").replace(/__alt_tent__\s*/g, "").trim() : "";

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
        <Home className="w-4 h-4 text-amber-600" />
        אוהל חילופי לצוות
      </h3>

      {/* Requirement banner */}
      <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 space-y-1">
        <p className="text-sm font-semibold text-amber-800">
          {altTentPax} אנשי צוות לאוהל חילופי
        </p>
        {altTentNotes && (
          <p className="text-xs text-amber-700">הערות: {altTentNotes}</p>
        )}
      </div>

      {/* Existing allocation row */}
      {existingAltAlloc && assignedTent ? (
        <div className={`rounded-xl border-2 px-4 py-3 flex items-center gap-3 ${
          isConfirmed
            ? "border-emerald-400 bg-emerald-50"
            : "border-amber-400 bg-amber-50"
        }`}>
          <BedDouble className={`w-4 h-4 shrink-0 ${isConfirmed ? "text-emerald-600" : "text-amber-600"}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${isConfirmed ? "text-emerald-800" : "text-amber-800"}`}>
              אוהל חילופי {assignedTent.code} — {cleanNotes || "צוות"} — {existingAltAlloc.allocated_pax}/{assignedTent.capacity}
            </p>
            <p className="text-xs text-slate-500">
              {neighborhoods.find(n => n.id === assignedTent.neighborhood_id)?.name || ""}
              {isConfirmed
                ? <span className="text-emerald-600 mr-2 flex items-center gap-0.5 inline-flex"><CheckCircle2 className="w-3 h-3 inline mr-0.5" />מאושר</span>
                : <span className="text-amber-600 mr-2"> · טיוטה</span>}
            </p>
          </div>
          {!isConfirmed && (
            <RoleGate permission="MANAGE_ALLOCATION">
              <Button size="sm" variant="outline"
                onClick={() => setDialogOpen(true)}
                className="text-xs border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0">
                עריכה
              </Button>
            </RoleGate>
          )}
        </div>
      ) : (
        <RoleGate permission="MANAGE_ALLOCATION">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDialogOpen(true)}
            className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            <BedDouble className="w-3.5 h-3.5" />
            הוסף אוהל חילופי
          </Button>
        </RoleGate>
      )}

      {/* Dialog */}
      {dialogOpen && (
        <AltTentDialog
          availableTents={availableTents}
          neighborhoods={neighborhoods}
          existingAlloc={existingAltAlloc}
          profile={profile}
          groupId={groupId}
          defaultPax={altTentPax}
          onSaved={() => { setDialogOpen(false); onInvalidate(); }}
          onReleased={() => { setDialogOpen(false); onInvalidate(); }}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </section>
  );
}