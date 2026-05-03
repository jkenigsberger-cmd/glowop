import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldCheck, AlertTriangle, Lightbulb, Shield, Car } from "lucide-react";
import { toast } from "sonner";

import SleepingRequirementsSummary from "./SleepingRequirementsSummary";
import StudentNeighborhoodPanel from "./StudentNeighborhoodPanel";
import TentAllocationModal from "./TentAllocationModal";

// ── helpers ────────────────────────────────────────────────────────────────

function datesOverlap(a1, a2, b1, b2) {
  if (!a1 || !a2 || !b1 || !b2) return false;
  return a1 < b2 && b1 < a2;
}

function parseDist(json) {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

function suggestNeighborhoods(neighborhoods, allTents, neededTents) {
  if (!neededTents || neededTents <= 0) return [];
  const withTents = neighborhoods
    .filter(n => !n.is_vip)
    .map(n => ({ n, tents: allTents.filter(t => t.neighborhood_id === n.id && t.working_status === "WORKING") }))
    .sort((a, b) => b.tents.length - a.tents.length);
  const suggestion = [];
  let remaining = neededTents;
  for (const { n, tents } of withTents) {
    if (remaining <= 0) break;
    const use = Math.min(tents.length, remaining);
    suggestion.push({ neighborhood: n, tents: tents.length, use, spare: tents.length - use });
    remaining -= use;
  }
  return suggestion;
}

// ── VIP square UI ──────────────────────────────────────────────────────────

const GENDER_CFG = {
  WOMEN:  { label: "נשים",  bg: "bg-orange-50",  border: "border-orange-300",  text: "text-orange-700",  dot: "bg-orange-400"  },
  MEN:    { label: "גברים", bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", dot: "bg-emerald-400" },
  GIRLS:  { label: "בנות",  bg: "bg-orange-50",  border: "border-orange-300",  text: "text-orange-700",  dot: "bg-orange-400"  },
  BOYS:   { label: "בנים",  bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", dot: "bg-emerald-400" },
};

const PURPOSE_CFG = {
  STAFF:    { label: "צוות",  Icon: null,   emoji: "👤" },
  SECURITY: { label: "אבטחה", Icon: Shield,  emoji: null },
  DRIVER:   { label: "נהג",   Icon: Car,     emoji: null },
  VIP:      { label: "VIP",   Icon: null,    emoji: "⭐" },
};

function getPurposeCfg(purpose) {
  if (!purpose) return PURPOSE_CFG.STAFF;
  return PURPOSE_CFG[purpose?.toUpperCase()] || { label: purpose, Icon: null, emoji: "👤" };
}

function VipRowSquare({ row, index, allocTent, onClick }) {
  const gc = GENDER_CFG[row.gender_group] || GENDER_CFG.MEN;
  const pc = getPurposeCfg(row.purpose);
  const { Icon } = pc;
  const isAllocated = !!allocTent;
  const isConfirmed = allocTent?.status === "CONFIRMED";

  let borderCls = gc.border;
  let bgCls = gc.bg;
  let ringCls = "";
  if (isConfirmed)  { borderCls = "border-emerald-400"; bgCls = "bg-emerald-50"; ringCls = "ring-1 ring-emerald-300"; }
  else if (isAllocated) { borderCls = "border-amber-400"; bgCls = "bg-amber-50"; ringCls = "ring-1 ring-amber-300"; }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-xl border-2 ${borderCls} ${bgCls} ${ringCls} px-3 py-3 flex flex-col items-center gap-1 min-w-[80px] cursor-pointer hover:brightness-95 transition-all`}
    >
      <span className="absolute top-1.5 right-2 text-[9px] font-bold text-slate-400">#{index + 1}</span>
      {isConfirmed  && <span className="absolute top-1.5 left-2 text-[10px] text-emerald-600">✓</span>}
      {isAllocated && !isConfirmed && <span className="absolute top-1.5 left-2 text-[10px] text-amber-500">~</span>}

      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${gc.bg} border ${gc.border}`}>
        {Icon ? <Icon className={`w-4 h-4 ${gc.text}`} /> : <span>{pc.emoji}</span>}
      </div>

      <div className="flex items-center gap-0.5">
        {Array.from({ length: Math.min(row.people_count || 1, 3) }).map((_, i) => (
          <span key={i} className={`w-2 h-2 rounded-full ${gc.dot}`} />
        ))}
      </div>

      <span className={`text-[10px] font-bold ${gc.text} leading-none`}>{gc.label}</span>
      <span className="text-[9px] text-slate-500 leading-none">{pc.label}</span>
      <span className={`text-[11px] font-semibold ${gc.text}`}>{row.people_count} איש</span>

      {isAllocated && (
        <span className={`text-[9px] font-bold mt-0.5 px-1.5 py-0.5 rounded-full border ${isConfirmed ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-amber-100 text-amber-700 border-amber-300"}`}>
          אוהל {allocTent.tentCode || "?"}
        </span>
      )}
      {!isAllocated && (
        <span className="text-[9px] text-slate-400 mt-0.5">לחץ לשיבוץ</span>
      )}
    </button>
  );
}

function VipTentPickerGrid({ vipRows, tents, neighborhood, conflictMap, myAllocByTent, onPickTent }) {
  if (!vipRows.length) return null;

  // Greedily match allocations to vip rows by gender order
  const allocsByGender = {};
  Object.values(myAllocByTent).forEach(a => {
    const tent = tents.find(t => t.id === a.tent_id);
    if (!allocsByGender[a.gender_group]) allocsByGender[a.gender_group] = [];
    allocsByGender[a.gender_group].push({ ...a, tentCode: tent?.code });
  });
  const usedIdx = {};
  const rowAllocMap = {};
  vipRows.forEach((row, i) => {
    const g = row.gender_group;
    if (!usedIdx[g]) usedIdx[g] = 0;
    const arr = allocsByGender[g] || [];
    if (arr[usedIdx[g]]) { rowAllocMap[i] = arr[usedIdx[g]]; usedIdx[g]++; }
  });

  const womenCount = vipRows.filter(r => r.gender_group === "WOMEN" || r.gender_group === "GIRLS").length;
  const menCount   = vipRows.filter(r => r.gender_group === "MEN"   || r.gender_group === "BOYS").length;

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-sm text-purple-800">{neighborhood.name} — {vipRows.length} אוהלים</p>
        <div className="flex items-center gap-2 text-[10px]">
          {menCount   > 0 && <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 font-medium">{menCount} גברים</span>}
          {womenCount > 0 && <span className="bg-orange-100 text-orange-700 border border-orange-200 rounded-full px-2 py-0.5 font-medium">{womenCount} נשים</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {vipRows.map((row, i) => (
          <VipRowSquare
            key={i}
            row={row}
            index={i}
            allocTent={rowAllocMap[i] || null}
            onClick={() => onPickTent(row, i)}
          />
        ))}
      </div>
      <p className="text-[10px] text-purple-500">לחץ על ריבוע כדי לשבץ אוהל ספציפי</p>
    </div>
  );
}

function VipTentPickModal({ vipRow, hood, hoodTents, conflictMap, myAllocByTent, onSelectTent, onClose }) {
  const gc = GENDER_CFG[vipRow.gender_group] || GENDER_CFG.MEN;
  const pc = getPurposeCfg(vipRow.purpose);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-sm flex items-center gap-2 flex-wrap">
            בחר אוהל לשיבוץ
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${gc.bg} ${gc.border} ${gc.text} font-medium`}>
              {gc.label} · {pc.label} · {vipRow.people_count} איש
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-slate-500">בחר אוהל פנוי מתוך {hood.name}:</p>
          <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto py-1">
            {hoodTents.map(tent => {
              const conflict   = conflictMap[tent.id];
              const myAlloc    = myAllocByTent[tent.id];
              const isOccupied = !!conflict;
              const isAllocatedByMe = !!myAlloc && myAlloc.status !== "CANCELLED";
              const isConfirmed = myAlloc?.status === "CONFIRMED";

              let cls = "rounded-lg border-2 px-2 py-2.5 flex flex-col items-center gap-1 text-center transition-all ";
              if (isConfirmed)        cls += "border-emerald-400 bg-emerald-50 cursor-not-allowed opacity-60";
              else if (isAllocatedByMe) cls += "border-amber-400 bg-amber-50 cursor-pointer hover:brightness-95";
              else if (isOccupied)    cls += "border-red-200 bg-red-50 cursor-not-allowed opacity-50";
              else                    cls += "border-slate-200 bg-white cursor-pointer hover:border-primary hover:bg-primary/5";

              return (
                <button
                  key={tent.id}
                  type="button"
                  disabled={isOccupied || isConfirmed}
                  onClick={() => onSelectTent(tent)}
                  className={cls}
                >
                  <span className="font-bold text-sm text-slate-700">{tent.code}</span>
                  <span className="text-[10px] text-slate-400">{tent.capacity} 🛏️</span>
                  {isAllocatedByMe && !isConfirmed && <span className="text-[9px] text-amber-600 font-medium">בשימוש שלי</span>}
                  {isOccupied && !isAllocatedByMe   && <span className="text-[9px] text-red-500">תפוס</span>}
                  {isConfirmed                       && <span className="text-[9px] text-emerald-600">מאושר</span>}
                  {tent.is_accessible                && <span className="text-[9px]">♿</span>}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end pt-1">
            <Button size="sm" variant="outline" onClick={onClose}>ביטול</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function SleepingAllocationTab({ groupId }) {
  const queryClient = useQueryClient();
  const [allocateTentTarget, setAllocateTentTarget] = useState(null);
  const [pickingVipRow, setPickingVipRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [serverErrors, setServerErrors] = useState([]);
  const [showSuggestion, setShowSuggestion] = useState(false);

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

  const { data: myAllocations = [] } = useQuery({
    queryKey: ["sleepingAllocations", groupId],
    queryFn: () => base44.entities.SleepingAllocation.filter({ group_id: groupId }),
    enabled: !!groupId,
  });

  const { data: allConfirmedAllocations = [] } = useQuery({
    queryKey: ["allConfirmedAllocations"],
    queryFn: () => base44.entities.SleepingAllocation.filter({ status: "CONFIRMED" }),
  });

  const { data: myNhoodReservations = [] } = useQuery({
    queryKey: ["nhoodReservations", groupId],
    queryFn: () => base44.entities.NeighborhoodReservation.filter({ group_id: groupId }),
    enabled: !!groupId,
  });

  const { data: allNhoodReservations = [] } = useQuery({
    queryKey: ["allNhoodReservations"],
    queryFn: () => base44.entities.NeighborhoodReservation.filter({ status: "ACTIVE" }),
  });

  const { data: allGroups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list("-arrival_date", 300),
  });

  const arrivalDate   = profile?.arrival_date   || group?.arrival_date   || "";
  const departureDate = profile?.departure_date || group?.departure_date || "";

  const groupById = useMemo(() => Object.fromEntries(allGroups.map(g => [g.id, g])), [allGroups]);

  const myActiveNhoodRes = useMemo(
    () => myNhoodReservations.filter(r => r.status === "ACTIVE"),
    [myNhoodReservations]
  );
  const myNhoodResById = useMemo(
    () => Object.fromEntries(myActiveNhoodRes.map(r => [r.neighborhood_id, r])),
    [myActiveNhoodRes]
  );

  const otherNhoodResByNeighborhood = useMemo(() => {
    const map = {};
    if (!arrivalDate || !departureDate) return map;
    allNhoodReservations.forEach(r => {
      if (r.group_id === groupId) return;
      if (!datesOverlap(arrivalDate, departureDate, r.arrival_date, r.departure_date)) return;
      map[r.neighborhood_id] = { group_name: groupById[r.group_id]?.group_name || r.group_id, gender_group: r.gender_group };
    });
    return map;
  }, [allNhoodReservations, groupId, arrivalDate, departureDate, groupById]);

  const vipTentConflictMap = useMemo(() => {
    const map = {};
    if (!arrivalDate || !departureDate) return map;
    allConfirmedAllocations.forEach(oa => {
      if (oa.group_id === groupId) return;
      if (!datesOverlap(arrivalDate, departureDate, oa.arrival_date, oa.departure_date)) return;
      map[oa.tent_id] = { gender_group: oa.gender_group, group_id: oa.group_id };
    });
    return map;
  }, [allConfirmedAllocations, groupId, arrivalDate, departureDate]);

  const myVipAllocByTent = useMemo(() => {
    const map = {};
    myAllocations.filter(a => a.status !== "CANCELLED").forEach(a => {
      const tent = allTents.find(t => t.id === a.tent_id);
      const hood = neighborhoods.find(n => n.id === tent?.neighborhood_id);
      if (hood?.is_vip) map[a.tent_id] = a;
    });
    return map;
  }, [myAllocations, allTents, neighborhoods]);

  const myVipDraftConflictTentIds = useMemo(() => {
    const set = new Set();
    myAllocations.filter(a => a.status === "DRAFT").forEach(a => {
      if (vipTentConflictMap[a.tent_id]) set.add(a.tent_id);
    });
    return set;
  }, [myAllocations, vipTentConflictMap]);

  const hasDraftVip = myAllocations.some(a => {
    const tent = allTents.find(t => t.id === a.tent_id);
    const hood = neighborhoods.find(n => n.id === tent?.neighborhood_id);
    return a.status === "DRAFT" && hood?.is_vip;
  });

  const boysDist = parseDist(profile?.boys_tent_distribution_json);
  const girlsDist = parseDist(profile?.girls_tent_distribution_json);
  const totalTentsNeeded =
    boysDist.reduce((s, r) => s + (r.tent_count || 0), 0) +
    girlsDist.reduce((s, r) => s + (r.tent_count || 0), 0);

  const availableStudentNeighborhoods = useMemo(
    () => neighborhoods.filter(n => !n.is_vip && !otherNhoodResByNeighborhood[n.id]),
    [neighborhoods, otherNhoodResByNeighborhood]
  );

  const suggestion = useMemo(
    () => suggestNeighborhoods(availableStudentNeighborhoods, allTents, totalTentsNeeded),
    [availableStudentNeighborhoods, allTents, totalTentsNeeded]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["sleepingAllocations", groupId] });
    queryClient.invalidateQueries({ queryKey: ["allConfirmedAllocations"] });
    queryClient.invalidateQueries({ queryKey: ["nhoodReservations", groupId] });
    queryClient.invalidateQueries({ queryKey: ["allNhoodReservations"] });
  };

  const handleReserveNeighborhood = async (payload) => {
    setSaving(true);
    const existing = myActiveNhoodRes.find(r => r.neighborhood_id === payload.neighborhood_id);
    if (existing) {
      await base44.entities.NeighborhoodReservation.update(existing.id, payload);
      toast.success("שכונה עודכנה");
    } else {
      await base44.entities.NeighborhoodReservation.create(payload);
      toast.success("שכונה הוקצתה לקבוצה ✓");
    }
    setSaving(false);
    invalidate();
  };

  const handleReleaseNeighborhood = async (id) => {
    setSaving(true);
    await base44.entities.NeighborhoodReservation.update(id, { status: "CANCELLED" });
    setSaving(false);
    invalidate();
    toast.success("שכונה שוחררה");
  };

  const handleSaveVipDraft = async (data) => {
    setSaving(true);
    const existing = myAllocations.find(a => a.tent_id === data.tent_id && a.status === "DRAFT");
    if (existing) {
      await base44.entities.SleepingAllocation.update(existing.id, data);
    } else {
      await base44.entities.SleepingAllocation.create(data);
    }
    setSaving(false);
    invalidate();
    toast.success("טיוטת VIP נשמרה");
  };

  const handleConfirmVip = async () => {
    const draftIds = myAllocations
      .filter(a => {
        const tent = allTents.find(t => t.id === a.tent_id);
        const hood = neighborhoods.find(n => n.id === tent?.neighborhood_id);
        return a.status === "DRAFT" && hood?.is_vip;
      })
      .map(a => a.id);

    if (draftIds.length === 0) { toast.error("אין טיוטות VIP לאישור"); return; }
    setConfirming(true);
    setServerErrors([]);
    const res = await base44.functions.invoke("confirmSleepingAllocations", {
      group_id: groupId,
      draft_allocation_ids: draftIds,
    });
    setConfirming(false);
    if (res.data?.success) {
      toast.success(`${res.data.confirmed_count} הקצאות VIP אושרו`);
      invalidate();
    } else {
      setServerErrors(res.data?.errors || ["שגיאה לא ידועה"]);
    }
  };

  const handleCancelAllVip = async () => {
    if (!window.confirm("ביטול כל הקצאות ה-VIP?")) return;
    const active = myAllocations.filter(a => {
      const tent = allTents.find(t => t.id === a.tent_id);
      const hood = neighborhoods.find(n => n.id === tent?.neighborhood_id);
      return a.status !== "CANCELLED" && hood?.is_vip;
    });
    await Promise.all(
      active.map(a =>
        a.status === "DRAFT"
          ? base44.entities.SleepingAllocation.delete(a.id)
          : base44.entities.SleepingAllocation.update(a.id, { status: "CANCELLED" })
      )
    );
    invalidate();
    toast.success("הקצאות VIP בוטלו");
  };

  if (!profile) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        <p>אין פרופיל תפעולי מאושר לקבוצה זו.</p>
        <p className="text-xs mt-1">יש לאשר טופס קבלה כפרופיל תפעולי תחילה.</p>
      </div>
    );
  }

  const studentNeighborhoods = neighborhoods.filter(n => !n.is_vip);
  const vipNeighborhoods     = neighborhoods.filter(n => n.is_vip);

  return (
    <div className="space-y-6" dir="rtl">

      <SleepingRequirementsSummary
        profile={{ ...profile, arrival_date: arrivalDate, departure_date: departureDate }}
        allocations={myAllocations}
        nhoodReservations={myActiveNhoodRes}
        allTents={allTents}
        neighborhoods={neighborhoods}
      />

      {arrivalDate && (
        <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          📅 תאריכי לינה: <strong>{arrivalDate}</strong> — <strong>{departureDate}</strong>
          <span className="text-slate-400 mr-2">(departure_date בלעדי)</span>
        </div>
      )}

      {/* ── חניכים ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">שיבוץ לפי שכונות — חניכים</h3>
          {totalTentsNeeded > 0 && suggestion.length > 0 && (
            <Button
              size="sm" variant="outline"
              className="h-7 text-xs gap-1 border-amber-200 text-amber-700 hover:bg-amber-50"
              onClick={() => setShowSuggestion(s => !s)}
            >
              <Lightbulb className="w-3.5 h-3.5" /> הצעת שיבוץ
            </Button>
          )}
        </div>

        <p className="text-[11px] text-slate-500">
          שכונה שנבחרת נחסמת כולה לקבוצה — קבוצת חניכים אחרת לא תוכל להשתמש בה בתאריכים החופפים.
        </p>

        {showSuggestion && suggestion.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1.5">
            <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" />
              הצעת שיבוץ אוטומטית — {totalTentsNeeded} אוהלים נדרשים
            </p>
            {suggestion.map(({ neighborhood, tents, use, spare }) => (
              <div key={neighborhood.id} className="text-xs text-amber-700 flex items-center gap-2">
                <span className="font-medium">{neighborhood.name}:</span>
                <span>השתמש ב-{use} מתוך {tents} אוהלים</span>
                {spare > 0 && <span className="text-amber-500 text-[10px]">({spare} פנויים חסומים מבלעדיות)</span>}
              </div>
            ))}
            <p className="text-[10px] text-amber-500">הצעה בלבד — ניתן לבחור שכונות אחרות</p>
          </div>
        )}

        {studentNeighborhoods.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">לא נמצאו שכונות חניכים במלאי.</p>
        )}

        {studentNeighborhoods.map(hood => {
          const hoodTents = allTents.filter(t => t.neighborhood_id === hood.id && t.working_status === "WORKING");
          return (
            <StudentNeighborhoodPanel
              key={hood.id}
              neighborhood={hood}
              tents={hoodTents}
              lockByThisGroup={myNhoodResById[hood.id] || null}
              lockByOtherGroup={otherNhoodResByNeighborhood[hood.id] || null}
              arrivalDate={arrivalDate}
              departureDate={departureDate}
              groupId={groupId}
              profileId={profile.id}
              onReserve={handleReserveNeighborhood}
              onRelease={handleReleaseNeighborhood}
              saving={saving}
            />
          );
        })}
      </section>

      {/* ── VIP ── */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">שיבוץ VIP לפי אוהלים בודדים</h3>
        <p className="text-[11px] text-slate-500">
          אוהלי VIP (80–89) — לחץ על כל ריבוע כדי לשבץ אוהל ספציפי. קבוצות שונות יכולות להשתמש באוהלי VIP שונים בתאריכים חופפים.
        </p>

        {serverErrors.length > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-3 space-y-1">
            <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> שגיאות אישור:
            </p>
            {serverErrors.map((e, i) => <p key={i} className="text-xs text-red-600">• {e}</p>)}
          </div>
        )}

        {vipNeighborhoods.map(hood => {
          const hoodTents = allTents.filter(t => t.neighborhood_id === hood.id && t.working_status === "WORKING");
          return (
            <VipTentPickerGrid
              key={hood.id}
              tents={hoodTents}
              neighborhood={hood}
              vipRows={parseDist(profile.vip_tent_requirements_json)}
              conflictMap={vipTentConflictMap}
              myAllocByTent={myVipAllocByTent}
              onPickTent={(vipRow, rowIndex) => setPickingVipRow({ vipRow, rowIndex, hood, hoodTents })}
            />
          );
        })}

        {vipNeighborhoods.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {hasDraftVip && (
              <Button
                size="sm"
                onClick={handleConfirmVip}
                disabled={confirming || myVipDraftConflictTentIds.size > 0}
                className="gap-1.5 bg-emerald-700 hover:bg-emerald-800"
              >
                <ShieldCheck className="w-4 h-4" />
                {confirming ? "מאשר..." : "אשר הקצאות VIP"}
              </Button>
            )}
            {myVipDraftConflictTentIds.size > 0 && (
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> יש קונפליקטים — לא ניתן לאשר
              </p>
            )}
            {myAllocations.some(a => {
              const tent = allTents.find(t => t.id === a.tent_id);
              const hood = neighborhoods.find(n => n.id === tent?.neighborhood_id);
              return a.status !== "CANCELLED" && hood?.is_vip;
            }) && (
              <Button size="sm" variant="outline" onClick={handleCancelAllVip} className="text-red-600 border-red-200 hover:bg-red-50">
                בטל הכל
              </Button>
            )}
          </div>
        )}
      </section>

      {/* VIP: בחר אוהל */}
      {pickingVipRow && (
        <VipTentPickModal
          vipRow={pickingVipRow.vipRow}
          hood={pickingVipRow.hood}
          hoodTents={pickingVipRow.hoodTents}
          conflictMap={vipTentConflictMap}
          myAllocByTent={myVipAllocByTent}
          onSelectTent={(tent) => {
            setPickingVipRow(null);
            setAllocateTentTarget({ tent, neighborhood: pickingVipRow.hood });
          }}
          onClose={() => setPickingVipRow(null)}
        />
      )}

      {/* הקצאת אוהל VIP */}
      {allocateTentTarget && (
        <TentAllocationModal
          tent={allocateTentTarget.tent}
          neighborhood={allocateTentTarget.neighborhood}
          groupId={groupId}
          profile={{ ...profile, arrival_date: arrivalDate, departure_date: departureDate }}
          onSave={handleSaveVipDraft}
          onClose={() => setAllocateTentTarget(null)}
        />
      )}
    </div>
  );
}