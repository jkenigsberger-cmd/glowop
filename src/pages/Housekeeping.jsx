import { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import { ChevronLeft, ChevronRight, BedDouble, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import GroupAllocationCard from "@/components/housekeeping/GroupAllocationCard";

const TODAY = new Date().toISOString().slice(0, 10);
const DAYS_AHEAD = 7;

function formatDateHebrew(dateStr) {
  try {
    return format(parseISO(dateStr), "EEEE, d בMMMM yyyy", { locale: he });
  } catch {
    return dateStr;
  }
}

export default function Housekeeping() {
  const [startDate, setStartDate] = useState(TODAY);

  const { data: allocations = [] } = useQuery({
    queryKey: ["sleepingAllocations"],
    queryFn: () => base44.entities.SleepingAllocation.list(),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list("-arrival_date", 300),
  });

  const { data: tents = [] } = useQuery({
    queryKey: ["tents"],
    queryFn: () => base44.entities.Tent.list(),
  });

  const { data: neighborhoods = [] } = useQuery({
    queryKey: ["neighborhoods"],
    queryFn: () => base44.entities.Neighborhood.list(),
  });

  const { data: nhoodReservations = [] } = useQuery({
    queryKey: ["allNhoodReservations"],
    queryFn: () => base44.entities.NeighborhoodReservation.filter({ status: "ACTIVE" }),
  });

  // Build lookup maps
  const groupsMap = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups]);
  const tentsMap  = useMemo(() => Object.fromEntries(tents.map(t => [t.id, t])), [tents]);
  const neighborhoodsMap = useMemo(() => Object.fromEntries(neighborhoods.map(n => [n.id, n])), [neighborhoods]);

  // Only CONFIRMED allocations for housekeeping display (DRAFT = not yet confirmed)
  const activeAllocations = useMemo(
    () => allocations.filter(a => a.status === "CONFIRMED"),
    [allocations]
  );

  // Groups with only DRAFT SleepingAllocation rows (specific tent — not yet confirmed)
  const draftOnlyGroupIds = useMemo(() => {
    const confirmedGroupIds = new Set(activeAllocations.map(a => a.group_id));
    const draftGroupIds = new Set(allocations.filter(a => a.status === "DRAFT").map(a => a.group_id));
    const result = new Set();
    draftGroupIds.forEach(id => { if (!confirmedGroupIds.has(id)) result.add(id); });
    return result;
  }, [allocations, activeAllocations]);

  // Groups with neighborhood-only reservation (no SleepingAllocation rows at all)
  const nhoodOnlyGroupIds = useMemo(() => {
    const anyAllocGroupIds = new Set(allocations.filter(a => a.status !== "CANCELLED").map(a => a.group_id));
    const nhoodGroupIds = new Set(nhoodReservations.map(r => r.group_id));
    const result = new Set();
    nhoodGroupIds.forEach(id => { if (!anyAllocGroupIds.has(id)) result.add(id); });
    return result;
  }, [allocations, nhoodReservations]);

  // Build date range to display
  const dateRange = useMemo(() => {
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }, [startDate]);

  // For each date, compute check-in groups, check-out groups, occupied
  const dateData = useMemo(() => {
    return dateRange.map(date => {
      // Groups with allocations
      const checkInAllocsByGroup  = {};
      const checkOutAllocsByGroup = {};
      const occupiedAllocsByGroup = {};

      activeAllocations.forEach(a => {
        if (a.arrival_date === date) {
          if (!checkInAllocsByGroup[a.group_id]) checkInAllocsByGroup[a.group_id] = [];
          checkInAllocsByGroup[a.group_id].push(a);
        }
        if (a.departure_date === date) {
          if (!checkOutAllocsByGroup[a.group_id]) checkOutAllocsByGroup[a.group_id] = [];
          checkOutAllocsByGroup[a.group_id].push(a);
        }
        if (a.arrival_date < date && a.departure_date > date) {
          if (!occupiedAllocsByGroup[a.group_id]) occupiedAllocsByGroup[a.group_id] = [];
          occupiedAllocsByGroup[a.group_id].push(a);
        }
      });

      // Groups arriving on this date (from Group entity directly) — for warning detection
      const arrivingGroups = groups.filter(g => g.arrival_date === date && g.status !== "CANCELLED");

      // Groups with CONFIRMED specific tent allocations already handled above (checkInAllocsByGroup)
      // Groups with only DRAFT specific tent allocation (needs confirmation)
      const draftOnlyGroups = arrivingGroups.filter(g =>
        !checkInAllocsByGroup[g.id] && draftOnlyGroupIds.has(g.id)
      );
      // Groups with neighborhood-only reservation (no tent rows at all — early planning)
      const nhoodOnlyGroups = arrivingGroups.filter(g =>
        !checkInAllocsByGroup[g.id] && !draftOnlyGroupIds.has(g.id) && nhoodOnlyGroupIds.has(g.id)
      );
      // Groups with no allocation of any kind
      const unallocatedGroups = arrivingGroups.filter(g =>
        !checkInAllocsByGroup[g.id] && !draftOnlyGroupIds.has(g.id) && !nhoodOnlyGroupIds.has(g.id)
      );

      const checkInGroupIds  = Object.keys(checkInAllocsByGroup);
      const checkOutGroupIds = Object.keys(checkOutAllocsByGroup);
      const occupiedGroupIds = Object.keys(occupiedAllocsByGroup);

      const hasActivity =
        checkInGroupIds.length > 0 ||
        checkOutGroupIds.length > 0 ||
        occupiedGroupIds.length > 0 ||
        unallocatedGroups.length > 0 ||
        draftOnlyGroups.length > 0 ||
        nhoodOnlyGroups.length > 0;

      return {
        date,
        checkInAllocsByGroup,
        checkOutAllocsByGroup,
        occupiedAllocsByGroup,
        unallocatedGroups,
        draftOnlyGroups,
        nhoodOnlyGroups,
        checkInGroupIds,
        checkOutGroupIds,
        occupiedGroupIds,
        hasActivity,
      };
    });
  }, [dateRange, activeAllocations, groups, draftOnlyGroupIds, nhoodOnlyGroupIds]);

  const hasAnyActivity = dateData.some(d => d.hasActivity);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BedDouble className="w-5 h-5 text-primary" />
              <div>
                <h1 className="text-xl font-bold">משק בית</h1>
                <p className="text-xs text-muted-foreground mt-0.5">הכנת אוהלים ומעקב ניקיון לפי קבוצה ותאריך</p>
              </div>
            </div>
            {/* Date navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="icon"
                onClick={() => setStartDate(d => {
                  const nd = new Date(d); nd.setDate(nd.getDate() - 1); return nd.toISOString().slice(0, 10);
                })}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => setStartDate(TODAY)}
                className="text-xs"
              >
                היום
              </Button>
              <Button
                variant="outline" size="icon"
                onClick={() => setStartDate(d => {
                  const nd = new Date(d); nd.setDate(nd.getDate() + 1); return nd.toISOString().slice(0, 10);
                })}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {!hasAnyActivity && (
          <div className="text-center py-20 text-muted-foreground">
            <BedDouble className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">אין קבוצות או שיבוצים בתקופה הנבחרת</p>
          </div>
        )}

        {dateData.map(({ date, checkInAllocsByGroup, checkOutAllocsByGroup, occupiedAllocsByGroup, unallocatedGroups, draftOnlyGroups, nhoodOnlyGroups, checkInGroupIds, checkOutGroupIds, occupiedGroupIds, hasActivity }) => {
          if (!hasActivity) return null;
          return (
            <section key={date}>
              {/* Date heading */}
              <h2 className="text-base font-bold text-slate-700 mb-4 pb-2 border-b border-slate-200">
                {formatDateHebrew(date)}
                {date === TODAY && (
                  <span className="mr-2 text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    היום
                  </span>
                )}
              </h2>

              {/* CHECK IN */}
              {(checkInGroupIds.length > 0 || unallocatedGroups.length > 0 || draftOnlyGroups.length > 0 || nhoodOnlyGroups.length > 0) && (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                    קבוצות נכנסות
                  </h3>
                  <div className="space-y-3">
                    {checkInGroupIds.map(gid => (
                      <GroupAllocationCard
                        key={gid}
                        group={groupsMap[gid]}
                        allocations={checkInAllocsByGroup[gid] || []}
                        tentsMap={tentsMap}
                        neighborhoodsMap={neighborhoodsMap}
                        type="checkin"
                      />
                    ))}
                    {/* Unallocated warnings */}
                    {unallocatedGroups.map(g => (
                      <GroupAllocationCard
                        key={g.id}
                        group={g}
                        allocations={[]}
                        tentsMap={tentsMap}
                        neighborhoodsMap={neighborhoodsMap}
                        type="checkin"
                      />
                    ))}
                    {/* Draft specific-tent warnings */}
                    {draftOnlyGroups.map(g => (
                      <div key={g.id} className="border border-amber-300 bg-amber-50 rounded-xl p-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="font-semibold text-sm text-slate-800">{g.group_name}</span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-blue-100 text-blue-700 border-blue-300">CHECK IN</span>
                        </div>
                        <p className="text-xs text-amber-700 font-medium mr-6">שיבוץ לפי אוהלים טרם אושר — יש לאשר בטאב שיבוץ לינה</p>
                      </div>
                    ))}
                    {/* Neighborhood-only warnings */}
                    {nhoodOnlyGroups.map(g => (
                      <div key={g.id} className="border border-blue-300 bg-blue-50 rounded-xl p-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-blue-500 shrink-0" />
                          <span className="font-semibold text-sm text-slate-800">{g.group_name}</span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-blue-100 text-blue-700 border-blue-300">CHECK IN</span>
                        </div>
                        <p className="text-xs text-blue-700 font-medium mr-6">שיבוץ אזורי בלבד — טרם בוצע פירוט לאוהלים ספציפיים</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CHECK OUT */}
              {checkOutGroupIds.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-orange-700 mb-2 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
                    קבוצות יוצאות
                  </h3>
                  <div className="space-y-3">
                    {checkOutGroupIds.map(gid => (
                      <GroupAllocationCard
                        key={gid}
                        group={groupsMap[gid]}
                        allocations={checkOutAllocsByGroup[gid] || []}
                        tentsMap={tentsMap}
                        neighborhoodsMap={neighborhoodsMap}
                        type="checkout"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* OCCUPIED */}
              {occupiedGroupIds.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-slate-400" />
                    אוהלים תפוסים
                  </h3>
                  <div className="space-y-3">
                    {occupiedGroupIds.map(gid => (
                      <GroupAllocationCard
                        key={gid}
                        group={groupsMap[gid]}
                        allocations={occupiedAllocsByGroup[gid] || []}
                        tentsMap={tentsMap}
                        neighborhoodsMap={neighborhoodsMap}
                        type="occupied"
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}