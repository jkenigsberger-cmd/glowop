/**
 * AutoAllocationButton
 *
 * Handles both single-gender (MIXED) and dual-gender (BOYS + GIRLS) automatic allocation.
 *
 * When a gender split exists (boys_count + girls_count > 0):
 *   - Reads boys_tent_distribution_json and girls_tent_distribution_json separately
 *   - Subtracts already-allocated BOYS pax and GIRLS pax independently
 *   - Assigns BOYS first then GIRLS from the same pool of available tents (sequential, no mixing)
 *
 * When no gender split:
 *   - Uses boys_tent_distribution_json as the general/MIXED distribution
 *   - Creates MIXED allocations
 */

import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Wand2, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

// ── Pure helpers ───────────────────────────────────────────────────────────────

function parseDist(json) {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

/** [{tent_count, people_per_tent}] → flat list e.g. [8, 8, 4] */
function expandDist(rows) {
  const flat = [];
  rows.forEach(r => {
    for (let i = 0; i < (r.tent_count || 0); i++) flat.push(r.people_per_tent || 0);
  });
  return flat;
}

/** Auto-generate a flat distribution from totalPax and actual tent capacities */
function autoExpandFromPax(totalPax, defaultCap = 8) {
  if (!totalPax || totalPax <= 0) return [];
  const flat = [];
  let remaining = totalPax;
  while (remaining > 0) {
    flat.push(Math.min(remaining, defaultCap));
    remaining -= defaultCap;
  }
  return flat;
}

/**
 * Auto-generate distribution using actual available tent capacities
 * instead of a hardcoded default capacity.
 */
function autoExpandFromPaxWithTents(totalPax, sortedAvailableTents) {
  if (!totalPax || totalPax <= 0 || !sortedAvailableTents.length) return [];
  const flat = [];
  let remaining = totalPax;
  for (const tent of sortedAvailableTents) {
    if (remaining <= 0) break;
    flat.push(Math.min(remaining, tent.capacity || 8));
    remaining -= (tent.capacity || 8);
  }
  return flat;
}

/** Subtract already-allocated pax from a flat list (from the front) */
function subtractAllocated(flatList, alreadyPax) {
  let rem = alreadyPax;
  const result = [];
  for (const pax of flatList) {
    if (rem >= pax) { rem -= pax; continue; }
    result.push(rem > 0 ? pax - rem : pax);
    rem = 0;
  }
  return result;
}

function tentSortKey(tent) {
  const m = String(tent.code || "").match(/(\d+)/);
  return m ? Number(m[1]) : 9999;
}

function datesOverlap(a1, a2, b1, b2) {
  if (!a1 || !a2 || !b1 || !b2) return false;
  return a1 < b2 && b1 < a2;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AutoAllocationButton({
  neighborhood,
  tents = [],
  profile,
  groupId,
  profileId,
  arrivalDate,
  departureDate,
  allConfirmedAllocs = [],
  existingGroupAllocs = [],
  onSaved,
}) {
  const [preview, setPreview] = useState(null); // null | { segments: [{gender, rows}], error }
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);

  // Does the group have a gender split?
  const hasGenderSplit = useMemo(() =>
    ((profile?.boys_count || 0) + (profile?.girls_count || 0)) > 0,
    [profile]
  );

  // Tents blocked by OTHER groups (overbooking check)
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

  // Tents already allocated by THIS group in this neighborhood (any status except cancelled)
  const usedByMeTentIds = useMemo(() => new Set(
    existingGroupAllocs
      .filter(a => a.status !== "CANCELLED" && a.neighborhood_id === neighborhood?.id)
      .map(a => a.tent_id)
  ), [existingGroupAllocs, neighborhood]);

  // Already-allocated pax per gender for this group across ALL neighborhoods
  const allocatedPaxByGender = useMemo(() => {
    const map = { BOYS: 0, GIRLS: 0, MIXED: 0 };
    existingGroupAllocs
      .filter(a => a.status !== "CANCELLED" && a.allocation_type === "STUDENT")
      .forEach(a => {
        const g = a.gender_group;
        if (map[g] !== undefined) map[g] += (a.allocated_pax || 0);
      });
    return map;
  }, [existingGroupAllocs]);

  // ── Core: compute what still needs to be allocated ──────────────────────────
  // Available tents sorted (needed for capacity-aware auto-expand)
  const sortedAvailableTents = useMemo(() =>
    tents
      .filter(t => t.working_status === "WORKING" && !blockedTentIds.has(t.id) && !usedByMeTentIds.has(t.id))
      .sort((a, b) => tentSortKey(a) - tentSortKey(b)),
    [tents, blockedTentIds, usedByMeTentIds]
  );

  const segments = useMemo(() => {
    if (!profile) return [];

    if (hasGenderSplit) {
      // Boys
      let boysFlat = expandDist(parseDist(profile.boys_tent_distribution_json));
      if (!boysFlat.length && profile.boys_beds_needed > 0) {
        boysFlat = autoExpandFromPaxWithTents(profile.boys_beds_needed, sortedAvailableTents)
          || autoExpandFromPax(profile.boys_beds_needed);
      }
      const boysRemaining = subtractAllocated(boysFlat, allocatedPaxByGender.BOYS);

      // Girls
      let girlsFlat = expandDist(parseDist(profile.girls_tent_distribution_json));
      if (!girlsFlat.length && profile.girls_beds_needed > 0) {
        girlsFlat = autoExpandFromPaxWithTents(profile.girls_beds_needed, sortedAvailableTents)
          || autoExpandFromPax(profile.girls_beds_needed);
      }
      const girlsRemaining = subtractAllocated(girlsFlat, allocatedPaxByGender.GIRLS);

      return [
        { gender: "BOYS",  label: "בנים",  remaining: boysRemaining  },
        { gender: "GIRLS", label: "בנות",  remaining: girlsRemaining },
      ].filter(s => s.remaining.length > 0);
    } else {
      // MIXED/general
      let flat = expandDist(parseDist(profile.boys_tent_distribution_json));
      if (!flat.length) {
        const totalPax = profile.participant_count || profile.total_pax || 0;
        flat = autoExpandFromPaxWithTents(totalPax, sortedAvailableTents)
          || autoExpandFromPax(totalPax);
      }
      const remaining = subtractAllocated(flat, allocatedPaxByGender.MIXED);
      return remaining.length > 0
        ? [{ gender: "MIXED", label: "כללי", remaining }]
        : [];
    }
  }, [profile, hasGenderSplit, allocatedPaxByGender, sortedAvailableTents]);

  const totalRemainingTents = segments.reduce((s, seg) => s + seg.remaining.length, 0);

  // ── Run allocation logic ────────────────────────────────────────────────────
  const runAutoAllocation = () => {
    setDone(false);

    if (!profile) {
      setPreview({ error: "אין פרופיל תפעולי — נא להשלים את פרטי הקבוצה." });
      return;
    }

    if (segments.length === 0) {
      setPreview({ error: "כל המשתתפים כבר שובצו — אין משתתפים שנותרו לשיבוץ." });
      return;
    }

    // Available tents pool — reuse the memoized sortedAvailableTents
    const available = sortedAvailableTents;

    if (available.length === 0) {
      setPreview({ error: "אין אוהלים פנויים בשכונה זו לשיבוץ." });
      return;
    }

    // PARTIAL FILL: if neighborhood can't fit the full requirement,
    // fill as many tents as available and leave the rest for the next neighborhood.
    const result = [];
    let tentCursor = 0;
    let isPartial = false;

    for (const seg of segments) {
      const rows = [];
      for (const pax of seg.remaining) {
        const tent = available[tentCursor];
        if (!tent) {
          // No more tents in this neighborhood — stop (partial fill is OK)
          isPartial = true;
          break;
        }
        // Use actual tent capacity — clamp pax to what this tent can hold
        const effectivePax = Math.min(pax, tent.capacity || 8);
        rows.push({ tent, pax: effectivePax });
        tentCursor++;
      }
      if (rows.length > 0) {
        result.push({ gender: seg.gender, label: seg.label, rows });
      }
    }

    if (result.length === 0) {
      setPreview({ error: "לא ניתן לשבץ אף אוהל בשכונה זו." });
      return;
    }

    setPreview({ segments: result, error: null, isPartial });
  };

  // ── Save all segments as DRAFT rows ────────────────────────────────────────
  const handleSave = async () => {
    if (!preview?.segments?.length) return;
    setSaving(true);
    try {
      const ops = [];
      for (const seg of preview.segments) {
        for (const { tent, pax } of seg.rows) {
          ops.push(base44.entities.SleepingAllocation.create({
            group_id:                     groupId,
            operational_group_profile_id: profileId,
            tent_id:                      tent.id,
            neighborhood_id:              neighborhood.id,
            arrival_date:                 arrivalDate,
            departure_date:               departureDate,
            allocated_pax:                pax,
            allocation_type:              "STUDENT",
            gender_group:                 seg.gender,
            status:                       "DRAFT",
            notes:                        "שיבוץ אוטומטי",
          }));
        }
      }
      await Promise.all(ops);
      const totalTents = preview.segments.reduce((s, sg) => s + sg.rows.length, 0);
      const totalPax   = preview.segments.reduce((s, sg) => s + sg.rows.reduce((ss, r) => ss + r.pax, 0), 0);
      toast.success(`שיבוץ אוטומטי נוצר — ${totalTents} אוהלים · ${totalPax} אנשים — נא לאשר שיבוץ לינה ✓`);
      setDone(true);
      setPreview(null);
      onSaved?.();
    } catch (err) {
      toast.error(err?.message || "שגיאה בשמירת השיבוץ — נסה שוב");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => { setPreview(null); setDone(false); };

  // ── Render ─────────────────────────────────────────────────────────────────

  const GENDER_STYLE = {
    BOYS:  "bg-emerald-50 border-emerald-200 text-emerald-800",
    GIRLS: "bg-orange-50 border-orange-200 text-orange-800",
    MIXED: "bg-violet-50 border-violet-200 text-violet-800",
  };
  const ROW_STYLE = {
    BOYS:  "bg-emerald-50 border-emerald-200",
    GIRLS: "bg-orange-50 border-orange-200",
    MIXED: "bg-violet-50 border-violet-200",
  };

  return (
    <div className="space-y-2">
      {/* Trigger */}
      {!preview && !done && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 border-violet-200 text-violet-700 hover:bg-violet-50"
          onClick={runAutoAllocation}
        >
          <Wand2 className="w-3 h-3" />
          שיבוץ אוטומטי
        </Button>
      )}

      {/* Done badge — show button again to allow re-run for next neighborhood */}
      {done && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-violet-100 text-violet-700 border border-violet-200 rounded-full px-2 py-0.5">
            <CheckCircle2 className="w-3 h-3" /> שיבוץ אוטומטי נוצר
          </span>
          <Button
            size="sm" variant="ghost"
            className="h-6 text-[10px] text-violet-600 px-1"
            onClick={() => setDone(false)}
          >שיבוץ נוסף</Button>
        </div>
      )}

      {/* Preview / error */}
      {preview && (
        <div className="border rounded-xl overflow-hidden bg-white">
          {preview.error ? (
            <div className="flex items-start gap-2 p-3 bg-red-50 border-red-200 text-xs text-red-700">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">לא ניתן לבצע שיבוץ אוטומטי</p>
                <p className="mt-0.5">{preview.error}</p>
                <Button size="sm" variant="ghost" className="h-6 text-xs text-red-600 mt-1 px-1" onClick={handleCancel}>סגור</Button>
              </div>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              <p className="text-xs font-semibold text-violet-800 flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5" />
                תצוגה מקדימה — שיבוץ אוטומטי
                {preview.isPartial && (
                  <span className="text-amber-600 font-normal normal-case">· שיבוץ חלקי — לא כל השכונה מספיקה</span>
                )}
              </p>
              {preview.isPartial && (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>השכונה אינה מספיקה לכל הדרישה. ניתן לאשר שיבוץ חלקי זה ולהמשיך לשכונה נוספת עבור הנותרים.</span>
                </div>
              )}

              {preview.segments.map(seg => (
                <div key={seg.gender} className={`border rounded-lg p-2 space-y-1 ${GENDER_STYLE[seg.gender]}`}>
                  <p className="text-[11px] font-bold">
                    {seg.label} — {seg.rows.length} אוהלים · {seg.rows.reduce((s, r) => s + r.pax, 0)} אנשים
                  </p>
                  {seg.rows.map(({ tent, pax }) => (
                    <div key={tent.id} className={`flex items-center justify-between text-xs px-3 py-1.5 border rounded-lg bg-white`}>
                      <span className="font-semibold text-slate-800">אוהל {tent.code}</span>
                      <span className="font-medium">{pax} מיטות</span>
                    </div>
                  ))}
                </div>
              ))}

              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCancel} disabled={saving}>ביטול</Button>
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