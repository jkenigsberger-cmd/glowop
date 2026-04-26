import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import SleepingRequirementsSummary from "./SleepingRequirementsSummary";
import SleepingAllocationList from "./SleepingAllocationList";
import NeighborhoodInventoryPanel from "./NeighborhoodInventoryPanel";
import TentAllocationModal from "./TentAllocationModal";

/** departure_date exclusive: [a1,a2) overlaps [b1,b2) iff a1 < b2 && b1 < a2 */
function datesOverlap(a1, a2, b1, b2) {
  if (!a1 || !a2 || !b1 || !b2) return false;
  return a1 < b2 && b1 < a2;
}

export default function SleepingAllocationTab({ groupId }) {
  const queryClient = useQueryClient();
  const [allocateTentTarget, setAllocateTentTarget] = useState(null); // { tent, neighborhood }
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: profiles = [] } = useQuery({
    queryKey: ["operationalProfile", groupId],
    queryFn: () => base44.entities.OperationalGroupProfile.filter({ group_id: groupId }),
    enabled: !!groupId,
  });
  const profile = profiles[0];

  const { data: group } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => base44.entities.Group.filter({ id: groupId }),
    select: r => r[0],
    enabled: !!groupId,
  });

  const { data: neighborhoods = [] } = useQuery({
    queryKey: ["neighborhoods"],
    queryFn: () => base44.entities.Neighborhood.list("sort_order"),
  });

  const { data: allTents = [] } = useQuery({
    queryKey: ["tents"],
    queryFn: () => base44.entities.Tent.list(),
  });

  const { data: myAllocations = [], refetch: refetchMine } = useQuery({
    queryKey: ["sleepingAllocations", groupId],
    queryFn: () => base44.entities.SleepingAllocation.filter({ group_id: groupId }),
    enabled: !!groupId,
  });

  // All CONFIRMED allocations from OTHER groups (for conflict checking)
  const { data: allConfirmedAllocations = [] } = useQuery({
    queryKey: ["allConfirmedAllocations"],
    queryFn: () => base44.entities.SleepingAllocation.filter({ status: "CONFIRMED" }),
  });

  const otherConfirmed = useMemo(
    () => allConfirmedAllocations.filter(a => a.group_id !== groupId),
    [allConfirmedAllocations, groupId]
  );

  // ── Resolve dates from profile or group ───────────────────────────────────
  const arrivalDate   = profile?.arrival_date   || group?.arrival_date   || "";
  const departureDate = profile?.departure_date || group?.departure_date || "";

  // ── Conflict computation ───────────────────────────────────────────────────
  // For each tent, build a conflict entry if another group's CONFIRMED alloc overlaps
  const tentConflictMap = useMemo(() => {
    const map = {}; // tent_id → { gender_group } | 'BLOCKED_NEIGHBORHOOD'
    if (!arrivalDate || !departureDate) return map;

    otherConfirmed.forEach(oa => {
      if (!datesOverlap(arrivalDate, departureDate, oa.arrival_date, oa.departure_date)) return;
      // Tent-level booking
      map[oa.tent_id] = { gender_group: oa.gender_group, group_id: oa.group_id };
    });
    return map;
  }, [otherConfirmed, arrivalDate, departureDate]);

  // Student neighborhood blocked set
  const blockedStudentNeighborhoodIds = useMemo(() => {
    const blocked = new Set();
    if (!arrivalDate || !departureDate) return blocked;
    otherConfirmed.forEach(oa => {
      if (oa.allocation_type !== 'STUDENT') return;
      if (!datesOverlap(arrivalDate, departureDate, oa.arrival_date, oa.departure_date)) return;
      blocked.add(oa.neighborhood_id);
    });
    return blocked;
  }, [otherConfirmed, arrivalDate, departureDate]);

  // Build per-neighborhood conflict map (includes BLOCKED_NEIGHBORHOOD for student hoods)
  const conflictMapByNeighborhood = useMemo(() => {
    const result = {}; // neighborhood_id → { [tent_id]: conflict }
    neighborhoods.forEach(n => { result[n.id] = {}; });

    // Tent-level conflicts
    Object.entries(tentConflictMap).forEach(([tentId, info]) => {
      const tent = allTents.find(t => t.id === tentId);
      if (tent) {
        if (!result[tent.neighborhood_id]) result[tent.neighborhood_id] = {};
        result[tent.neighborhood_id][tentId] = info;
      }
    });

    // Neighborhood-level student blocking
    blockedStudentNeighborhoodIds.forEach(nid => {
      const hood = neighborhoods.find(n => n.id === nid);
      if (hood && !hood.is_vip) {
        // Mark all tents in this neighborhood as blocked
        allTents.filter(t => t.neighborhood_id === nid).forEach(t => {
          if (!result[nid]) result[nid] = {};
          result[nid][t.id] = 'BLOCKED_NEIGHBORHOOD';
        });
      }
    });

    return result;
  }, [tentConflictMap, blockedStudentNeighborhoodIds, neighborhoods, allTents]);

  // Current group's alloc map by tent_id (only non-cancelled)
  const myAllocByTent = useMemo(() => {
    const map = {};
    myAllocations.filter(a => a.status !== 'CANCELLED').forEach(a => { map[a.tent_id] = a; });
    return map;
  }, [myAllocations]);

  // Tents where my DRAFT conflicts with another group's CONFIRMED
  const myDraftConflictTentIds = useMemo(() => {
    const set = new Set();
    myAllocations.filter(a => a.status === 'DRAFT').forEach(a => {
      if (tentConflictMap[a.tent_id]) set.add(a.tent_id);
      // Check neighborhood exclusivity for my draft student allocations
      const hood = neighborhoods.find(n => n.id === a.neighborhood_id);
      if (a.allocation_type === 'STUDENT' && hood && !hood.is_vip) {
        if (blockedStudentNeighborhoodIds.has(a.neighborhood_id)) set.add(a.tent_id);
      }
    });
    return set;
  }, [myAllocations, tentConflictMap, blockedStudentNeighborhoodIds, neighborhoods]);

  const hasDrafts = myAllocations.some(a => a.status === 'DRAFT');

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSaveDraft = async (data) => {
    setSaving(true);
    // Check if this tent already has a DRAFT from me — update it instead
    const existing = myAllocations.find(a => a.tent_id === data.tent_id && a.status === 'DRAFT');
    if (existing) {
      await base44.entities.SleepingAllocation.update(existing.id, data);
    } else {
      await base44.entities.SleepingAllocation.create(data);
    }
    setSaving(false);
    invalidate();
    toast.success("טיוטה נשמרה");
  };

  const handleDelete = async (id) => {
    await base44.entities.SleepingAllocation.delete(id);
    invalidate();
    toast.success("הקצאה הוסרה");
  };

  const handleConfirm = async () => {
    const draftIds = myAllocations.filter(a => a.status === 'DRAFT').map(a => a.id);
    if (draftIds.length === 0) {
      toast.error("אין טיוטות לאישור");
      return;
    }
    setConfirming(true);
    setServerErrors([]);
    const res = await base44.functions.invoke("confirmSleepingAllocations", {
      group_id: groupId,
      draft_allocation_ids: draftIds,
    });
    setConfirming(false);
    if (res.data?.success) {
      toast.success(`${res.data.confirmed_count} הקצאות אושרו בהצלחה`);
      invalidate();
    } else {
      const errors = res.data?.errors || ["שגיאה לא ידועה"];
      setServerErrors(errors);
    }
  };

  const handleCancelAll = async () => {
    if (!window.confirm("ביטול כל ההקצאות?")) return;
    const active = myAllocations.filter(a => a.status !== 'CANCELLED');
    await Promise.all(
      active.map(a =>
        a.status === 'DRAFT'
          ? base44.entities.SleepingAllocation.delete(a.id)
          : base44.entities.SleepingAllocation.update(a.id, { status: 'CANCELLED' })
      )
    );
    invalidate();
    toast.success("הקצאות בוטלו");
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["sleepingAllocations", groupId] });
    queryClient.invalidateQueries({ queryKey: ["allConfirmedAllocations"] });
  };

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!profile) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        <p>אין פרופיל תפעולי מאושר לקבוצה זו.</p>
        <p className="text-xs mt-1">יש לאשר טופס קבלה כפרופיל תפעולי תחילה.</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5" dir="rtl">

      {/* Requirements summary with remaining counters */}
      <SleepingRequirementsSummary
        profile={{ ...profile, arrival_date: arrivalDate, departure_date: departureDate }}
        allocations={myAllocations}
      />

      {/* Date range display */}
      {arrivalDate && (
        <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          📅 תאריכי הקצאה: <strong>{arrivalDate}</strong> — <strong>{departureDate}</strong>
          <span className="text-slate-400 mr-2">(departure_date בלעדי — הלילה האחרון הוא {arrivalDate === departureDate ? arrivalDate : new Date(new Date(departureDate).setDate(new Date(departureDate).getDate() - 1)).toISOString().slice(0,10)})</span>
        </div>
      )}

      {/* Current allocations */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">הקצאות נוכחיות</h3>
        <SleepingAllocationList
          allocations={myAllocations}
          tents={allTents}
          neighborhoods={neighborhoods}
          conflictTentIds={myDraftConflictTentIds}
          onDelete={handleDelete}
        />
      </section>

      {/* Server-side errors */}
      {serverErrors.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> שגיאות אישור:
          </p>
          {serverErrors.map((e, i) => (
            <p key={i} className="text-xs text-red-600">• {e}</p>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {hasDrafts && (
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={confirming || myDraftConflictTentIds.size > 0}
            className="gap-1.5 bg-emerald-700 hover:bg-emerald-800"
          >
            <ShieldCheck className="w-4 h-4" />
            {confirming ? "מאשר..." : "אשר הקצאה"}
          </Button>
        )}
        {myDraftConflictTentIds.size > 0 && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            יש קונפליקטים — לא ניתן לאשר עד לפתרונם
          </p>
        )}
        {myAllocations.some(a => a.status !== 'CANCELLED') && (
          <Button size="sm" variant="outline" onClick={handleCancelAll} className="text-red-600 border-red-200 hover:bg-red-50">
            בטל הכל
          </Button>
        )}
      </div>

      {/* Inventory panels — VIP first, then student neighborhoods */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">מלאי שינה זמין לתאריכים אלו</h3>
        {neighborhoods.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">לא נמצאו שכונות במלאי.</p>
        )}

        {/* VIP / staff first */}
        {neighborhoods.filter(n => n.is_vip).map(hood => {
          const hoodTents = allTents.filter(t => t.neighborhood_id === hood.id && t.working_status === 'WORKING');
          return (
            <div key={hood.id} className="mb-3">
              <NeighborhoodInventoryPanel
                neighborhood={hood}
                tents={hoodTents}
                conflictMap={conflictMapByNeighborhood[hood.id] || {}}
                currentGroupAllocMap={myAllocByTent}
                onAllocateTent={(tent, neighborhood) => setAllocateTentTarget({ tent, neighborhood })}
              />
            </div>
          );
        })}

        {/* Student neighborhoods */}
        {neighborhoods.filter(n => !n.is_vip).map(hood => {
          const hoodTents = allTents.filter(t => t.neighborhood_id === hood.id && t.working_status === 'WORKING');
          return (
            <div key={hood.id} className="mb-3">
              <NeighborhoodInventoryPanel
                neighborhood={hood}
                tents={hoodTents}
                conflictMap={conflictMapByNeighborhood[hood.id] || {}}
                currentGroupAllocMap={myAllocByTent}
                onAllocateTent={(tent, neighborhood) => setAllocateTentTarget({ tent, neighborhood })}
              />
            </div>
          );
        })}
      </section>

      {/* Tent allocation modal */}
      {allocateTentTarget && (
        <TentAllocationModal
          tent={allocateTentTarget.tent}
          neighborhood={allocateTentTarget.neighborhood}
          groupId={groupId}
          profile={{ ...profile, arrival_date: arrivalDate, departure_date: departureDate }}
          onSave={handleSaveDraft}
          onClose={() => setAllocateTentTarget(null)}
        />
      )}
    </div>
  );
}