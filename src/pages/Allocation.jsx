import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { BedDouble, Users, ChevronDown, ChevronUp, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import SleepingAllocationTab from "@/components/sleeping/SleepingAllocationTab";

const TODAY = new Date().toISOString().slice(0, 10);

function parseDist(json) {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

function distSummary(rows) {
  if (!rows.length) return null;
  const total = rows.reduce((s, r) => s + (r.tent_count || 0) * (r.people_per_tent || 0), 0);
  const desc = rows.map(r => `${r.tent_count}×${r.people_per_tent}`).join(", ");
  return `${total} איש (${desc})`;
}

function AllocationStatusBadge({ allocations }) {
  const active = allocations.filter(a => a.status !== "CANCELLED");
  const confirmed = active.filter(a => a.status === "CONFIRMED");
  const drafts = active.filter(a => a.status === "DRAFT");

  if (confirmed.length > 0 && drafts.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
        <CheckCircle2 className="w-3 h-3" /> שובץ ({confirmed.length})
      </span>
    );
  }
  if (active.length > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
        <Clock className="w-3 h-3" /> שיבוץ חלקי ({active.length})
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 border border-slate-200 rounded-full px-2 py-0.5">
      <AlertCircle className="w-3 h-3" /> ממתין לשיבוץ
    </span>
  );
}

function GroupAllocationCard({ profile, group, allocations }) {
  const [open, setOpen] = useState(false);

  const boysDist = parseDist(profile.boys_tent_distribution_json);
  const girlsDist = parseDist(profile.girls_tent_distribution_json);
  const vipRows = parseDist(profile.vip_tent_requirements_json);

  const boysSummary = distSummary(boysDist);
  const girlsSummary = distSummary(girlsDist);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Card header */}
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{group.group_name}</span>
              <AllocationStatusBadge allocations={allocations} />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span>{group.arrival_date} — {group.departure_date}</span>
              <span className="flex items-center gap-0.5">
                <Users className="w-3 h-3" />
                {profile.total_pax ?? group.total_pax ?? "—"} אנשים
              </span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setOpen(v => !v)}
            className="gap-1 shrink-0"
          >
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {open ? "סגור" : "פתח שיבוץ פיזי"}
          </Button>
        </div>

        {/* Requirements summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {profile.boys_beds_needed != null && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 space-y-0.5">
              <p className="font-semibold text-blue-700">בנים — {profile.boys_beds_needed} מיטות</p>
              {boysSummary && <p className="text-blue-600">{boysSummary}</p>}
            </div>
          )}
          {profile.girls_beds_needed != null && (
            <div className="bg-pink-50 border border-pink-100 rounded-lg px-3 py-2 space-y-0.5">
              <p className="font-semibold text-pink-700">בנות — {profile.girls_beds_needed} מיטות</p>
              {girlsSummary && <p className="text-pink-600">{girlsSummary}</p>}
            </div>
          )}
          {vipRows.length > 0 && (
            <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 space-y-0.5 sm:col-span-2">
              <p className="font-semibold text-purple-700">VIP — {vipRows.length} אוהלים</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {vipRows.map((r, i) => (
                  <span key={i} className="bg-white border border-purple-200 rounded px-2 py-0.5 text-purple-700 text-[11px]">
                    {r.gender_group} · {r.people_count} אנשים{r.purpose ? ` · ${r.purpose}` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}
          {profile.accessibility_sleeping_notes && (
            <div className="sm:col-span-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-amber-800 text-[11px]">
              ♿ נגישות: {profile.accessibility_sleeping_notes}
            </div>
          )}
          {profile.housekeeping_sleeping_notes && (
            <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-[11px]">
              📋 למשק בית: {profile.housekeeping_sleeping_notes}
            </div>
          )}
        </div>
      </div>

      {/* Physical allocation panel */}
      {open && (
        <div className="border-t border-border px-4 py-5 bg-slate-50/60">
          <SleepingAllocationTab groupId={group.id} />
        </div>
      )}
    </div>
  );
}

export default function Allocation() {
  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list("-arrival_date", 300),
  });

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ["operationalProfiles"],
    queryFn: () => base44.entities.OperationalGroupProfile.list("-accepted_at", 300),
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ["allAllocations"],
    queryFn: () => base44.entities.SleepingAllocation.list(),
  });

  const loading = loadingGroups || loadingProfiles;

  // Build lookups
  const groupById = Object.fromEntries(groups.map(g => [g.id, g]));
  const profileByGroupId = Object.fromEntries(profiles.map(p => [p.group_id, p]));
  const allocationsByGroupId = {};
  allocations.forEach(a => {
    if (!allocationsByGroupId[a.group_id]) allocationsByGroupId[a.group_id] = [];
    allocationsByGroupId[a.group_id].push(a);
  });

  // Ready for allocation:
  // - has OperationalGroupProfile
  // - is_sleeping_group = true
  // - sleeping_requirements_completed = true
  // - group departure_date >= today (not past)
  // - group status != CANCELLED
  const readyProfiles = profiles.filter(p => {
    const g = groupById[p.group_id];
    if (!g) return false;
    if (g.status === "CANCELLED") return false;
    if (!p.is_sleeping_group) return false;
    if (!p.sleeping_requirements_completed) return false;
    if (g.departure_date && g.departure_date < TODAY) return false;
    return true;
  });

  // Sort: arriving soonest first
  const sorted = [...readyProfiles].sort((a, b) => {
    const da = groupById[a.group_id]?.arrival_date || "";
    const db = groupById[b.group_id]?.arrival_date || "";
    return da.localeCompare(db);
  });

  // Stats
  const totalReady = sorted.length;
  const fullyAllocated = sorted.filter(p => {
    const allocs = allocationsByGroupId[p.group_id] || [];
    const active = allocs.filter(a => a.status !== "CANCELLED");
    const confirmed = active.filter(a => a.status === "CONFIRMED");
    return confirmed.length > 0 && active.length === confirmed.length;
  }).length;
  const pendingCount = totalReady - fullyAllocated;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BedDouble className="w-5 h-5 text-primary" />
              שיבוץ לינה
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              קבוצות מוכנות לשיבוץ פיזי — דרישות לינה הושלמו
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="bg-muted border border-border rounded-full px-3 py-1 font-medium">
              {pendingCount} ממתינות · {fullyAllocated} שובצו
            </span>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-primary">{totalReady}</p>
            <p className="text-xs text-muted-foreground">מוכנות לשיבוץ</p>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">ממתינות</p>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{fullyAllocated}</p>
            <p className="text-xs text-muted-foreground">שובצו</p>
          </div>
        </div>

        {/* Queue */}
        {sorted.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl text-muted-foreground text-sm">
            אין קבוצות הממתינות לשיבוץ כרגע
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map(profile => {
              const group = groupById[profile.group_id];
              if (!group) return null;
              return (
                <GroupAllocationCard
                  key={profile.id}
                  profile={profile}
                  group={group}
                  allocations={allocationsByGroupId[group.id] || []}
                />
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}