import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, CheckCircle2, ChevronDown, ChevronUp, Plus, X, LayoutGrid } from "lucide-react";
import TentDistributionEditor from "./TentDistributionEditor";
import AutoAllocationButton from "./AutoAllocationButton";

const GENDER_OPTIONS = [
  { value: "BOYS",  label: "בנים 👦" },
  { value: "GIRLS", label: "בנות 👧" },
  { value: "MIXED", label: "מעורב / כללי 👥" },
];

/**
 * One student neighborhood row.
 *
 * Props:
 *  neighborhood        - Neighborhood record
 *  tents               - Tent[] inside this neighborhood (working only)
 *  lockByThisGroup     - NeighborhoodReservation | null  (ACTIVE lock owned by current group)
 *  lockByOtherGroup    - { group_name, gender_group } | null
 *  arrivalDate         - string
 *  departureDate       - string
 *  groupId             - string
 *  profileId           - string
 *  onReserve(payload)  - create/update reservation
 *  onRelease(reservationId) - cancel reservation
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
  onReserve,
  onRelease,
  saving,
  allConfirmedAllocs = [],
  onSaved,
  defaultGenderGroup = "BOYS",
  profile = null,
  existingGroupAllocs = [],
}) {
  const [open, setOpen] = useState(false);
  const [showDistribution, setShowDistribution] = useState(false);
  const [form, setForm] = useState({
    gender_group: defaultGenderGroup,
    planned_tents: tents.length,
    notes: "",
  });

  const totalBeds = tents.reduce((s, t) => s + (t.capacity || 0), 0);
  const isLockedByMe = !!lockByThisGroup;
  const isLockedByOther = !!lockByOtherGroup && !isLockedByMe;

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

  // ── card color ─────────────────────────────────────────────────────────────
  let borderClass = "border-slate-200";
  let bgClass = "bg-white";
  if (isLockedByMe) { borderClass = "border-emerald-300"; bgClass = "bg-emerald-50"; }
  else if (isLockedByOther) { borderClass = "border-red-200"; bgClass = "bg-red-50 opacity-75"; }

  return (
    <div className={`border rounded-xl overflow-hidden ${borderClass} ${bgClass}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-800">{neighborhood.name}</span>
            <span className="text-xs text-slate-400">{tents.length} אוהלים · {totalBeds} מיטות</span>

            {isLockedByMe && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-full px-2 py-0.5">
                <CheckCircle2 className="w-3 h-3" />
                שמורה לקבוצה ({GENDER_OPTIONS.find(g => g.value === lockByThisGroup.gender_group)?.label ?? lockByThisGroup.gender_group})
                · {lockByThisGroup.planned_tents} אוהלים מתוכננים
              </span>
            )}

            {isLockedByOther && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-red-100 text-red-700 border border-red-200 rounded-full px-2 py-0.5">
                <Lock className="w-3 h-3" /> חסומה — {lockByOtherGroup.group_name}
              </span>
            )}
          </div>

          {/* Spare tent note when reserved by me */}
          {isLockedByMe && (() => {
            const spare = tents.length - (lockByThisGroup.planned_tents || tents.length);
            if (spare <= 0) return null;
            return (
              <p className="text-[10px] text-amber-700 mt-0.5">
                נותרו {spare} אוהלים פנויים בתוך השכונה, אך הם חסומים לקבוצות אחרות בגלל בלעדיות שכונה
              </p>
            );
          })()}
        </div>

        {/* Actions */}
        {!isLockedByOther && (
          <div className="flex items-center gap-1.5 shrink-0">
            {isLockedByMe ? (
              <>
                <AutoAllocationButton
                  neighborhood={neighborhood}
                  tents={tents}
                  profile={profile}
                  groupId={groupId}
                  profileId={profileId}
                  arrivalDate={arrivalDate}
                  departureDate={departureDate}
                  allConfirmedAllocs={allConfirmedAllocs}
                  existingGroupAllocs={existingGroupAllocs}
                  onSaved={onSaved}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                  onClick={() => setShowDistribution(true)}
                >
                  <LayoutGrid className="w-3 h-3" /> פירוט לפי אוהלים
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                  onClick={() => setOpen(o => !o)}
                >
                  {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  ערוך
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50"
                  onClick={handleRelease}
                  disabled={saving}
                >
                  <X className="w-3 h-3" /> שחרר
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setOpen(o => !o)}
              >
                <Plus className="w-3 h-3" /> הוסף שכונה
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tent distribution editor */}
      <TentDistributionEditor
        open={showDistribution}
        onClose={() => setShowDistribution(false)}
        neighborhood={neighborhood}
        tents={tents}
        reservation={lockByThisGroup}
        groupId={groupId}
        profileId={profileId}
        arrivalDate={arrivalDate}
        departureDate={departureDate}
        allConfirmedAllocs={allConfirmedAllocs}
        onSaved={onSaved}
      />

      {/* Expand form */}
      {open && !isLockedByOther && (
        <div className="border-t border-slate-200 px-4 py-3 bg-white space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600">מגדר</label>
              <Select
                value={isLockedByMe ? lockByThisGroup.gender_group : form.gender_group}
                onValueChange={v => setForm(f => ({ ...f, gender_group: v }))}
              >
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
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
                type="number"
                min="1"
                max={tents.length}
                value={isLockedByMe ? (lockByThisGroup.planned_tents ?? tents.length) : form.planned_tents}
                onChange={e => setForm(f => ({ ...f, planned_tents: e.target.value }))}
                className="h-7 text-xs"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-600">הערות (אופציונלי)</label>
            <Input
              value={isLockedByMe ? (lockByThisGroup.notes || "") : form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="h-7 text-xs"
              placeholder="הערות..."
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