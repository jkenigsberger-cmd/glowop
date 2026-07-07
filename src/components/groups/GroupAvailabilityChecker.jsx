import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import CapacityWarningBanner from "@/components/quotes/CapacityWarningBanner";

/**
 * GroupAvailabilityChecker — live site availability check for the manual
 * Create/Edit Group modal. Reuses the exact same backend logic and display
 * component as the Quote flow (checkSiteAvailability + CapacityWarningBanner).
 * Informational only — never blocks saving.
 */
export default function GroupAvailabilityChecker({
  groupType,
  arrivalDate,
  departureDate,
  totalPax,
  staffCount,
  participantCount,
  boysCount,
  girlsCount,
  excludeGroupId,
}) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const pax = Number(totalPax) || 0;
  const hasRequired = !!arrivalDate && pax > 0 && !!groupType;

  const check = useCallback(async () => {
    if (!hasRequired) { setResult(null); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke("checkSiteAvailability", {
        arrival_date:      arrivalDate,
        departure_date:    departureDate || arrivalDate,
        total_pax:         pax,
        participant_count: Number(participantCount) || undefined,
        staff_count:       Number(staffCount) || undefined,
        boys_count:        Number(boysCount) || undefined,
        girls_count:       Number(girlsCount) || undefined,
        group_type:        groupType,
        includes_meals:    groupType === "LODGING",
        exclude_group_id:  excludeGroupId || undefined,
      });
      setResult(res.data);
    } catch { /* informational only — fail silently */ }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRequired, arrivalDate, departureDate, pax, participantCount, staffCount, boysCount, girlsCount, groupType, excludeGroupId]);

  useEffect(() => {
    const timer = setTimeout(check, 700);
    return () => clearTimeout(timer);
  }, [check]);

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-slate-700">🏕️ בדיקת זמינות באתר</p>
      {!hasRequired ? (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-400">
          יש למלא תאריכים וכמות משתתפים כדי לבדוק זמינות באתר
        </div>
      ) : (
        <CapacityWarningBanner availabilityResult={result} loading={loading} />
      )}
    </div>
  );
}