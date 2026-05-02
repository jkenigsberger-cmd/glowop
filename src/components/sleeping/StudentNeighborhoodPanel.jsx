import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, CheckCircle2, ChevronDown, ChevronUp, Plus, X } from "lucide-react";

const GENDER_OPTIONS = [
  { value: "BOYS",  label: "👦 בנים"  },
  { value: "GIRLS", label: "👧 בנות"  },
  { value: "MIXED", label: "👥 מעורב" },
];

const GENDER_COLORS = {
  BOYS:  { bg: "bg-blue-50",  border: "border-blue-300",  text: "text-blue-800",  badge: "bg-blue-100 text-blue-800 border-blue-300",  pill: "bg-blue-600" },
  GIRLS: { bg: "bg-pink-50",  border: "border-pink-300",  text: "text-pink-800",  badge: "bg-pink-100 text-pink-800 border-pink-300",  pill: "bg-pink-600" },
  MIXED: { bg: "bg-slate-50", border: "border-slate-300", text: "text-slate-800", badge: "bg-slate-100 text-slate-700 border-slate-300", pill: "bg-slate-500" },
};

/**
 * One student neighborhood row with inline remaining counters.
 *
 * Props:
 *  neighborhood        - Neighborhood record
 *  tents               - Tent[] inside this neighborhood (working only)
 *  lockByThisGroup     - NeighborhoodReservation | null
 *  lockByOtherGroup    - { group_name } | null
 *  arrivalDate / departureDate / groupId / profileId
 *  boysNeeded / boysAllocated / girlsNeeded / girlsAllocated  ← live counters
 *  onReserve / onRelease / saving
 */
export default function StudentNeighborhoodPanel({
  neighborhood,
  tents,
  lockByThisGroup,
  lockByOtherGroup,
  arrivalDate,
  departureDate,
  groupId,
  profileId,
  boysNeeded    = 0,
  boysAllocated = 0,
  girlsNeeded   = 0,
  girlsAllocated = 0,
  onReserve,
  onRelease,
  saving,
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    gender_group: "BOYS",
    planned_tents: tents.length,
    notes: "",
  });

  const totalBeds  = tents.reduce((s, t) => s + (t.capacity || 0), 0);
  const isLockedByMe    = !!lockByThisGroup;
  const isLockedByOther = !!lockByOtherGroup && !isLockedByMe;

  const activeGender = isLockedByMe ? lockByThisGroup.gender_group : form.gender_group;
  const gc = GENDER_COLORS[activeGender] || GENDER_COLORS.MIXED;

  const remBoys  = boysNeeded  - boysAllocated;
  const remGirls = girlsNeeded - girlsAllocated;

  const handleReserve = () => {
    onReserve({
      group_id: groupId,
      operational_group_profile_id: profileId,
      neighborhood_id: neighborhood.id,
      arrival_date: arrivalDate,
      departure_date: departureDate,
      gender_group: form.gender_group,
      planned_tents: Number(form.planned_tents) || tents.length,
      notes: form.notes,
      status: "ACTIVE",
      source: "allocation",
    });
    setOpen(false);
  };

  const handleRelease = () => {
    if (!window.confirm("לשחרר שכונה זו מהקצאת הקבוצה?")) return;
    onRelease(lockByThisGroup.id);
  };

  // ── card style ──────────────────────────────────────────────────────────────
  let cardBorder = "border-slate-200 bg-white";
  if (isLockedByMe)    cardBorder = `${gc.border} ${gc.bg}`;
  if (isLockedByOther) cardBorder = "border-red-200 bg-red-50 opacity-75";

  return (
    <div className={`border-2 rounded-2xl overflow-hidden transition-all ${cardBorder}`}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3">

        {/* Left: name + capacity */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-bold text-sm ${isLockedByMe ? gc.text : "text-slate-800"}`}>
              {neighborhood.name}
            </span>
            <span className="text-xs text-slate-400">{tents.length} אוהלים · {totalBeds} מיטות</span>

            {isLockedByMe && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold border rounded-full px-2 py-0.5 ${gc.badge}`}>
                <CheckCircle2 className="w-3 h-3" />
                {GENDER_OPTIONS.find(g => g.value === lockByThisGroup.gender_group)?.label}
                {" · "}{lockByThisGroup.planned_tents} אוהלים
              </span>
            )}

            {isLockedByOther && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-red-100 text-red-700 border border-red-300 rounded-full px-2 py-0.5">
                <Lock className="w-3 h-3" /> חסומה — {lockByOtherGroup.group_name}
              </span>
            )}
          </div>

          {/* Spare tent note */}
          {isLockedByMe && (() => {
            const spare = tents.length - (lockByThisGroup.planned_tents || tents.length);
            if (spare <= 0) return null;
            return (
              <p className="text-[10px] text-amber-700">
                ⚠️ נותרו {spare} אוהלים פנויים בשכונה — חסומים לקבוצות אחרות בגלל בלעדיות שכונה
              </p>
            );
          })()}
        </div>

        {/* Right: inline remaining counters */}
        {!isLockedByOther && (boysNeeded > 0 || girlsNeeded > 0) && (
          <div className="flex items-center gap-2 shrink-0">
            {boysNeeded > 0 && (
              <div className={`flex flex-col items-center rounded-lg px-2 py-1 border text-center min-w-[48px] ${
                remBoys === 0 ? "bg-emerald-50 border-emerald-300" :
                remBoys < 0  ? "bg-red-50 border-red-300" :
                               "bg-blue-50 border-blue-200"
              }`}>
                <span className="text-[9px] font-medium text-slate-500">👦 נותרו</span>
                <span className={`text-base font-black leading-none ${
                  remBoys === 0 ? "text-emerald-700" : remBoys < 0 ? "text-red-700" : "text-blue-700"
                }`}>{remBoys < 0 ? `+${Math.abs(remBoys)}` : remBoys}</span>
                <span className="text-[9px] text-slate-400">{boysAllocated}/{boysNeeded}</span>
              </div>
            )}
            {girlsNeeded > 0 && (
              <div className={`flex flex-col items-center rounded-lg px-2 py-1 border text-center min-w-[48px] ${
                remGirls === 0 ? "bg-emerald-50 border-emerald-300" :
                remGirls < 0  ? "bg-red-50 border-red-300" :
                                "bg-pink-50 border-pink-200"
              }`}>
                <span className="text-[9px] font-medium text-slate-500">👧 נותרו</span>
                <span className={`text-base font-black leading-none ${
                  remGirls === 0 ? "text-emerald-700" : remGirls < 0 ? "text-red-700" : "text-pink-700"
                }`}>{remGirls < 0 ? `+${Math.abs(remGirls)}` : remGirls}</span>
                <span className="text-[9px] text-slate-400">{girlsAllocated}/{girlsNeeded}</span>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        {!isLockedByOther && (
          <div className="flex items-center gap-1.5 shrink-0">
            {isLockedByMe ? (
              <>
                <Button size="sm" variant="outline"
                  className={`h-7 text-xs gap-1 ${gc.border} ${gc.text} hover:opacity-80`}
                  onClick={() => setOpen(o => !o)}
                >
                  {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  ערוך
                </Button>
                <Button size="sm" variant="outline"
                  className="h-7 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50"
                  onClick={handleRelease} disabled={saving}
                >
                  <X className="w-3 h-3" /> שחרר
                </Button>
              </>
            ) : (
              <Button size="sm" className="h-7 text-xs gap-1"
                onClick={() => setOpen(o => !o)}
              >
                <Plus className="w-3 h-3" /> בחר שכונה
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Expand form ─────────────────────────────────────────────────── */}
      {open && !isLockedByOther && (
        <div className="border-t border-slate-200 px-4 py-3 bg-white space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600">מגדר</label>
              <Select
                value={isLockedByMe ? lockByThisGroup.gender_group : form.gender_group}
                onValueChange={v => setForm(f => ({ ...f, gender_group: v }))}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600">
                אוהלים מתוכננים (מתוך {tents.length})
              </label>
              <Input
                type="number" min="1" max={tents.length}
                value={isLockedByMe ? (lockByThisGroup.planned_tents ?? tents.length) : form.planned_tents}
                onChange={e => setForm(f => ({ ...f, planned_tents: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-600">הערות (אופציונלי)</label>
            <Input
              value={isLockedByMe ? (lockByThisGroup.notes || "") : form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="h-8 text-xs" placeholder="הערות..."
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(false)}>ביטול</Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleReserve} disabled={saving}>
              {isLockedByMe ? "עדכן" : "שמור שכונה"}
            </Button>
          </div>
          <p className="text-[10px] text-slate-400 text-center">
            שיבוץ לפי שכונות — שכונה שנבחרת נחסמת כולה לקבוצה
          </p>
        </div>
      )}
    </div>
  );
}