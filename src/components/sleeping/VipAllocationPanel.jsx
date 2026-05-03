import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, AlertTriangle, X, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

// ── Shared config ────────────────────────────────────────────────────────────

const GENDER_CFG = {
  WOMEN:  { label: "נשים",  bg: "bg-orange-50",  border: "border-orange-300",  text: "text-orange-700",  ring: "ring-orange-300",  dot: "bg-orange-400"  },
  MEN:    { label: "גברים", bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", ring: "ring-emerald-300", dot: "bg-emerald-400" },
  GIRLS:  { label: "בנות",  bg: "bg-orange-50",  border: "border-orange-300",  text: "text-orange-700",  ring: "ring-orange-300",  dot: "bg-orange-400"  },
  BOYS:   { label: "בנים",  bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", ring: "ring-emerald-300", dot: "bg-emerald-400" },
};

const PURPOSE_LABELS = {
  STAFF:    "צוות",
  SECURITY: "אבטחה",
  DRIVER:   "נהג",
  VIP:      "VIP",
  GUIDE:    "מדריך",
};

function getPurposeLabel(p) {
  if (!p) return "צוות";
  return PURPOSE_LABELS[p.toUpperCase()] || p;
}

function getGenderCfg(g) {
  return GENDER_CFG[g] || GENDER_CFG.MEN;
}

// ── overlap: [a1,a2) ∩ [b1,b2) ────────────────────────────────────────────
function datesOverlap(a1, a2, b1, b2) {
  if (!a1 || !a2 || !b1 || !b2) return false;
  return a1 < b2 && b1 < a2;
}

// ── Requirement card ─────────────────────────────────────────────────────────

function RequirementCard({ req, index, assignedTent, isSelected, onClick }) {
  const gc = getGenderCfg(req.gender_group);
  const isAssigned = !!assignedTent;
  const isConfirmed = assignedTent?.status === "CONFIRMED";

  let border = gc.border;
  let bg = gc.bg;
  let ring = "";
  if (isConfirmed)      { border = "border-emerald-400"; bg = "bg-emerald-50"; ring = "ring-2 ring-emerald-300"; }
  else if (isAssigned)  { border = "border-amber-400";   bg = "bg-amber-50";   ring = "ring-2 ring-amber-300"; }
  else if (isSelected)  { border = "border-primary";     bg = "bg-primary/5";  ring = "ring-2 ring-primary/30"; }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isConfirmed}
      className={`relative rounded-xl border-2 ${border} ${bg} ${ring} px-3 py-3 w-full text-right flex flex-col gap-1.5 transition-all hover:brightness-95 disabled:cursor-default`}
    >
      {/* index */}
      <span className="absolute top-2 left-2 text-[9px] font-bold text-slate-400">#{index + 1}</span>

      {/* status indicator */}
      {isConfirmed && <span className="absolute top-2 right-2 text-[10px] text-emerald-600 font-bold">✓ מאושר</span>}
      {isAssigned && !isConfirmed && <span className="absolute top-2 right-2 text-[10px] text-amber-600 font-bold">~ טיוטה</span>}
      {isSelected && !isAssigned && <span className="absolute top-2 right-2 text-[10px] text-primary font-bold">← בחר אוהל</span>}

      {/* main info */}
      <div className="flex items-center gap-2 mt-3">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${gc.bg} ${gc.border} ${gc.text}`}>
          {gc.label}
        </span>
        <span className="text-xs text-slate-600 font-medium">{getPurposeLabel(req.purpose)}</span>
        <span className="text-xs text-slate-500">{req.people_count} {req.people_count === 1 ? "אדם" : "אנשים"}</span>
      </div>

      {req.notes && (
        <p className="text-[10px] text-slate-400 truncate">{req.notes}</p>
      )}

      {/* assigned tent badge */}
      {isAssigned && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full self-start ${isConfirmed ? "bg-emerald-100 text-emerald-700 border border-emerald-300" : "bg-amber-100 text-amber-700 border border-amber-300"}`}>
          שויך לאוהל {assignedTent.tentCode}
        </span>
      )}
      {!isAssigned && !isSelected && (
        <span className="text-[10px] text-slate-400">לחץ לשיוך אוהל</span>
      )}
    </button>
  );
}

// ── Real tent card ────────────────────────────────────────────────────────────

function TentCard({ tent, isOccupiedByOther, isAssignedByMe, assignedAlloc, isSelectedReq, onClick }) {
  const isConfirmed = assignedAlloc?.status === "CONFIRMED";
  const canSelect = isSelectedReq && !isOccupiedByOther && !isConfirmed;

  let border = "border-slate-200";
  let bg = "bg-white";
  let ring = "";

  if (isConfirmed)          { border = "border-emerald-400"; bg = "bg-emerald-50"; }
  else if (isAssignedByMe)  { border = "border-amber-400";   bg = "bg-amber-50"; }
  else if (isOccupiedByOther) { border = "border-red-200";   bg = "bg-red-50"; }
  else if (canSelect)       { border = "border-primary/50";  bg = "bg-primary/5"; ring = "ring-1 ring-primary/30"; }

  const gc = assignedAlloc ? getGenderCfg(assignedAlloc.gender_group) : null;

  return (
    <button
      type="button"
      disabled={isOccupiedByOther || isConfirmed}
      onClick={onClick}
      className={`rounded-xl border-2 ${border} ${bg} ${ring} px-2 py-3 flex flex-col items-center gap-1 transition-all
        ${!isOccupiedByOther && !isConfirmed ? "hover:brightness-95 cursor-pointer" : "cursor-default opacity-60"}`}
    >
      <span className="font-bold text-sm text-slate-700">{tent.code}</span>
      <span className="text-[10px] text-slate-400">{tent.capacity} 🛏️</span>

      {isConfirmed && gc && (
        <span className={`text-[9px] font-bold ${gc.text}`}>✓ {gc.label}</span>
      )}
      {isAssignedByMe && !isConfirmed && gc && (
        <span className={`text-[9px] font-bold ${gc.text}`}>~ {gc.label}</span>
      )}
      {isOccupiedByOther && (
        <span className="text-[9px] text-red-500 font-medium">תפוס</span>
      )}
      {!isAssignedByMe && !isOccupiedByOther && canSelect && (
        <span className="text-[9px] text-primary font-medium">בחר</span>
      )}
      {tent.is_accessible && <span className="text-[9px]">♿</span>}
    </button>
  );
}

// ── Edit form (shown inline after tent selection) ─────────────────────────────

function AssignEditForm({ req, tent, existingAlloc, profile, groupId, neighborhoodId, onSaved, onCancel, _reqIndex }) {
  // Strip any existing marker from notes for display
  const cleanNotes = (existingAlloc?.notes || req.notes || "").replace(/__vip_req_\d+__\s*/g, "");
  const [form, setForm] = useState({
    gender_group: existingAlloc?.gender_group || req.gender_group || "MEN",
    allocated_pax: existingAlloc?.allocated_pax ?? req.people_count ?? 1,
    notes: cleanNotes,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const genderOptions = [
    { value: "BOYS",  label: "בנים" },
    { value: "GIRLS", label: "בנות" },
    { value: "MEN",   label: "גברים" },
    { value: "WOMEN", label: "נשים" },
  ];

  const handleSave = async () => {
    if (form.allocated_pax < 1 || form.allocated_pax > tent.capacity) return;
    setSaving(true);
    const payload = {
      tent_id: tent.id,
      neighborhood_id: neighborhoodId,
      group_id: groupId,
      operational_group_profile_id: profile.id,
      arrival_date: profile.arrival_date,
      departure_date: profile.departure_date,
      allocated_pax: Number(form.allocated_pax),
      allocation_type: "STAFF",
      gender_group: form.gender_group,
      // embed req index marker so we can reliably match req → allocation
      notes: `__vip_req_${_reqIndex}__ ${form.notes}`.trim(),
      status: "DRAFT",
    };
    if (existingAlloc) {
      await base44.entities.SleepingAllocation.update(existingAlloc.id, payload);
    } else {
      await base44.entities.SleepingAllocation.create(payload);
    }
    setSaving(false);
    onSaved();
    toast.success("שיוך VIP נשמר כטיוטה");
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-3 text-sm" dir="rtl">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-700 text-xs">
          שיוך אוהל <strong>{tent.code}</strong> ← {getPurposeLabel(req.purpose)} · {getGenderCfg(req.gender_group).label}
        </p>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-500">מגדר</label>
          <Select value={form.gender_group} onValueChange={v => set("gender_group", v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {genderOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-500">מספר אנשים (מקס׳ {tent.capacity})</label>
          <Input
            type="number" min="1" max={tent.capacity}
            value={form.allocated_pax}
            onChange={e => set("allocated_pax", Number(e.target.value))}
            className="h-8 text-xs"
          />
          {form.allocated_pax > tent.capacity && (
            <p className="text-[10px] text-red-500">חורג מקיבולת</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-medium text-slate-500">הערות</label>
        <Input
          value={form.notes}
          onChange={e => set("notes", e.target.value)}
          className="h-8 text-xs" placeholder="הערות..."
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>ביטול</Button>
        <Button
          size="sm" className="h-7 text-xs"
          onClick={handleSave}
          disabled={saving || form.allocated_pax < 1 || form.allocated_pax > tent.capacity}
        >
          {saving ? "שומר..." : "שמור כטיוטה"}
        </Button>
      </div>
    </div>
  );
}

// ── Main VipAllocationPanel ───────────────────────────────────────────────────

export default function VipAllocationPanel({
  vipRows,           // from vip_tent_requirements_json
  vipTents,          // Tent[] — only VIP tents (working)
  vipNeighborhoodId, // id of the VIP neighborhood
  conflictMap,       // { [tent_id]: { gender_group, group_id } } — occupied by OTHER group
  myAllocations,     // SleepingAllocation[] for this group (all statuses)
  profile,
  groupId,
  onInvalidate,
}) {
  // selectedReqIndex: which requirement card is currently "active" (waiting for tent pick)
  const [selectedReqIndex, setSelectedReqIndex] = useState(null);
  // editTarget: { reqIndex, tent } — show inline edit form
  const [editTarget, setEditTarget] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);

  // ── Build assignment map: reqIndex → SleepingAllocation ──────────────────
  // We match requirement rows → allocations by storing req index in the notes
  // field as a marker "__req_<index>__", OR by order of creation.
  // Better approach: store in notes a structured prefix so we can reliably match.
  // We use allocation notes that contain "__vip_req_<index>__" as a key.
  // If no such marker, we do best-effort matching by gender order.

  const myActiveVipAllocs = useMemo(
    () => myAllocations.filter(a => {
      return a.status !== "CANCELLED" && vipTents.some(t => t.id === a.tent_id);
    }),
    [myAllocations, vipTents]
  );

  // reqIndex → allocation (matched via notes marker __vip_req_N__)
  const reqToAlloc = useMemo(() => {
    const map = {};
    myActiveVipAllocs.forEach(a => {
      const m = (a.notes || "").match(/__vip_req_(\d+)__/);
      if (m) map[Number(m[1])] = a;
    });
    return map;
  }, [myActiveVipAllocs]);

  // tentId → allocation (for tent card display)
  const tentIdToAlloc = useMemo(() => {
    const map = {};
    myActiveVipAllocs.forEach(a => { map[a.tent_id] = a; });
    return map;
  }, [myActiveVipAllocs]);

  // tentId → tent.code for display
  const tentCodeById = useMemo(() => {
    const map = {};
    vipTents.forEach(t => { map[t.id] = t.code; });
    return map;
  }, [vipTents]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleReqClick = (index) => {
    const alloc = reqToAlloc[index];
    if (alloc?.status === "CONFIRMED") return; // confirmed, no edit
    if (selectedReqIndex === index) {
      setSelectedReqIndex(null); // deselect
    } else {
      setSelectedReqIndex(index);
      setEditTarget(null);
    }
  };

  const handleTentClick = (tent) => {
    if (selectedReqIndex === null) return;
    setEditTarget({ reqIndex: selectedReqIndex, tent });
    setSelectedReqIndex(null);
  };

  const handleUnassign = async (reqIndex) => {
    const alloc = reqToAlloc[reqIndex];
    if (!alloc) return;
    if (alloc.status === "DRAFT") {
      await base44.entities.SleepingAllocation.delete(alloc.id);
    } else {
      await base44.entities.SleepingAllocation.update(alloc.id, { status: "CANCELLED" });
    }
    onInvalidate();
    toast.success("שיוך VIP בוטל");
  };

  const handleSaved = () => {
    setEditTarget(null);
    setSelectedReqIndex(null);
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
      toast.success(`${res.data.confirmed_count} הקצאות VIP אושרו`);
      onInvalidate();
    } else {
      setServerErrors(res.data?.errors || ["שגיאה לא ידועה"]);
    }
  };

  const hasDrafts = myActiveVipAllocs.some(a => a.status === "DRAFT");
  const hasConflicts = myActiveVipAllocs.some(a => a.status === "DRAFT" && conflictMap[a.tent_id]);

  if (!vipRows.length) {
    return (
      <div className="text-xs text-slate-400 italic py-2">
        לא הוגדרו דרישות VIP לקבוצה זו בטופס הדרישות.
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">

      {/* ── instruction when a req is selected ── */}
      {selectedReqIndex !== null && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-primary font-medium">
          <ArrowLeft className="w-3.5 h-3.5" />
          בחר אוהל מתוך הרשימה למטה עבור דרישה #{selectedReqIndex + 1}
          <button type="button" className="mr-auto text-slate-400 hover:text-slate-600" onClick={() => setSelectedReqIndex(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── Two-column layout: Requirements | Tents ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* LEFT: Requirement cards */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">דרישות VIP ({vipRows.length})</p>
          {vipRows.map((req, i) => {
            const alloc = reqToAlloc[i];
            const allocWithCode = alloc ? { ...alloc, tentCode: tentCodeById[alloc.tent_id] || "?" } : null;
            return (
              <div key={i} className="space-y-1">
                <RequirementCard
                  req={req}
                  index={i}
                  assignedTent={allocWithCode}
                  isSelected={selectedReqIndex === i}
                  onClick={() => handleReqClick(i)}
                />
                {alloc && alloc.status !== "CONFIRMED" && (
                  <button
                    type="button"
                    onClick={() => handleUnassign(i)}
                    className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-0.5 pr-1"
                  >
                    <X className="w-3 h-3" /> בטל שיוך
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* RIGHT: Real tent cards */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">
            אוהלי VIP פנויים
            {selectedReqIndex !== null && <span className="text-primary mr-1">← לחץ לשיוך</span>}
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {vipTents.map(tent => {
              const isOccupiedByOther = !!conflictMap[tent.id];
              const myAlloc = tentIdToAlloc[tent.id];
              const isAssignedByMe = !!myAlloc;

              return (
                <TentCard
                  key={tent.id}
                  tent={tent}
                  isOccupiedByOther={isOccupiedByOther && !isAssignedByMe}
                  isAssignedByMe={isAssignedByMe}
                  assignedAlloc={myAlloc}
                  isSelectedReq={selectedReqIndex !== null}
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

      {/* ── Inline edit form ── */}
      {editTarget && (
        <AssignEditForm
          req={vipRows[editTarget.reqIndex]}
          tent={editTarget.tent}
          existingAlloc={reqToAlloc[editTarget.reqIndex] || null}
          profile={profile}
          groupId={groupId}
          neighborhoodId={vipNeighborhoodId}
          onSaved={handleSaved}
          onCancel={() => setEditTarget(null)}
          // Pass req index as marker in notes so we can reliably match later
          _reqIndex={editTarget.reqIndex}
        />
      )}

      {/* ── Confirm / errors ── */}
      {serverErrors.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> שגיאות:
          </p>
          {serverErrors.map((e, i) => <p key={i} className="text-xs text-red-600">• {e}</p>)}
        </div>
      )}

      {(hasDrafts || myActiveVipAllocs.length > 0) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {hasDrafts && (
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
        </div>
      )}
    </div>
  );
}