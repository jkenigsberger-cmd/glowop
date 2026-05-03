import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldCheck, AlertTriangle, X, Shield, Car, User, Star, BookOpen, BedDouble } from "lucide-react";
import { toast } from "sonner";

// ── Config ────────────────────────────────────────────────────────────────────

const GENDER_CFG = {
  WOMEN: { label: "נשים",  bg: "bg-orange-50",  border: "border-orange-300",  text: "text-orange-700",  dot: "bg-orange-400",  activeBg: "bg-orange-100" },
  MEN:   { label: "גברים", bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", dot: "bg-emerald-500", activeBg: "bg-emerald-100" },
  GIRLS: { label: "בנות",  bg: "bg-orange-50",  border: "border-orange-300",  text: "text-orange-700",  dot: "bg-orange-400",  activeBg: "bg-orange-100" },
  BOYS:  { label: "בנים",  bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", dot: "bg-emerald-500", activeBg: "bg-emerald-100" },
};

const PURPOSE_CFG = {
  STAFF:    { label: "צוות",   Icon: User    },
  SECURITY: { label: "אבטחה",  Icon: Shield  },
  DRIVER:   { label: "נהג",    Icon: Car     },
  VIP:      { label: "VIP",    Icon: Star    },
  GUIDE:    { label: "מדריך",  Icon: BookOpen },
};

function getGenderCfg(g) { return GENDER_CFG[g] || GENDER_CFG.MEN; }
function getPurposeCfg(p) {
  if (!p) return PURPOSE_CFG.STAFF;
  return PURPOSE_CFG[p.toUpperCase()] || { label: p, Icon: User };
}

// ── Assignment Dialog ─────────────────────────────────────────────────────────
// Opens after user selects req → tent. Lets them confirm/adjust/release.

function AssignmentDialog({ req, reqIndex, tent, existingAlloc, profile, groupId, neighborhoodId, onSaved, onReleased, onClose }) {
  const gc = getGenderCfg(req.gender_group);
  const pc = getPurposeCfg(req.purpose);
  const { Icon } = pc;

  // Normalise gender to MEN/WOMEN for VIP (adult staff)
  const defaultGender = (req.gender_group === "BOYS" || req.gender_group === "MEN") ? "MEN" : "WOMEN";
  const existingGender = existingAlloc?.gender_group;
  const normaliseGender = (g) => (g === "BOYS" || g === "MEN") ? "MEN" : "WOMEN";

  const [gender, setGender]   = useState(existingGender ? normaliseGender(existingGender) : defaultGender);
  const [pax,    setPax]      = useState(existingAlloc?.allocated_pax ?? Math.min(req.people_count || 1, tent.capacity));
  const [notes,  setNotes]    = useState((existingAlloc?.notes || "").replace(/__vip_req_\d+__\s*/g, "").trim());
  const [saving,  setSaving]  = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [errors,  setErrors]  = useState([]);

  const isReassign = !!existingAlloc;

  // Frontend validation — quick UX feedback before hitting the server
  const validate = () => {
    const errs = [];
    if (!gender) errs.push("יש לבחור מגדר");
    if (pax < 1) errs.push("מספר האנשים חייב להיות לפחות 1");
    if (pax > tent.capacity) errs.push(`מספר האנשים חורג מקיבולת האוהל (${tent.capacity})`);
    if (pax > 3) errs.push("מקסימום 3 אנשים לאוהל VIP");
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (errs.length) { setErrors(errs); return; }
    setSaving(true);
    setErrors([]);
    try {
      // All conflict checking and persistence is done server-side
      const res = await base44.functions.invoke("saveVipSleepingAllocation", {
        allocation_id:                existingAlloc?.id || null,
        group_id:                     groupId,
        operational_group_profile_id: profile.id,
        tent_id:                      tent.id,
        requirement_index:            reqIndex,
        gender_group:                 gender,
        allocated_pax:                Number(pax),
        notes:                        notes,
      });
      if (res.data?.success) {
        toast.success(`אוהל ${tent.code} שויך לדרישה #${reqIndex + 1} ✓`);
        onSaved();
      } else {
        setErrors([res.data?.error || "שגיאה בשמירה"]);
      }
    } catch (err) {
      // Extract Hebrew error message from backend response if available
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message;
      setErrors([serverMsg || `האוהל תפוס או שגוי — לא ניתן לשמור`]);
    } finally {
      setSaving(false);
    }
  };

  const handleRelease = async () => {
    if (!existingAlloc) { onReleased(); return; }
    setReleasing(true);
    setErrors([]);
    try {
      if (existingAlloc.status === "DRAFT") {
        await base44.entities.SleepingAllocation.delete(existingAlloc.id);
      } else {
        await base44.entities.SleepingAllocation.update(existingAlloc.id, { status: "CANCELLED" });
      }
      toast.success(`אוהל ${tent.code} שוחרר`);
      onReleased();
    } catch (err) {
      setErrors([err.message || "שגיאה בשחרור"]);
    } finally {
      setReleasing(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-base flex items-center gap-2">
            <BedDouble className="w-4 h-4 text-primary" />
            {isReassign ? "עריכת שיוך VIP" : "שיוך אוהל VIP"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary row */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
            {/* Req badge */}
            <div className={`rounded-lg border ${gc.border} ${gc.bg} px-2.5 py-2 flex flex-col items-center gap-0.5 min-w-[64px]`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border ${gc.border} ${gc.bg}`}>
                <Icon className={`w-3.5 h-3.5 ${gc.text}`} />
              </div>
              <span className={`text-[10px] font-bold ${gc.text}`}>{gc.label}</span>
              <span className="text-[9px] text-slate-500">{pc.label}</span>
              <span className={`text-[10px] font-semibold ${gc.text}`}>{req.people_count} איש</span>
              <span className="text-[9px] text-slate-400">דרישה #{reqIndex + 1}</span>
            </div>

            <div className="text-slate-300 text-lg font-light">→</div>

            {/* Tent badge */}
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 px-3 py-2 flex flex-col items-center gap-0.5 min-w-[60px]">
              <BedDouble className="w-5 h-5 text-primary/60" />
              <span className="text-lg font-bold text-primary">{tent.code}</span>
              <span className="text-[10px] text-slate-400">{tent.capacity} 🛏️</span>
              {tent.is_accessible && <span className="text-[10px]">♿</span>}
            </div>
          </div>

          {/* Editable fields */}
          <div className="space-y-3">
            {/* Gender toggle */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">מגדר</label>
              <div className="flex gap-2">
                {[
                  { value: "MEN",   label: "גברים", color: "emerald" },
                  { value: "WOMEN", label: "נשים",  color: "orange"  },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGender(opt.value)}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      gender === opt.value
                        ? opt.color === "emerald"
                          ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                          : "border-orange-400 bg-orange-50 text-orange-700"
                        : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pax stepper */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">
                מספר אנשים
                <span className="text-slate-400 font-normal mr-1">(מקס׳ {Math.min(tent.capacity, 3)})</span>
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPax(p => Math.max(1, p - 1))}
                  className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 text-lg font-bold hover:bg-slate-50 transition-colors flex items-center justify-center"
                >−</button>
                <span className="text-2xl font-bold text-slate-700 min-w-[32px] text-center">{pax}</span>
                <button
                  type="button"
                  onClick={() => setPax(p => Math.min(Math.min(tent.capacity, 3), p + 1))}
                  className="w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 text-lg font-bold hover:bg-slate-50 transition-colors flex items-center justify-center"
                >+</button>
                {/* Dot indicators */}
                <div className="flex gap-1 mr-2">
                  {[1,2,3].map(n => (
                    <span key={n} className={`w-2.5 h-2.5 rounded-full transition-colors ${n <= pax ? (gender === "MEN" ? "bg-emerald-400" : "bg-orange-400") : "bg-slate-200"}`} />
                  ))}
                </div>
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
          </div>

          {/* Validation errors */}
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
            {/* Release — only when something is assigned */}
            {isReassign && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleRelease}
                disabled={releasing || saving}
                className="text-red-500 border-red-200 hover:bg-red-50 gap-1"
              >
                <X className="w-3.5 h-3.5" />
                {releasing ? "משחרר..." : "שחרר אוהל"}
              </Button>
            )}
            <div className="flex-1" />
            <Button type="button" size="sm" variant="outline" onClick={onClose} disabled={saving || releasing}>
              ביטול
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving || releasing}
              className="bg-primary hover:bg-primary/90 gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {saving ? "שומר..." : isReassign ? "עדכן שיוך" : "שמור שיוך"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── VIP Requirement Card (compact square) ─────────────────────────────────────

function VipReqCard({ req, index, assignedTentCode, assignedStatus, isSelected, onClick }) {
  const gc = getGenderCfg(req.gender_group);
  const pc = getPurposeCfg(req.purpose);
  const { Icon } = pc;

  const isAssigned  = !!assignedTentCode;
  const isConfirmed = assignedStatus === "CONFIRMED";
  const isDraft     = isAssigned && !isConfirmed;

  let borderCls = gc.border;
  let bgCls     = gc.bg;
  let shadow    = "shadow-sm";

  if (isConfirmed) {
    borderCls = "border-emerald-400"; bgCls = "bg-emerald-50"; shadow = "shadow-md ring-2 ring-emerald-200";
  } else if (isDraft) {
    borderCls = "border-amber-400"; bgCls = "bg-amber-50"; shadow = "shadow-md ring-2 ring-amber-200";
  } else if (isSelected) {
    borderCls = "border-primary"; bgCls = "bg-blue-50"; shadow = "shadow-lg ring-2 ring-primary/30";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isConfirmed}
      title={isConfirmed ? "מאושר — לא ניתן לערוך" : undefined}
      className={`relative rounded-2xl border-2 ${borderCls} ${bgCls} ${shadow} px-3.5 py-3.5 flex flex-col items-center gap-1.5 min-w-[88px] max-w-[100px] cursor-pointer transition-all hover:scale-105 active:scale-100 disabled:cursor-default disabled:hover:scale-100`}
    >
      {/* index top-right */}
      <span className="absolute top-2 right-2 text-[9px] font-bold text-slate-400/80">#{index + 1}</span>

      {/* status top-left */}
      {isConfirmed && <span className="absolute top-2 left-2 text-[10px] text-emerald-500 font-bold">✓</span>}
      {isDraft     && <span className="absolute top-2 left-2 text-[10px] text-amber-500 font-bold">~</span>}
      {isSelected && !isAssigned && <span className="absolute top-2 left-2 text-[10px] text-primary font-bold animate-pulse">●</span>}

      {/* Purpose icon circle */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${gc.border} ${gc.activeBg} mt-1`}>
        <Icon className={`w-5 h-5 ${gc.text}`} />
      </div>

      {/* People dots */}
      <div className="flex items-center gap-1">
        {Array.from({ length: Math.min(req.people_count || 1, 3) }).map((_, i) => (
          <span key={i} className={`w-2 h-2 rounded-full ${gc.dot}`} />
        ))}
      </div>

      {/* Gender */}
      <span className={`text-[11px] font-bold ${gc.text} leading-none`}>{gc.label}</span>

      {/* Purpose */}
      <span className="text-[10px] text-slate-500 leading-none">{pc.label}</span>

      {/* Count */}
      <span className={`text-xs font-semibold ${gc.text}`}>{req.people_count} איש</span>

      {/* Assigned tent badge */}
      {isAssigned ? (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border leading-none ${
          isConfirmed ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-amber-100 text-amber-700 border-amber-300"
        }`}>
          אוהל {assignedTentCode}
        </span>
      ) : (
        <span className={`text-[10px] leading-none ${isSelected ? "text-primary font-semibold" : "text-slate-400"}`}>
          {isSelected ? "← בחר אוהל" : "לא שויך"}
        </span>
      )}
    </button>
  );
}

// ── VIP Tent Card ─────────────────────────────────────────────────────────────

function VipTentCard({ tent, isOccupiedByOther, myAllocForTent, isSelecting, isSelectedByAnotherReq, onClick }) {
  const isAssigned  = !!myAllocForTent;
  const isConfirmed = myAllocForTent?.status === "CONFIRMED";
  const gc          = myAllocForTent ? getGenderCfg(myAllocForTent.gender_group) : null;

  const isClickable = isSelecting && !isOccupiedByOther && !isConfirmed;

  let borderCls = "border-slate-200";
  let bgCls     = "bg-white";
  let shadow    = "shadow-sm";
  let opacity   = "";

  if (isConfirmed) {
    borderCls = "border-emerald-400"; bgCls = "bg-emerald-50"; shadow = "shadow-md";
  } else if (isAssigned) {
    borderCls = "border-amber-400"; bgCls = "bg-amber-50"; shadow = "shadow-md";
  } else if (isOccupiedByOther) {
    borderCls = "border-red-200"; bgCls = "bg-red-50/80"; opacity = "opacity-50";
  } else if (isSelecting) {
    borderCls = "border-primary/40"; bgCls = "bg-blue-50/60"; shadow = "shadow-md";
  }

  return (
    <button
      type="button"
      disabled={isOccupiedByOther || isConfirmed || (!isSelecting && !isAssigned)}
      onClick={onClick}
      className={`rounded-xl border-2 ${borderCls} ${bgCls} ${shadow} ${opacity} px-2.5 py-3 flex flex-col items-center gap-1 min-w-[60px] transition-all
        ${isClickable || (isAssigned && !isConfirmed) ? "cursor-pointer hover:scale-105 active:scale-100" : "cursor-default"}`}
    >
      <span className="font-bold text-sm text-slate-700">{tent.code}</span>
      <span className="text-[10px] text-slate-400">{tent.capacity}🛏</span>

      {isConfirmed && gc && (
        <span className={`text-[9px] font-bold ${gc.text}`}>✓ {gc.label}</span>
      )}
      {isAssigned && !isConfirmed && gc && (
        <span className={`text-[9px] font-bold ${gc.text}`}>~{gc.label}</span>
      )}
      {isOccupiedByOther && (
        <span className="text-[9px] text-red-500 font-semibold">תפוס</span>
      )}
      {!isAssigned && !isOccupiedByOther && isSelecting && (
        <span className="text-[9px] text-primary font-semibold">בחר</span>
      )}
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
  // dialogTarget: { reqIndex, tent } — open the assignment dialog
  const [dialogTarget, setDialogTarget] = useState(null);
  const [confirming, setConfirming]     = useState(false);
  const [serverErrors, setServerErrors] = useState([]);

  // ── Persisted allocation maps ──────────────────────────────────────────────
  const myActiveVipAllocs = useMemo(
    () => myAllocations.filter(a => a.status !== "CANCELLED" && vipTents.some(t => t.id === a.tent_id)),
    [myAllocations, vipTents]
  );

  // reqIndex → persisted alloc (via __vip_req_N__ in notes)
  const persistedReqToAlloc = useMemo(() => {
    const map = {};
    myActiveVipAllocs.forEach(a => {
      const m = (a.notes || "").match(/__vip_req_(\d+)__/);
      if (m) map[Number(m[1])] = a;
    });
    return map;
  }, [myActiveVipAllocs]);

  const tentCodeById = useMemo(() => {
    const map = {};
    vipTents.forEach(t => { map[t.id] = t.code; });
    return map;
  }, [vipTents]);

  // tentId → { tentId, tentCode, status, gender_group } for tent card display
  const tentEffectiveAlloc = useMemo(() => {
    const map = {};
    Object.entries(persistedReqToAlloc).forEach(([, alloc]) => {
      map[alloc.tent_id] = {
        tentId: alloc.tent_id,
        tentCode: tentCodeById[alloc.tent_id] || "?",
        status: alloc.status,
        gender_group: alloc.gender_group,
      };
    });
    return map;
  }, [persistedReqToAlloc, tentCodeById]);

  // ── Derived status ─────────────────────────────────────────────────────────
  const hasDraftAllocs = myActiveVipAllocs.some(a => a.status === "DRAFT");
  const hasConflicts   = myActiveVipAllocs.some(a => a.status === "DRAFT" && conflictMap[a.tent_id]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleReqClick = (index) => {
    const alloc = persistedReqToAlloc[index];
    if (alloc?.status === "CONFIRMED") return;

    if (selectedReqIndex === index) {
      setSelectedReqIndex(null); // deselect
      return;
    }

    // If already assigned (draft) — open dialog directly for edit
    if (alloc) {
      const tent = vipTents.find(t => t.id === alloc.tent_id);
      if (tent) {
        setDialogTarget({ reqIndex: index, tent });
        setSelectedReqIndex(null);
        return;
      }
    }

    setSelectedReqIndex(index);
  };

  const handleTentClick = (tent) => {
    if (selectedReqIndex === null) {
      // If tent is assigned by me, open edit dialog
      const assignedReqIndex = Object.entries(persistedReqToAlloc).find(
        ([, a]) => a.tent_id === tent.id
      )?.[0];
      if (assignedReqIndex !== undefined) {
        const alloc = persistedReqToAlloc[Number(assignedReqIndex)];
        if (alloc?.status !== "CONFIRMED") {
          setDialogTarget({ reqIndex: Number(assignedReqIndex), tent });
        }
      }
      return;
    }

    // Open dialog to confirm assignment
    setDialogTarget({ reqIndex: selectedReqIndex, tent });
    setSelectedReqIndex(null);
  };

  const handleDialogSaved = () => {
    setDialogTarget(null);
    onInvalidate();
  };

  const handleDialogReleased = () => {
    setDialogTarget(null);
    onInvalidate();
  };

  const handleConfirmAll = async () => {
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
    return <p className="text-xs text-slate-400 italic py-2">לא הוגדרו דרישות VIP לקבוצה זו.</p>;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5" dir="rtl">

      {/* Step instruction */}
      {selectedReqIndex !== null ? (
        <div className="bg-primary/8 border border-primary/25 rounded-xl px-4 py-2.5 flex items-center gap-3 text-sm text-primary font-medium shadow-sm">
          <span className="text-base">👆</span>
          <span>בחרת דרישה #{selectedReqIndex + 1} — כעת לחץ על אוהל פנוי</span>
          <button type="button" onClick={() => setSelectedReqIndex(null)} className="mr-auto text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-[11px] text-slate-500">
          <span className="font-semibold text-slate-600">כיצד לשבץ:</span>
          {" "}לחץ על דרישה ← בחר אוהל ← אשר בחלון
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

        {/* LEFT: Requirement cards */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">דרישות ({vipRows.length})</p>
          <div className="flex flex-wrap gap-3">
            {vipRows.map((req, i) => {
              const alloc = persistedReqToAlloc[i];
              const tentCode = alloc ? tentCodeById[alloc.tent_id] || "?" : null;
              return (
                <VipReqCard
                  key={i}
                  req={req}
                  index={i}
                  assignedTentCode={tentCode}
                  assignedStatus={alloc?.status || null}
                  isSelected={selectedReqIndex === i}
                  onClick={() => handleReqClick(i)}
                />
              );
            })}
          </div>
        </div>

        {/* RIGHT: Tent grid */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            אוהלי VIP
            {selectedReqIndex !== null && <span className="text-primary normal-case mr-1.5">← לחץ לשיוך</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {vipTents.map(tent => {
              // A tent occupied by OTHER group (not me) in conflicting dates
              const occupiedByOther = !!conflictMap[tent.id];
              // My effective alloc for this tent
              const myAllocForTent = tentEffectiveAlloc[tent.id] || null;
              // Tent is "mine" so override the occupied-by-other flag
              const isOccupiedByOther = occupiedByOther && !myAllocForTent;

              return (
                <VipTentCard
                  key={tent.id}
                  tent={tent}
                  isOccupiedByOther={isOccupiedByOther}
                  myAllocForTent={myAllocForTent}
                  isSelecting={selectedReqIndex !== null}
                  onClick={() => handleTentClick(tent)}
                />
              );
            })}
          </div>
          {vipTents.length === 0 && <p className="text-xs text-slate-400">לא נמצאו אוהלי VIP במלאי.</p>}
        </div>
      </div>

      {/* Error display */}
      {serverErrors.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> שגיאות:
          </p>
          {serverErrors.map((e, i) => <p key={i} className="text-xs text-red-600">• {e}</p>)}
        </div>
      )}

      {/* Action bar */}
      {(hasDraftAllocs || myActiveVipAllocs.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          {hasDraftAllocs && (
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
          {!hasDraftAllocs && myActiveVipAllocs.length > 0 && (
            <span className="text-xs text-emerald-600 flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" /> כל ההקצאות אושרו
            </span>
          )}
        </div>
      )}

      {/* Assignment Dialog */}
      {dialogTarget && (
        <AssignmentDialog
          req={vipRows[dialogTarget.reqIndex]}
          reqIndex={dialogTarget.reqIndex}
          tent={dialogTarget.tent}
          existingAlloc={persistedReqToAlloc[dialogTarget.reqIndex] || null}
          profile={profile}
          groupId={groupId}
          neighborhoodId={vipNeighborhoodId}
          onSaved={handleDialogSaved}
          onReleased={handleDialogReleased}
          onClose={() => setDialogTarget(null)}
        />
      )}
    </div>
  );
}