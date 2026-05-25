import { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import { ChevronLeft, ChevronRight, BedDouble } from "lucide-react";
import { Button } from "@/components/ui/button";
import GroupAllocationCard from "@/components/housekeeping/GroupAllocationCard";
import ReviewAlertsBanner from "@/components/alerts/ReviewAlertsBanner";

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
  const queryClient = useQueryClient();
  const refetchAllocations = () => queryClient.invalidateQueries({ queryKey: ["sleepingAllocations"] });

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
    queryFn: () => base44.entities.Neighborhood.list("sort_order"),
  });

  const { data: nhoodReservations = [] } = useQuery({
    queryKey: ["allNhoodReservations"],
    queryFn: () => base44.entities.NeighborhoodReservation.filter({ status: "ACTIVE" }),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["operationalProfiles"],
    queryFn: () => base44.entities.OperationalGroupProfile.list(),
  });

  // ── Lookup maps ──────────────────────────────────────────────────────────────
  const groupsMap        = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups]);
  const tentsMap         = useMemo(() => Object.fromEntries(tents.map(t => [t.id, t])), [tents]);
  const neighborhoodsMap = useMemo(() => Object.fromEntries(neighborhoods.map(n => [n.id, n])), [neighborhoods]);

  // nhoodReservationsByGroup: groupId → NeighborhoodReservation[]
  const nhoodResByGroup = useMemo(() => {
    const map = {};
    nhoodReservations.forEach(r => {
      if (!map[r.group_id]) map[r.group_id] = [];
      map[r.group_id].push(r);
    });
    return map;
  }, [nhoodReservations]);

  // profilesByGroup: groupId → OperationalGroupProfile[]
  const profilesByGroup = useMemo(() => {
    const map = {};
    profiles.forEach(p => {
      if (!map[p.group_id]) map[p.group_id] = [];
      map[p.group_id].push(p);
    });
    return map;
  }, [profiles]);

  // draftAllocsByGroup: groupId → DRAFT SleepingAllocation[]
  const draftAllocsByGroup = useMemo(() => {
    const map = {};
    allocations.filter(a => a.status === "DRAFT").forEach(a => {
      if (!map[a.group_id]) map[a.group_id] = [];
      map[a.group_id].push(a);
    });
    return map;
  }, [allocations]);

  // Only CONFIRMED allocations shown in maps/details
  const confirmedAllocations = useMemo(
    () => allocations.filter(a => a.status === "CONFIRMED"),
    [allocations]
  );

  // Groups with DRAFT-only SleepingAllocation (specific tents, not yet confirmed)
  const draftOnlyGroupIds = useMemo(() => {
    const confirmedGroupIds = new Set(confirmedAllocations.map(a => a.group_id));
    const draftGroupIds     = new Set(allocations.filter(a => a.status === "DRAFT").map(a => a.group_id));
    const result = new Set();
    draftGroupIds.forEach(id => { if (!confirmedGroupIds.has(id)) result.add(id); });
    return result;
  }, [allocations, confirmedAllocations]);

  // Groups with neighborhood-only reservation (no SleepingAllocation rows of any kind)
  const nhoodOnlyGroupIds = useMemo(() => {
    const anyAllocGroupIds = new Set(allocations.filter(a => a.status !== "CANCELLED").map(a => a.group_id));
    const nhoodGroupIds    = new Set(nhoodReservations.map(r => r.group_id));
    const result = new Set();
    nhoodGroupIds.forEach(id => { if (!anyAllocGroupIds.has(id)) result.add(id); });
    return result;
  }, [allocations, nhoodReservations]);

  // Date range
  const dateRange = useMemo(() => {
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }, [startDate]);

  // Per-date data
  const dateData = useMemo(() => {
    return dateRange.map(date => {
      // Confirmed allocations bucketed by group
      const checkInAllocsByGroup  = {};
      const checkOutAllocsByGroup = {};
      const occupiedAllocsByGroup = {};

      confirmedAllocations.forEach(a => {
        if (a.arrival_date === date) {
          if (!checkInAllocsByGroup[a.group_id])  checkInAllocsByGroup[a.group_id]  = [];
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

      // Groups arriving today (from Group entity) for warning-state detection
      const arrivingGroups  = groups.filter(g => g.arrival_date === date   && g.status !== "CANCELLED");
      const departingGroups = groups.filter(g => g.departure_date === date  && g.status !== "CANCELLED");

      // Check-in: not yet in confirmed bucket → draft or nhoodOnly or none
      const draftCheckIn  = arrivingGroups.filter(g => !checkInAllocsByGroup[g.id]  && draftOnlyGroupIds.has(g.id));
      const nhoodCheckIn  = arrivingGroups.filter(g => !checkInAllocsByGroup[g.id]  && !draftOnlyGroupIds.has(g.id) && nhoodOnlyGroupIds.has(g.id));
      const noneCheckIn   = arrivingGroups.filter(g => !checkInAllocsByGroup[g.id]  && !draftOnlyGroupIds.has(g.id) && !nhoodOnlyGroupIds.has(g.id));

      // Check-out: groups departing today without confirmed allocs → draft or nhoodOnly or none
      const draftCheckOut = departingGroups.filter(g => !checkOutAllocsByGroup[g.id] && draftOnlyGroupIds.has(g.id));
      const nhoodCheckOut = departingGroups.filter(g => !checkOutAllocsByGroup[g.id] && !draftOnlyGroupIds.has(g.id) && nhoodOnlyGroupIds.has(g.id));
      const noneCheckOut  = departingGroups.filter(g => !checkOutAllocsByGroup[g.id] && !draftOnlyGroupIds.has(g.id) && !nhoodOnlyGroupIds.has(g.id));

      const checkInGroupIds  = Object.keys(checkInAllocsByGroup);
      const checkOutGroupIds = Object.keys(checkOutAllocsByGroup);
      const occupiedGroupIds = Object.keys(occupiedAllocsByGroup);

      const hasActivity =
        checkInGroupIds.length > 0 || checkOutGroupIds.length > 0 || occupiedGroupIds.length > 0 ||
        draftCheckIn.length > 0 || nhoodCheckIn.length > 0 || noneCheckIn.length > 0 ||
        draftCheckOut.length > 0 || nhoodCheckOut.length > 0;

      return {
        date,
        checkInAllocsByGroup,
        checkOutAllocsByGroup,
        occupiedAllocsByGroup,
        checkInGroupIds,
        checkOutGroupIds,
        occupiedGroupIds,
        draftCheckIn, nhoodCheckIn, noneCheckIn,
        draftCheckOut, nhoodCheckOut, noneCheckOut,
        hasActivity,
      };
    });
  }, [dateRange, confirmedAllocations, groups, draftOnlyGroupIds, nhoodOnlyGroupIds]);

  const hasAnyActivity = dateData.some(d => d.hasActivity);

  // ── Helpers to build props for GroupAllocationCard ───────────────────────────
  const cardProps = (groupId, allocations, type) => ({
    group:             groupsMap[groupId],
    allocations,
    draftAllocations:  draftAllocsByGroup[groupId] || [],
    nhoodReservations: nhoodResByGroup[groupId]    || [],
    profiles:          profilesByGroup[groupId]    || [],
    tentsMap,
    neighborhoodsMap,
    type,
    onRefresh:         refetchAllocations,
  });

  const warnCardProps = (group, type) => ({
    group,
    allocations:       [],
    draftAllocations:  draftAllocsByGroup[group.id] || [],
    nhoodReservations: nhoodResByGroup[group.id]    || [],
    profiles:          profilesByGroup[group.id]    || [],
    tentsMap,
    neighborhoodsMap,
    type,
    onRefresh:         refetchAllocations,
  });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-12 sm:top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-5">
          {/* Desktop: side by side */}
          <div className="hidden sm:flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BedDouble className="w-5 h-5 text-primary" />
              <div>
                <h1 className="text-xl font-bold">משק בית</h1>
                <p className="text-xs text-muted-foreground mt-0.5">הכנת אוהלים ומעקב ניקיון לפי קבוצה ותאריך</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon"
                onClick={() => setStartDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 1); return nd.toISOString().slice(0, 10); })}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setStartDate(TODAY)} className="text-xs">היום</Button>
              <Button variant="outline" size="icon"
                onClick={() => setStartDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 1); return nd.toISOString().slice(0, 10); })}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Mobile: stacked */}
          <div className="flex sm:hidden flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-slate-700">הכנת אוהלים</span>
              </div>
              {/* Date input */}
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="text-sm border border-input rounded-md px-2 py-1 bg-transparent text-slate-600 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="flex-1 h-10 text-sm gap-1"
                onClick={() => setStartDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 1); return nd.toISOString().slice(0, 10); })}>
                <ChevronRight className="w-4 h-4" /> יום קודם
              </Button>
              <Button variant="outline" size="sm" className="h-10 px-4 text-sm font-semibold"
                onClick={() => setStartDate(TODAY)}>
                היום
              </Button>
              <Button variant="outline" size="sm" className="flex-1 h-10 text-sm gap-1"
                onClick={() => setStartDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 1); return nd.toISOString().slice(0, 10); })}>
                יום הבא <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Housekeeping review alerts */}
        <ReviewAlertsBanner module="HOUSEKEEPING" />

        {!hasAnyActivity && (
          <div className="text-center py-20 text-muted-foreground">
            <BedDouble className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">אין קבוצות או שיבוצים בתקופה הנבחרת</p>
          </div>
        )}

        {dateData.map(({
          date,
          checkInAllocsByGroup, checkOutAllocsByGroup, occupiedAllocsByGroup,
          checkInGroupIds, checkOutGroupIds, occupiedGroupIds,
          draftCheckIn, nhoodCheckIn, noneCheckIn,
          draftCheckOut, nhoodCheckOut, noneCheckOut,
          hasActivity,
        }) => {
          if (!hasActivity) return null;

          const hasCheckins  = checkInGroupIds.length > 0 || draftCheckIn.length > 0 || nhoodCheckIn.length > 0 || noneCheckIn.length > 0;
          const hasCheckouts = checkOutGroupIds.length > 0 || draftCheckOut.length > 0 || nhoodCheckOut.length > 0 || noneCheckOut.length > 0;
          const hasOccupied  = occupiedGroupIds.length > 0;

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
              {hasCheckins && (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                    קבוצות נכנסות
                  </h3>
                  <div className="space-y-2">
                    {checkInGroupIds.map(gid => (
                      <GroupAllocationCard key={gid} {...cardProps(gid, checkInAllocsByGroup[gid] || [], "checkin")} />
                    ))}
                    {draftCheckIn.map(g => (
                      <GroupAllocationCard key={g.id} {...warnCardProps(g, "checkin")} />
                    ))}
                    {nhoodCheckIn.map(g => (
                      <GroupAllocationCard key={g.id} {...warnCardProps(g, "checkin")} />
                    ))}
                    {noneCheckIn.map(g => (
                      <GroupAllocationCard key={g.id} {...warnCardProps(g, "checkin")} />
                    ))}
                  </div>
                </div>
              )}

              {/* CHECK OUT */}
              {hasCheckouts && (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-orange-700 mb-2 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
                    קבוצות יוצאות
                  </h3>
                  <div className="space-y-2">
                    {checkOutGroupIds.map(gid => (
                      <GroupAllocationCard key={gid} {...cardProps(gid, checkOutAllocsByGroup[gid] || [], "checkout")} />
                    ))}
                    {draftCheckOut.map(g => (
                      <GroupAllocationCard key={g.id} {...warnCardProps(g, "checkout")} />
                    ))}
                    {nhoodCheckOut.map(g => (
                      <GroupAllocationCard key={g.id} {...warnCardProps(g, "checkout")} />
                    ))}
                    {noneCheckOut.map(g => (
                      <GroupAllocationCard key={g.id} {...warnCardProps(g, "checkout")} />
                    ))}
                  </div>
                </div>
              )}

              {/* OCCUPIED */}
              {hasOccupied && (
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-slate-400" />
                    אוהלים תפוסים
                  </h3>
                  <div className="space-y-2">
                    {occupiedGroupIds.map(gid => (
                      <GroupAllocationCard key={gid} {...cardProps(gid, occupiedAllocsByGroup[gid] || [], "occupied")} />
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