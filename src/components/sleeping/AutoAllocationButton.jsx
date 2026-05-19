/**
 * AutoAllocationButton
 *
 * Reads the distribution from OperationalGroupProfile, subtracts already-allocated
 * tents/pax for this group, then assigns remaining to the first available tents
 * in the given neighborhood (sorted naturally), creating DRAFT SleepingAllocation rows.
 *
 * Props:
 *   neighborhood         - Neighborhood record
 *   tents                - Tent[] (working tents in this neighborhood)
 *   reservation          - NeighborhoodReservation (must already exist)
 *   profile              - OperationalGroupProfile
 *   groupId              - string
 *   profileId            - string
 *   arrivalDate          - string
 *   departureDate        - string
 *   allConfirmedAllocs   - SleepingAllocation[] from ALL groups (overbooking check)
 *   existingGroupAllocs  - SleepingAllocation[] for THIS group (remaining pax calc)
 *   onSaved              - () => void
 */

import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Wand2, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseDist(json) {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

/** Expand [{tent_count, people_per_tent}] → flat list of pax per tent e.g. [8,8,4] */
function expandDist(rows) {
  const flat = [];
  rows.forEach(r => {
    for (let i = 0; i < (r.tent_count || 0); i++) flat.push(r.people_per_tent || 0);
  });
  return flat;
}

/** Natural numeric sort on tent code */
function tentSortKey(tent) {
  const match = String(tent.code || "").match(/(\d+)/);
  return match ? Number(match[1]) : 9999;
}

function datesOverlap(a1, a2, b1, b2) {
  if (!a1 || !a2 || !b1 || !b2) return false;
  return a1 < b2 && b1 < a2;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AutoAllocationButton({
  neighborhood,
  tents = [],
  reservation,
  profile,
  groupId,
  profileId,
  arrivalDate,
  departureDate,
  allConfirmedAllocs = [],
  existingGroupAllocs = [],
  onSaved,
}) {
  const [preview, setPreview]   = useState(null); // null | { rows: [{tent, pax}], error: string|null }
  const [saving, setSaving]     = useState(false);
  const [done, setDone]         = useState(false);

  const genderGroup = reservation?.gender_group || "MIXED";

  // ── Derive required flat pax list from profile ─────────────────────────────
  const requiredPaxList = useMemo(() => {
    if (!profile) return [];
    let rows = [];
    if (genderGroup === "BOYS")  rows = parseDist(profile.boys_tent_distribution_json);
    else if (genderGroup === "GIRLS") rows = parseDist(profile.girls_tent_distribution_json);
    else {
      // MIXED: prefer boys dist (general group), else derive from total_pax
      rows = parseDist(profile.boys_tent_distribution_json);
    }
    return expandDist(rows);
  }, [profile, genderGroup]);

  // ── Already-allocated pax for this gender across ALL neighborhoods ──────────
  const alreadyAllocatedPax = useMemo(() => {
    return existingGroupAllocs
      .filter(a =>
        a.status !== "CANCELLED" &&
        a.allocation_type === "STUDENT" &&
        (a.gender_group === genderGroup || (genderGroup === "MIXED" && (a.gender_group === "MIXED" || a.gender_group === "BOYS" || a.gender_group === "GIRLS")))
      )
      .reduce((s, a) => s + (a.allocated_pax || 0), 0);
  }, [existingGroupAllocs, genderGroup]);

  // How many pax are already in THIS neighborhood for this group
  const alreadyInThisNeighborhood = useMemo(() => {
    return existingGroupAllocs
      .filter(a =>
        a.status !== "CANCELLED" &&
        a.allocation_type === "STUDENT" &&
        a.neighborhood_id === neighborhood?.id
      )
      .reduce((s, a) => s + (a.allocated_pax || 0), 0);
  }, [existingGroupAllocs, neighborhood]);

  // Remaining flat pax list after subtracting already allocated
  const remainingPaxList = useMemo(() => {
    let remaining = alreadyAllocatedPax;
    const list = [...requiredPaxList];
    // Remove items from the front that are already covered
    const result = [];
    for (const pax of list) {
      if (remaining >= pax) { remaining -= pax; continue; }
      if (remaining > 0) {
        result.push(pax - remaining);
        remaining = 0;
      } else {
        result.push(pax);
      }
    }
    return result;
  }, [requiredPaxList, alreadyAllocatedPax]);

  // Tents blocked by OTHER groups for overlapping dates
  const blockedTentIds = useMemo(() => {
    const set = new Set();
    if (!arrivalDate || !departureDate) return set;
    allConfirmedAllocs.forEach(a => {
      if (a.group_id === groupId) return;
      if (a.status === "CANCELLED") return;
      if (!datesOverlap(arrivalDate, departureDate, a.arrival_date, a.departure_date)) return;
      set.add(a.tent_id);
    });
    return set;
  }, [allConfirmedAllocs, groupId, arrivalDate, departureDate]);

  // Tents already used by THIS group in this neighborhood
  const usedByMeTentIds = useMemo(() => {
    return new Set(
      existingGroupAllocs
        .filter(a => a.status !== "CANCELLED" && a.neighborhood_id === neighborhood?.id)
        .map(a => a.tent_id)
    );
  }, [existingGroupAllocs, neighborhood]);

  // ── Run auto allocation ────────────────────────────────────────────────────
  const runAutoAllocation = () => {
    setDone(false);

    if (!requiredPaxList.length) {
      setPreview({ rows: [], error: "לא נמצאה חלוקת אוהלים בדרישות הלינה. נא להשלים דרישות לינה תחילה." });
      return;
    }

    if (remainingPaxList.length === 0) {
      setPreview({ rows: [], error: "כל המשתתפים כבר שובצו — אין משתתפים שנותרו לשיבוץ." });
      return;
    }

    // Available tents: working, in this neighborhood, not blocked by others, not already used by me
    const available = tents
      .filter(t =>
        t.working_status === "WORKING" &&
        !blockedTentIds.has(t.id) &&
        !usedByMeTentIds.has(t.id)
      )
      .sort((a, b) => tentSortKey(a) - tentSortKey(b));

    if (available.length < remainingPaxList.length) {
      setPreview({
        rows: [],
        error: `אין מספיק אוהלים זמינים בשכונה זו. נדרשים ${remainingPaxList.length} אוהלים, נמצאו ${available.length} פנויים.`,
      });
      return;
    }

    // Check capacity for each assignment
    const rows = [];
    for (let i = 0; i < remainingPaxList.length; i++) {
      const tent = available[i];
      const pax  = remainingPaxList[i];
      if (pax > (tent.capacity || 0)) {
        setPreview({
          rows: [],
          error: `אוהל ${tent.code} — קיבולת ${tent.capacity} אך נדרשים ${pax} אנשים. יש לעדכן את חלוקת האוהלים בדרישות לינה.`,
        });
        return;
      }
      rows.push({ tent, pax });
    }

    setPreview({ rows, error: null });
  };

  // ── Save DRAFT rows ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!preview?.rows?.length) return;
    setSaving(true);
    try {
      const ops = preview.rows.map(({ tent, pax }) =>
        base44.entities.SleepingAllocation.create({
          group_id:                     groupId,
          operational_group_profile_id: profileId,
          tent_id:                      tent.id,
          neighborhood_id:              neighborhood.id,
          arrival_date:                 arrivalDate,
          departure_date:               departureDate,
          allocated_pax:                pax,
          allocation_type:              "STUDENT",
          gender_group:                 genderGroup,
          status:                       "DRAFT",
          notes:                        "שיבוץ אוטומטי",
        })
      );
      await Promise.all(ops);
      toast.success("שיבוץ אוטומטי נוצר — נא לאשר שיבוץ לינה ✓");
      setDone(true);
      setPreview(null);
      onSaved?.();
    } catch (err) {
      toast.error(err?.message || "שגיאה בשמירת השיבוץ — נסה שוב");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setDone(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // Summary line for the trigger button
  const totalRequired = requiredPaxList.reduce((s, p) => s + p, 0);
  const totalRemaining = remainingPaxList.reduce((s, p) => s + p, 0);
  const hasRemaining = totalRemaining > 0;

  return (
    <div className="space-y-2">
      {/* Trigger button */}
      {!preview && !done && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 border-violet-200 text-violet-700 hover:bg-violet-50"
          onClick={runAutoAllocation}
          title={`שיבוץ אוטומטי — ${hasRemaining ? totalRemaining + " אנשים נותרו" : "הכל שובץ"}`}
        >
          <Wand2 className="w-3 h-3" />
          שיבוץ אוטומטי
        </Button>
      )}

      {/* Done badge */}
      {done && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-violet-100 text-violet-700 border border-violet-200 rounded-full px-2 py-0.5">
          <CheckCircle2 className="w-3 h-3" /> שיבוץ אוטומטי נוצר
        </span>
      )}

      {/* Preview / error panel */}
      {preview && (
        <div className="border rounded-xl overflow-hidden bg-white">
          {preview.error ? (
            <div className="flex items-start gap-2 p-3 bg-red-50 border-red-200 text-xs text-red-700">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">לא ניתן לבצע שיבוץ אוטומטי</p>
                <p className="mt-0.5">{preview.error}</p>
                <Button
                  size="sm" variant="ghost"
                  className="h-6 text-xs text-red-600 mt-1 px-1"
                  onClick={handleCancel}
                >סגור</Button>
              </div>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              <p className="text-xs font-semibold text-violet-800 flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5" />
                שיבוץ אוטומטי — {preview.rows.length} אוהלים · {preview.rows.reduce((s, r) => s + r.pax, 0)} אנשים
              </p>
              <div className="space-y-1">
                {preview.rows.map(({ tent, pax }) => (
                  <div key={tent.id} className="flex items-center justify-between text-xs px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-lg">
                    <span className="font-semibold text-slate-800">אוהל {tent.code}</span>
                    <span className="text-violet-700 font-medium">{pax} מיטות</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-xs"
                  onClick={handleCancel}
                  disabled={saving}
                >ביטול</Button>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1 bg-violet-700 hover:bg-violet-800 text-white flex-1"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> שומר...</>
                    : <><CheckCircle2 className="w-3 h-3" /> צור שיבוץ טיוטה</>
                  }
                </Button>
              </div>
              <p className="text-[10px] text-slate-400 text-center">
                השיבוץ יישמר כטיוטה — לאחר מכן לחץ "אשר שיבוץ לינה" לאישור סופי
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}