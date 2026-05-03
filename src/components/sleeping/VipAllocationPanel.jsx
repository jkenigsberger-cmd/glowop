import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ShieldCheck, AlertTriangle, X, Shield, Car, User, Star, BookOpen } from "lucide-react";
import { toast } from "sonner";

// ── Config ────────────────────────────────────────────────────────────────────

const GENDER_CFG = {
  WOMEN: { label: "נשים",  bg: "bg-orange-50",  border: "border-orange-300",  text: "text-orange-700",  dot: "bg-orange-400" },
  MEN:   { label: "גברים", bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", dot: "bg-emerald-400" },
  GIRLS: { label: "בנות",  bg: "bg-orange-50",  border: "border-orange-300",  text: "text-orange-700",  dot: "bg-orange-400" },
  BOYS:  { label: "בנים",  bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", dot: "bg-emerald-400" },
};

const PURPOSE_CFG = {
  STAFF:    { label: "צוות",   Icon: User   },
  SECURITY: { label: "אבטחה",  Icon: Shield },
  DRIVER:   { label: "נהג",    Icon: Car    },
  VIP:      { label: "VIP",    Icon: Star   },
  GUIDE:    { label: "מדריך",  Icon: BookOpen },
};

function getGenderCfg(g) { return GENDER_CFG[g] || GENDER_CFG.MEN; }
function getPurposeCfg(p) {
  if (!p) return PURPOSE_CFG.STAFF;
  return PURPOSE_CFG[p.toUpperCase()] || { label: p, Icon: User };
}

// ── Compact VIP Requirement Card (square style) ───────────────────────────────

function VipReqCard({ req, index, assignedTentCode, assignedStatus, isSelected, onClick, onUnassign }) {
  const gc = getGenderCfg(req.gender_group);
  const pc = getPurposeCfg(req.purpose);
  const { Icon } = pc;

  const isAssigned  = !!assignedTentCode;
  const isConfirmed = assignedStatus === "CONFIRMED";

  // Border/bg state
  let border = gc.border;
  let bg     = gc.bg;
  let ring   = "";
  if (isConfirmed)       { border = "border-emerald-400"; bg = "bg-emerald-50"; ring = "ring-2 ring-emerald-200"; }
  else if (isAssigned)   { border = "border-amber-400";   bg = "bg-amber-50";   ring = "ring-2 ring-amber-200"; }
  else if (isSelected)   { border = "border-primary";     bg = "bg-primary/5";  ring = "ring-2 ring-primary/20"; }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={isConfirmed}
        className={`relative rounded-xl border-2 ${border} ${bg} ${ring} px-3 py-3 flex flex-col items-center gap-1 min-w-[80px] cursor-pointer transition-all hover:brightness-95 disabled:cursor-default`}
      >
        {/* index badge */}
        <span className="absolute top-1.5 right-1.5 text-[9px] font-bold text-slate-400">#{index + 1}</span>

        {/* status chip */}
        {isConfirmed && (
          <span className="absolute top-1.5 left-1.5 text-[8px] text-emerald-600 font-bold">✓</span>
        )}
        {isAssigned && !isConfirmed && (
          <span className="absolute top-1.5 left-1.5 text-[8px] text-amber-500 font-bold">~</span>
        )}
        {isSelected && !isAssigned && (
          <span className="absolute top-1.5 left-1.5 text-[8px] text-primary font-bold">←</span>
        )}

        {/* purpose icon circle */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${gc.border} ${gc.bg}`}>
          <Icon className={`w-4 h-4 ${gc.text}`} />
        </div>

        {/* people dots */}
        <div className="flex items-center gap-0.5">
          {Array.from({ length: Math.min(req.people_count || 1, 3) }).map((_, i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full ${gc.dot}`} />
          ))}
        </div>

        {/* gender label */}
        <span className={`text-[10px] font-bold ${gc.text} leading-none`}>{gc.label}</span>

        {/* purpose label */}
        <span className="text-[9px] text-slate-500 leading-none">{pc.label}</span>

        {/* people count */}
        <span className={`text-[11px] font-semibold ${gc.text}`}>{req.people_count} איש</span>

        {/* assigned tent badge */}
        {isAssigned && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border leading-none ${
            isConfirmed ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-amber-100 text-amber-700 border-amber-300"
          }`}>
            אוהל {assignedTentCode}
          </span>
        )}
        {!isAssigned && !isSelected && (
          <span className="text-[9px] text-slate-400 leading-none">בחר אוהל</span>
        )}
        {isSelected && !isAssigned && (
          <span className="text-[9px] text-primary leading-none font-medium">← בחר</span>
        )}
      </button>

      {/* unassign button below the card */}
      {isAssigned && !isConfirmed && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onUnassign(); }}
          className="text-[10px] text-red-400 hover:text-red-600 flex items-center gap-0.5 transition-colors"
        >
          <X className="w-2.5 h-2.5" /> בטל שיוך
        </button>
      )}
    </div>
  );
}

// ── VIP Tent Card ─────────────────────────────────────────────────────────────

function VipTentCard({ tent, isOccupiedByOther, myAlloc, isSelecting, onClick }) {
  const isAssigned  = !!myAlloc;
  const isConfirmed = myAlloc?.status === "CONFIRMED";
  const gc = myAlloc ? getGenderCfg(myAlloc.gender_group) : null;

  // clicking an already-assigned tent (draft) while selecting = reassign
  const canClick = isSelecting && !isOccupiedByOther && !isConfirmed;
  const isAvailable = !isOccupiedByOther && !isAssigned;

  let border = "border-slate-200";
  let bg     = "bg-white";
  let ring   = "";

  if (isConfirmed)             { border = "border-emerald-400"; bg = "bg-emerald-50"; }
  else if (isAssigned)         { border = "border-amber-400";   bg = "bg-amber-50"; }
  else if (isOccupiedByOther)  { border = "border-red-200";     bg = "bg-red-50"; }
  else if (isSelecting)        { border = "border-primary/50";  bg = "bg-blue-50"; ring = "ring-1 ring-primary/30"; }

  return (
    <button
      type="button"
      disabled={isOccupiedByOther || isConfirmed || !isSelecting && !isAssigned}
      onClick={onClick}
      className={`rounded-xl border-2 ${border} ${bg} ${ring} px-2 py-2.5 flex flex-col items-center gap-0.5 transition-all min-w-[54px]
        ${canClick || (isAssigned && !isConfirmed) ? "cursor-pointer hover:brightness-95" : "cursor-default"}
        ${isOccupiedByOther ? "opacity-50" : ""}`}
    >
      <span className="font-bold text-sm text-slate-700">{tent.code}</span>
      <span className="text-[10px] text-slate-400">{tent.capacity}🛏</span>

      {isConfirmed && gc && <span className={`text-[9px] font-bold ${gc.text}`}>✓ {gc.label}</span>}
      {isAssigned && !isConfirmed && gc && <span className={`text-[9px] font-bold ${gc.text}`}>~{gc.label}</span>}
      {isOccupiedByOther && <span className="text-[9px] text-red-500 font-medium">תפוס</span>}
      {isAvailable && isSelecting && <span className="text-[9px] text-primary font-medium">בחר</span>}
      {tent.is_accessible && <span className="text-[9px]">♿</span>}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function VipAllocationPanel({
  vipRows,
  vipTents,
  vipNeighborhoodId,
  conflictMap,
  myAllocations,
  profile,
  groupId,
  onInvalidate,
}) {
  const [selectedReqIndex, setSelectedReqIndex] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);

  // ── LOCAL ASSIGNMENT STATE (pending save) ──────────────────────────────────
  // Map of reqIndex → { tentId, tentCode } for UI-only pending assignments
  // These are NOT yet persisted. The user clicks "שמור שיבוץ VIP" to persist.
  const [pendingAssignments, setPendingAssignments] = useState({});

  // ── Derive maps from already-persisted allocations ─────────────────────────
  const myActiveVipAllocs = useMemo(
    () => myAllocations.filter(a => a.status !== "CANCELLED" && vipTents.some(t => t.id === a.tent_id)),
    [myAllocations, vipTents]
  );

  // reqIndex → persisted alloc (matched via __vip_req_N__ marker in notes)
  const persistedReqToAlloc = useMemo(() => {
    const map = {};
    myActiveVipAllocs.forEach(a => {
      const m = (a.notes || "").match(/__vip_req_(\d+)__/);
      if (m) map[Number(m[1])] = a;
    });
    return map;
  }, [myActiveVipAllocs]);

  // tentId → persisted alloc
  const persistedTentIdToAlloc = useMemo(() => {
    const map = {};
    myActiveVipAllocs.forEach(a => { map[a.tent_id] = a; });
    return map;
  }, [myActiveVipAllocs]);

  const tentCodeById = useMemo(() => {
    const map = {};
    vipTents.forEach(t => { map[t.id] = t.code; });
    return map;
  }, [vipTents]);

  const tentIdByCode = useMemo(() => {
    const map = {};
    vipTents.forEach(t => { map[t.code] = t.id; });
    return map;
  }, [vipTents]);

  // ── Effective assignment: pending overrides persisted ─────────────────────
  // For each req index, show pending if set, otherwise show persisted
  function getEffectiveAssignment(reqIndex) {
    if (pendingAssignments[reqIndex] !== undefined) {
      // null means "pending removal"
      return pendingAssignments[reqIndex] || null;
    }
    const alloc = persistedReqToAlloc[reqIndex];
    if (!alloc) return null;
    return { tentId: alloc.tent_id, tentCode: tentCodeById[alloc.tent_id] || "?", status: alloc.status };
  }

  // Which tentIds are in use (by any req) in effective state
  const effectiveUsedTentIds = useMemo(() => {
    const used = new Set();
    vipRows.forEach((_, i) => {
      const a = getEffectiveAssignment(i);
      if (a) used.add(a.tentId);
    });
    return used;
  }, [vipRows, pendingAssignments, persistedReqToAlloc]);

  // Does anything need saving?
  const hasPendingChanges = Object.keys(pendingAssignments).length > 0;
  const hasDraftAllocs    = myActiveVipAllocs.some(a => a.status === "DRAFT");
  const hasConflicts      = myActiveVipAllocs.some(a => a.status === "DRAFT" && conflictMap[a.tent_id]);

  // ── Interaction handlers ───────────────────────────────────────────────────

  const handleReqClick = (index) => {
    const eff = getEffectiveAssignment(index);
    if (eff?.status === "CONFIRMED") return;
    setSelectedReqIndex(prev => prev === index ? null : index);
  };

  const handleTentClick = (tent) => {
    if (selectedReqIndex === null) return;
    const eff = getEffectiveAssignment(selectedReqIndex);

    // If this tent is already assigned to THIS req, deselect req (toggle off)
    if (eff?.tentId === tent.id) {
      setSelectedReqIndex(null);
      return;
    }

    // Assign pending
    setPendingAssignments(prev => ({
      ...prev,
      [selectedReqIndex]: { tentId: tent.id, tentCode: tent.code, status: "PENDING" },
    }));
    setSelectedReqIndex(null);
  };

  const handleUnassign = (reqIndex) => {
    const eff = getEffectiveAssignment(reqIndex);
    if (!eff) return;

    if (persistedReqToAlloc[reqIndex]) {
      // Mark as pending removal
      setPendingAssignments(prev => ({ ...prev, [reqIndex]: null }));
    } else {
      // Just remove from pending
      setPendingAssignments(prev => {
        const n = { ...prev };
        delete n[reqIndex];
        return n;
      });
    }
  };

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setServerErrors([]);
    try {
      // Process each pending change
      for (const [reqIdxStr, assignment] of Object.entries(pendingAssignments)) {
        const reqIndex  = Number(reqIdxStr);
        const req       = vipRows[reqIndex];
        const existing  = persistedReqToAlloc[reqIndex];

        if (assignment === null) {
          // Remove: delete draft or cancel confirmed
          if (existing) {
            if (existing.status === "DRAFT") {
              await base44.entities.SleepingAllocation.delete(existing.id);
            } else {
              await base44.entities.SleepingAllocation.update(existing.id, { status: "CANCELLED" });
            }
          }
        } else {
          // Assign / reassign
          const tent = vipTents.find(t => t.id === assignment.tentId);
          if (!tent) continue;

          const payload = {
            tent_id:                       tent.id,
            neighborhood_id:               vipNeighborhoodId,
            group_id:                      groupId,
            operational_group_profile_id:  profile.id,
            arrival_date:                  profile.arrival_date,
            departure_date:                profile.departure_date,
            allocated_pax:                 Math.min(req.people_count || 1, tent.capacity),
            allocation_type:               "STAFF",
            gender_group:                  req.gender_group || "MEN",
            notes:                         `__vip_req_${reqIndex}__ ${req.notes || ""}`.trim(),
            status:                        "DRAFT",
          };

          if (existing) {
            // Reassign: update in place (covers tent change too)
            await base44.entities.SleepingAllocation.update(existing.id, payload);
          } else {
            await base44.entities.SleepingAllocation.create(payload);
          }
        }
      }

      setPendingAssignments({});
      toast.success("שיבוץ VIP נשמר בהצלחה ✓");
      onInvalidate();
    } catch (err) {
      setServerErrors([err.message || "שגיאה בשמירה"]);
      toast.error("שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmAll = async () => {
    if (hasPendingChanges) {
      toast.error("שמור תחילה את השינויים הממתינים");
      return;
    }
    const draftIds = myActiveVipAllocs.filter(a => a.status === "DRAFT").map(a => a.id);
    if (!draftIds.length) { toast.error("אין טיוטות לאישור"); return; }
    setConfirming(true);
    setServerErrors([]);
    const res = await base44.functions.invoke("confirmSleepingAllocations", {
      group_id: groupId,
      draft_allocation_ids: draftIds,
    });
    setConfirming(false);
    if (res.data?.success) {
      toast.success(`${res.data.confirmed_count} הקצאות VIP אושרו ✓`);
      onInvalidate();
    } else {
      setServerErrors(res.data?.errors || ["שגיאה לא ידועה"]);
    }
  };

  // ── Early exit ─────────────────────────────────────────────────────────────

  if (!vipRows.length) {
    return (
      <p className="text-xs text-slate-400 italic py-2">
        לא הוגדרו דרישות VIP לקבוצה זו.
      </p>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4" dir="rtl">

      {/* Step instruction banner */}
      {selectedReqIndex !== null ? (
        <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-primary font-medium">
          <span>בחר אוהל עבור דרישה #{selectedReqIndex + 1}</span>
          <button type="button" onClick={() => setSelectedReqIndex(null)} className="mr-auto text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">
          שלב א׳: לחץ על דרישה · שלב ב׳: לחץ על אוהל פנוי · שלב ג׳: שמור
        </p>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

        {/* LEFT: Requirement compact cards */}
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">דרישות ({vipRows.length})</p>
          <div className="flex flex-wrap gap-2">
            {vipRows.map((req, i) => {
              const eff = getEffectiveAssignment(i);
              return (
                <VipReqCard
                  key={i}
                  req={req}
                  index={i}
                  assignedTentCode={eff?.tentCode || null}
                  assignedStatus={eff?.status || null}
                  isSelected={selectedReqIndex === i}
                  onClick={() => handleReqClick(i)}
                  onUnassign={() => handleUnassign(i)}
                />
              );
            })}
          </div>
        </div>

        {/* RIGHT: VIP tent grid */}
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">
            אוהלי VIP
            {selectedReqIndex !== null && <span className="text-primary font-medium"> ← לחץ לשיוך</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {vipTents.map(tent => {
              const isOccupiedByOther = !!conflictMap[tent.id] && !effectiveUsedTentIds.has(tent.id);
              // find which req this tent is assigned to in effective state
              let myAllocForTent = null;
              vipRows.forEach((_, i) => {
                const eff = getEffectiveAssignment(i);
                if (eff?.tentId === tent.id) myAllocForTent = { ...eff, gender_group: vipRows[i].gender_group };
              });

              return (
                <VipTentCard
                  key={tent.id}
                  tent={tent}
                  isOccupiedByOther={isOccupiedByOther}
                  myAlloc={myAllocForTent}
                  isSelecting={selectedReqIndex !== null}
                  onClick={() => handleTentClick(tent)}
                />
              );
            })}
          </div>
          {vipTents.length === 0 && (
            <p className="text-xs text-slate-400">לא נמצאו אוהלי VIP במלאי.</p>
          )}
        </div>
      </div>

      {/* Error messages */}
      {serverErrors.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-lg px-3 py-2 space-y-1">
          <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> שגיאות:
          </p>
          {serverErrors.map((e, i) => <p key={i} className="text-xs text-red-600">• {e}</p>)}
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
        {/* PRIMARY: Save button — always visible when there are pending changes */}
        {hasPendingChanges && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-1.5 bg-primary hover:bg-primary/90"
          >
            {saving ? "שומר..." : `שמור שיבוץ VIP`}
          </Button>
        )}

        {/* Discard pending */}
        {hasPendingChanges && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPendingAssignments({})}
            disabled={saving}
            className="text-slate-500"
          >
            בטל שינויים
          </Button>
        )}

        {/* Confirm drafts (only after saving, when drafts exist) */}
        {!hasPendingChanges && hasDraftAllocs && (
          <Button
            size="sm"
            onClick={handleConfirmAll}
            disabled={confirming || hasConflicts}
            className="gap-1.5 bg-emerald-700 hover:bg-emerald-800"
          >
            <ShieldCheck className="w-4 h-4" />
            {confirming ? "מאשר..." : `אשר הקצאות VIP (${myActiveVipAllocs.filter(a => a.status === "DRAFT").length})`}
          </Button>
        )}

        {hasConflicts && (
          <p className="text-xs text-red-600 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> יש קונפליקטים — לא ניתן לאשר
          </p>
        )}

        {/* Status hint when nothing pending */}
        {!hasPendingChanges && !hasDraftAllocs && myActiveVipAllocs.length > 0 && (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> כל ההקצאות אושרו
          </span>
        )}
      </div>
    </div>
  );
}