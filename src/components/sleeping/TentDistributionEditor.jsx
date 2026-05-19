import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Save } from "lucide-react";
import { toast } from "sonner";

const GENDER_LABEL = { BOYS: "בנים 👦", GIRLS: "בנות 👧", MEN: "גברים 👨", WOMEN: "נשים 👩" };

/**
 * Props:
 *  open                  - boolean
 *  onClose               - () => void
 *  neighborhood          - Neighborhood record
 *  tents                 - Tent[] (working tents in this neighborhood)
 *  reservation           - NeighborhoodReservation (the lock)
 *  groupId               - string
 *  profileId             - string
 *  arrivalDate           - string
 *  departureDate         - string
 *  allConfirmedAllocs    - SleepingAllocation[] from ALL groups (for overbooking check)
 *  onSaved               - () => void  (invalidate parent)
 */
export default function TentDistributionEditor({
  open,
  onClose,
  neighborhood,
  tents,
  reservation,
  groupId,
  profileId,
  arrivalDate,
  departureDate,
  allConfirmedAllocs = [],
  onSaved,
}) {
  const queryClient = useQueryClient();

  // Fetch existing allocations for this group in this neighborhood
  const { data: existingAllocs = [] } = useQuery({
    queryKey: ["sleepingAllocations", groupId],
    queryFn: () => base44.entities.SleepingAllocation.filter({ group_id: groupId }),
    enabled: !!groupId && open,
  });

  // paxMap: tentId → pax string
  const [paxMap, setPaxMap] = useState({});
  // notesMap: tentId → notes string
  const [notesMap, setNotesMap] = useState({});
  const [saving, setSaving] = useState(false);
  const [overrideMismatch, setOverrideMismatch] = useState(false);

  // Active student allocs for this group in this neighborhood
  const myNeighborhoodAllocs = useMemo(
    () => existingAllocs.filter(
      a => a.neighborhood_id === neighborhood?.id &&
           a.status !== "CANCELLED" &&
           a.allocation_type === "STUDENT"
    ),
    [existingAllocs, neighborhood]
  );

  // Initialise paxMap from existing allocations when opening
  useEffect(() => {
    if (!open) return;
    const pm = {};
    const nm = {};
    myNeighborhoodAllocs.forEach(a => {
      pm[a.tent_id] = String(a.allocated_pax ?? 0);
      nm[a.tent_id] = a.notes || "";
    });
    setPaxMap(pm);
    setNotesMap(nm);
    setOverrideMismatch(false);
  }, [open, myNeighborhoodAllocs.length]);

  // Overbooking: tentId → true if another group has a CONFIRMED alloc overlapping dates
  const overbookedTentIds = useMemo(() => {
    const set = new Set();
    if (!arrivalDate || !departureDate) return set;
    allConfirmedAllocs.forEach(a => {
      if (a.group_id === groupId) return;
      if (a.status === "CANCELLED") return;
      if (a.arrival_date >= departureDate || a.departure_date <= arrivalDate) return;
      set.add(a.tent_id);
    });
    return set;
  }, [allConfirmedAllocs, groupId, arrivalDate, departureDate]);

  const totalAssigned = useMemo(
    () => tents.reduce((s, t) => s + (Number(paxMap[t.id]) || 0), 0),
    [tents, paxMap]
  );

  const requestedPax = reservation?.planned_tents
    ? null // we don't know total pax from planned_tents, use open ended
    : null;

  // Capacity violations
  const capacityErrors = useMemo(() => {
    const errors = [];
    tents.forEach(t => {
      const pax = Number(paxMap[t.id]) || 0;
      if (pax > (t.capacity || 0)) {
        errors.push(`אוהל ${t.code}: כמות האנשים (${pax}) גבוהה מהקיבולת (${t.capacity})`);
      }
    });
    return errors;
  }, [tents, paxMap]);

  // Overbooking errors for tents we're assigning to
  const overbookingErrors = useMemo(() => {
    const errors = [];
    tents.forEach(t => {
      const pax = Number(paxMap[t.id]) || 0;
      if (pax > 0 && overbookedTentIds.has(t.id)) {
        errors.push(`אוהל ${t.code}: האוהל כבר משובץ לקבוצה אחרת בתאריכים אלו`);
      }
    });
    return errors;
  }, [tents, paxMap, overbookedTentIds]);

  const hasBlockingErrors = capacityErrors.length > 0 || overbookingErrors.length > 0;

  const handleSave = async () => {
    if (hasBlockingErrors) return;

    // Check mismatch — warn but allow override
    // (we don't enforce exact match, just warn)

    setSaving(true);
    try {
      // Build existing alloc map by tentId
      const existingByTent = {};
      myNeighborhoodAllocs.forEach(a => { existingByTent[a.tent_id] = a; });

      const ops = [];

      for (const tent of tents) {
        const pax = Number(paxMap[tent.id]) || 0;
        const existing = existingByTent[tent.id];
        const notes = notesMap[tent.id] || "";

        if (pax > 0) {
          const payload = {
            group_id: groupId,
            operational_group_profile_id: profileId,
            tent_id: tent.id,
            neighborhood_id: neighborhood.id,
            arrival_date: arrivalDate,
            departure_date: departureDate,
            allocated_pax: pax,
            allocation_type: "STUDENT",
            gender_group: reservation?.gender_group && reservation.gender_group !== "MIXED"
              ? (reservation.gender_group === "BOYS" ? "BOYS" : "GIRLS")
              : "BOYS",
            status: "DRAFT",
            notes,
          };
          if (existing) {
            ops.push(base44.entities.SleepingAllocation.update(existing.id, payload));
          } else {
            ops.push(base44.entities.SleepingAllocation.create(payload));
          }
        } else {
          // pax = 0 → cancel/delete existing
          if (existing) {
            if (existing.status === "DRAFT") {
              ops.push(base44.entities.SleepingAllocation.delete(existing.id));
            } else {
              ops.push(base44.entities.SleepingAllocation.update(existing.id, { status: "CANCELLED" }));
            }
          }
        }
      }

      await Promise.all(ops);

      queryClient.invalidateQueries({ queryKey: ["sleepingAllocations", groupId] });
      queryClient.invalidateQueries({ queryKey: ["allConfirmedAllocations"] });
      toast.success("חלוקת האוהלים נשמרה ✓");
      onSaved?.();
      onClose();
    } catch (err) {
      console.error("[TentDistributionEditor] save error:", err);
      toast.error(err?.message || "שגיאה בשמירה — נסה שוב");
    } finally {
      setSaving(false);
    }
  };

  // Natural numeric sort by tent code
  const getTentNumber = (tent) => {
    const raw = String(tent.code || tent.name || "");
    const match = raw.match(/\d+/);
    return match ? Number(match[0]) : 9999;
  };
  const sortedTents = [...tents].sort((a, b) => {
    const diff = getTentNumber(a) - getTentNumber(b);
    return diff !== 0 ? diff : String(a.code).localeCompare(String(b.code));
  });

  if (!neighborhood) return null;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">
            חלוקה לאוהלים ספציפיים — {neighborhood.name}
          </DialogTitle>
          {reservation && (
            <p className="text-xs text-slate-500 mt-0.5">
              {GENDER_LABEL[reservation.gender_group] ?? reservation.gender_group}
              {" · "}
              {arrivalDate} → {departureDate}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-2 my-2">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[10px] font-semibold text-slate-400 uppercase px-1">
            <span>אוהל</span>
            <span className="w-14 text-center">קיבולת</span>
            <span className="w-20 text-center">מספר אנשים</span>
            <span className="w-28">הערות</span>
          </div>

          {sortedTents.map(tent => {
            const pax = Number(paxMap[tent.id]) || 0;
            const isOverBooked = overbookedTentIds.has(tent.id);
            const isOverCap = pax > (tent.capacity || 0);
            const rowBg = isOverBooked
              ? "bg-red-50 border-red-200"
              : isOverCap
              ? "bg-amber-50 border-amber-200"
              : pax > 0
              ? "bg-emerald-50 border-emerald-200"
              : "bg-white border-slate-200";

            return (
              <div key={tent.id} className={`grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center border rounded-lg px-3 py-2 ${rowBg}`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-semibold text-sm text-slate-800">{tent.code}</span>
                  {isOverBooked && (
                    <span className="text-[10px] text-red-600 font-medium">תפוס</span>
                  )}
                </div>
                <span className="w-14 text-center text-xs text-slate-500">{tent.capacity || "—"}</span>
                <Input
                  type="number"
                  min="0"
                  max={tent.capacity || 999}
                  value={paxMap[tent.id] ?? "0"}
                  onChange={e => setPaxMap(p => ({ ...p, [tent.id]: e.target.value }))}
                  className="w-20 h-7 text-xs text-center"
                  disabled={isOverBooked && !myNeighborhoodAllocs.find(a => a.tent_id === tent.id)}
                />
                <Input
                  value={notesMap[tent.id] ?? ""}
                  onChange={e => setNotesMap(n => ({ ...n, [tent.id]: e.target.value }))}
                  placeholder="הערות..."
                  className="w-28 h-7 text-xs"
                />
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm">
          <span className="text-slate-600">סה״כ שובץ:</span>
          <span className={`font-bold text-base ${totalAssigned === 0 ? "text-slate-400" : "text-slate-800"}`}>
            {totalAssigned} אנשים
          </span>
        </div>

        {/* Validation errors */}
        {(capacityErrors.length > 0 || overbookingErrors.length > 0) && (
          <div className="space-y-1">
            {[...capacityErrors, ...overbookingErrors].map((e, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {e}
              </div>
            ))}
          </div>
        )}

        {totalAssigned > 0 && !hasBlockingErrors && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            מוכן לשמירה — {totalAssigned} אנשים ב-{tents.filter(t => Number(paxMap[t.id]) > 0).length} אוהלים
          </div>
        )}

        <DialogFooter className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>ביטול</Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleSave}
            disabled={saving || hasBlockingErrors || totalAssigned === 0}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "שומר..." : "שמור חלוקה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}