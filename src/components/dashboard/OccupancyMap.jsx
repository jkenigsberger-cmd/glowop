import { useMemo } from "react";
import { BedDouble, MapPin } from "lucide-react";
import OccupancyTent from "./OccupancyTent";
import { isGroupOperationallyEnabled } from "@/lib/groupOperationalIsolation";
import { occupiesSleepingNight } from "@/lib/groupStayPeriods";
import useGroupStayPeriods from "@/hooks/useGroupStayPeriods";

/**
 * Group color palette — deterministic assignment based on group_id hash.
 * 12 visually distinct colors that look good on white backgrounds.
 */
const GROUP_COLORS = [
  "#2563EB", // blue
  "#DC2626", // red
  "#16A34A", // green
  "#9333EA", // purple
  "#EA580C", // orange
  "#0891B2", // cyan
  "#BE185D", // pink
  "#65A30D", // lime
  "#7C3AED", // violet
  "#B45309", // amber-dark
  "#0D9488", // teal
  "#C026D3", // fuchsia
];

function hashGroupId(id) {
  let hash = 0;
  for (let i = 0; i < (id || "").length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Greedy graph-coloring: assigns colors so groups that overlap in dates
 * never share a color, while non-overlapping groups may reuse colors.
 * @param {Array} groupsOnDate — array of { id, arrival_date, departure_date }
 * @returns {Object} { groupId -> colorHex }
 */
function assignColorsByOverlap(groupsOnDate) {
  const map = {};

  // Sort by hash for deterministic ordering
  const sorted = [...groupsOnDate].sort((a, b) => hashGroupId(a.id) - hashGroupId(b.id));

  // For each group, collect colors used by already-assigned overlapping groups
  for (const g of sorted) {
    const gArrival = g.arrival_date || "";
    const gDep = g.departure_date || "9999-12-31";

    const usedColors = new Set();
    for (const [otherId, color] of Object.entries(map)) {
      const other = sorted.find(s => s.id === otherId);
      if (!other) continue;
      const oArrival = other.arrival_date || "";
      const oDep = other.departure_date || "9999-12-31";
      // Overlap check: arrival_a < dep_b && arrival_b < dep_a
      if (gArrival < oDep && oArrival < gDep) {
        usedColors.add(color);
      }
    }

    // Pick first unused color
    const color = GROUP_COLORS.find(c => !usedColors.has(c)) || GROUP_COLORS[hashGroupId(g.id) % GROUP_COLORS.length];
    map[g.id] = color;
  }

  return map;
}

// ── Tent code parsing (same as NeighborhoodMapCard) ────────────────────────

function parseTentCode(code) {
  const raw = String(code || "");
  const match = raw.match(/^(\d+)(.*)$/);
  if (!match) return { num: 9999, suffix: "", raw };
  return { num: Number(match[1]), suffix: match[2] || "", raw };
}

function tentSortKey(tent) {
  const { num, suffix } = parseTentCode(tent?.code);
  const suffixOrder = suffix === "" ? 0 : suffix.charCodeAt(0);
  return num * 1000 + suffixOrder;
}

function groupTentsByBase(tents) {
  const groups = {};
  const order = [];
  (tents || []).forEach(tent => {
    const { num } = parseTentCode(tent?.code);
    if (!groups[num]) { groups[num] = []; order.push(num); }
    groups[num].push(tent);
  });
  order.forEach(k => groups[k].sort((a, b) => tentSortKey(a) - tentSortKey(b)));
  return order.sort((a, b) => a - b).map(k => groups[k]);
}

// ── VIP grid positions ────────────────────────────────────────────────────

const VIP_GRID_POSITIONS = {
  "88": { row: 1, col: 1 },
  "89": { row: 1, col: 2 },
  "80": { row: 1, col: 3 },
  "81": { row: 1, col: 4 },
  "87": { row: 2, col: 1 },
  "82": { row: 2, col: 4 },
  "83": { row: 3, col: 1 },
  "84": { row: 3, col: 2 },
  "85": { row: 3, col: 3 },
  "86": { row: 3, col: 4 },
};

// ── Regular neighborhood tent grid ────────────────────────────────────────

function RegularNeighborhoodGrid({ tents, allocByTentId, groupById, groupColorMap }) {
  if (!tents || tents.length === 0) {
    return <p className="text-xs text-slate-400 text-center py-2">אין אוהלים בשכונה זו</p>;
  }

  const tentGroups = groupTentsByBase(tents);

  return (
    <div className="flex flex-wrap gap-2 justify-start" style={{ direction: "rtl" }}>
      {tentGroups.map((group, gi) => {
        // Double tents (א/ב) side by side
        if (group.length >= 2) {
          return (
            <div key={gi} className="flex flex-row gap-1.5">
              {group.map(tent => {
                const alloc = allocByTentId[tent.id];
                const grp = alloc ? groupById[alloc.group_id] : null;
                return (
                  <OccupancyTent
                    key={tent.id}
                    tent={tent}
                    allocation={alloc || null}
                    group={grp || null}
                    groupColor={grp ? groupColorMap[grp.id] : null}
                  />
                );
              })}
            </div>
          );
        }

        // Single tent
        const tent = group[0];
        const alloc = allocByTentId[tent.id];
        const grp = alloc ? groupById[alloc.group_id] : null;
        return (
          <OccupancyTent
            key={tent.id}
            tent={tent}
            allocation={alloc || null}
            group={grp || null}
            groupColor={grp ? groupColorMap[grp.id] : null}
          />
        );
      })}
    </div>
  );
}

// ── VIP neighborhood grid ─────────────────────────────────────────────────

function VipNeighborhoodGrid({ tents, allocByTentId, groupById, groupColorMap }) {
  const tentByCode = {};
  (tents || []).forEach(t => { tentByCode[t.code] = t; });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gridTemplateRows: "repeat(3, auto)",
        gap: "8px",
        direction: "ltr",
        padding: "4px 0",
        justifyItems: "center",
      }}
    >
      {Object.entries(VIP_GRID_POSITIONS).map(([code, pos]) => {
        const tent = tentByCode[code];
        if (!tent) return <div key={code} style={{ gridRow: pos.row, gridColumn: pos.col }} />;
        const alloc = allocByTentId[tent.id];
        const grp = alloc ? groupById[alloc.group_id] : null;
        return (
          <div key={code} style={{ gridRow: pos.row, gridColumn: pos.col }}>
            <OccupancyTent
              tent={tent}
              allocation={alloc || null}
              group={grp || null}
              groupColor={grp ? groupColorMap[grp.id] : null}
            />
          </div>
        );
      })}

      {/* Center fire icon */}
      <div
        style={{
          gridRow: 2, gridColumn: "2 / span 2",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 border-2 border-amber-300 flex items-center justify-center text-xl">
          🔥
        </div>
      </div>
    </div>
  );
}

// ── Group legend ──────────────────────────────────────────────────────────

function GroupLegend({ groupColorMap, groupById }) {
  const entries = Object.entries(groupColorMap);
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
      {entries.map(([groupId, color]) => {
        const grp = groupById[groupId];
        return (
          <div key={groupId} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-slate-600">{grp?.group_name || groupId.slice(-6)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Neighborhood block ────────────────────────────────────────────────────

function NeighborhoodBlock({
  neighborhood,
  allTents,
  allocByTentId,
  groupById,
  groupColorMap,
  totalPax,
}) {
  const isVip = !!neighborhood?.is_vip;
  const name = neighborhood?.name || "שכונה";
  const tents = allTents.filter(t => t.neighborhood_id === neighborhood?.id);

  // Count allocated tents in this neighborhood for the summary
  const allocCount = tents.filter(t => allocByTentId[t.id]).length;

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-bold text-sm text-slate-800">{name}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          {allocCount > 0 && (
            <span>{allocCount} אוהלים משובצים</span>
          )}
          {totalPax > 0 && (
            <span className="font-semibold text-slate-600">· {totalPax} אנשים</span>
          )}
        </div>
      </div>

      {/* Tents grid */}
      <div className="p-3">
        {isVip ? (
          <VipNeighborhoodGrid
            tents={tents}
            allocByTentId={allocByTentId}
            groupById={groupById}
            groupColorMap={groupColorMap}
          />
        ) : (
          <RegularNeighborhoodGrid
            tents={tents}
            allocByTentId={allocByTentId}
            groupById={groupById}
            groupColorMap={groupColorMap}
          />
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────

export default function OccupancyMap({
  selectedDate,
  neighborhoods = [],
  tents = [],
  allocations = [],
  groups = [],
  periodsByGroupIdOverride = null,
}) {
  const operationalGroups = useMemo(() => groups.filter(isGroupOperationallyEnabled), [groups]);
  const groupById = useMemo(() => Object.fromEntries(operationalGroups.map(g => [g.id, g])), [operationalGroups]);
  const { periodsByGroupId: livePeriodsByGroupId } = useGroupStayPeriods(operationalGroups);
  const periodsByGroupId = periodsByGroupIdOverride || livePeriodsByGroupId;

  // Filter allocations: preserve allocation envelope, then hide MULTI_PERIOD gap nights.
  const dateAllocs = useMemo(() =>
    allocations.filter(a => {
      const group = groupById[a.group_id];
      if (!group || a.status !== "CONFIRMED") return false;
      if (!(a.arrival_date <= selectedDate && a.departure_date > selectedDate)) return false;
      return group.stay_mode !== "MULTI_PERIOD"
        || occupiesSleepingNight(selectedDate, periodsByGroupId[group.id] || []);
    }),
    [allocations, selectedDate, groupById, periodsByGroupId]
  );

  // Build tent → allocation lookup
  const allocByTentId = useMemo(() => {
    const map = {};
    dateAllocs.forEach(a => { map[a.tent_id] = a; });
    return map;
  }, [dateAllocs]);

  // Collect unique groups from allocations
  const activeGroupIds = useMemo(() =>
    [...new Set(dateAllocs.map(a => a.group_id).filter(Boolean))],
    [dateAllocs]
  );

  // Assign colors — greedy coloring so overlapping groups never share a color
  const groupColorMap = useMemo(() => {
    const groupsOnDate = activeGroupIds
      .map(id => groupById[id])
      .filter(Boolean)
      .map(g => ({ id: g.id, arrival_date: g.arrival_date, departure_date: g.departure_date }));
    return assignColorsByOverlap(groupsOnDate);
  }, [activeGroupIds, groupById]);

  // Sort neighborhoods: non-VIP first by sort_order, VIP last
  const sortedNeighborhoods = useMemo(() =>
    [...neighborhoods].sort((a, b) => {
      if (a.is_vip && !b.is_vip) return 1;
      if (!a.is_vip && b.is_vip) return -1;
      return (a.sort_order ?? 999) - (b.sort_order ?? 999);
    }),
    [neighborhoods]
  );

  // Compute per-neighborhood pax
  const paxByNeighborhood = useMemo(() => {
    const map = {};
    dateAllocs.forEach(a => {
      const tent = tents.find(t => t.id === a.tent_id);
      const nid = tent?.neighborhood_id;
      if (nid) map[nid] = (map[nid] || 0) + (a.allocated_pax || 0);
    });
    return map;
  }, [dateAllocs, tents]);

  if (neighborhoods.length === 0) {
    return (
      <div className="border border-slate-200 rounded-xl bg-white p-8 text-center">
        <BedDouble className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">אין נתוני שכונות זמינים</p>
      </div>
    );
  }

  const totalAllocated = dateAllocs.reduce((s, a) => s + (a.allocated_pax || 0), 0);

  return (
    <div className="space-y-3" dir="rtl">
      {/* Summary bar */}
      <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
        <BedDouble className="w-3.5 h-3.5" />
        <span>
          {dateAllocs.length > 0
            ? `${dateAllocs.length} אוהלים משובצים · ${totalAllocated} אנשים · ${activeGroupIds.length} קבוצות`
            : "אין שיבוצים מאושרים לתאריך זה"}
        </span>
      </div>

      {/* Neighborhood blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sortedNeighborhoods.map(nhood => (
          <NeighborhoodBlock
            key={nhood.id}
            neighborhood={nhood}
            allTents={tents}
            allocByTentId={allocByTentId}
            groupById={groupById}
            groupColorMap={groupColorMap}
            totalPax={paxByNeighborhood[nhood.id] || 0}
          />
        ))}
      </div>

      {/* Group legend */}
      {activeGroupIds.length > 0 && (
        <GroupLegend groupColorMap={groupColorMap} groupById={groupById} />
      )}
    </div>
  );
}