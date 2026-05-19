import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import TentAllocationRow from "./TentAllocationRow";

const GENDER_LABEL = { BOYS: "בנים", GIRLS: "בנות", MEN: "גברים", WOMEN: "נשים" };

function getTentNumber(tent) {
  const raw = String(tent?.code || tent?.name || "");
  const match = raw.match(/\d+/);
  return match ? Number(match[0]) : 9999;
}

function genderBreakdown(allocations) {
  const counts = {};
  allocations.forEach(a => {
    const key = a.gender_group;
    if (key) counts[key] = (counts[key] || 0) + (a.allocated_pax || 0);
  });
  return counts;
}

// ── Neighborhood section card ─────────────────────────────────────────────────

function NeighborhoodSection({ neighborhood, allocations, tentsMap }) {
  const [collapsed, setCollapsed] = useState(false);
  const totalPax = allocations.reduce((s, a) => s + (a.allocated_pax || 0), 0);

  // Sort allocations numerically by tent code
  const sorted = [...allocations].sort((a, b) => {
    const ta = tentsMap[a.tent_id];
    const tb = tentsMap[b.tent_id];
    return getTentNumber(ta) - getTentNumber(tb);
  });

  const name = neighborhood?.name || "שכונה לא ידועה";

  return (
    <div className="border border-slate-200 bg-white rounded-xl overflow-hidden">
      {/* Card header */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition-colors text-right"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-sm text-slate-800">{name}</span>
          <span className="text-[11px] text-slate-500">
            · {allocations.length} אוהלים · {totalPax} אנשים
          </span>
        </div>
        {collapsed
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          : <ChevronUp   className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        }
      </button>

      {!collapsed && (
        <div className="p-2 space-y-1.5">
          {sorted.map(alloc => (
            <TentAllocationRow
              key={alloc.id}
              allocation={alloc}
              tent={tentsMap[alloc.tent_id]}
              neighborhood={neighborhood}
              hideNeighborhood
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GroupAllocationCard({ group, allocations, tentsMap, neighborhoodsMap, type }) {
  const typeLabel = type === "checkin" ? "CHECK IN" : type === "checkout" ? "CHECK OUT" : "תפוס";
  const typeBadgeClass = type === "checkin"
    ? "bg-blue-100 text-blue-700 border-blue-300"
    : type === "checkout"
    ? "bg-orange-100 text-orange-700 border-orange-300"
    : "bg-slate-100 text-slate-600 border-slate-300";

  const totalPax = allocations.reduce((s, a) => s + (a.allocated_pax || 0), 0);
  const breakdown = genderBreakdown(allocations);

  // No allocation warning
  if (!group) return null;
  if (allocations.length === 0) {
    return (
      <div className="border border-amber-300 bg-amber-50 rounded-xl p-4 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold text-sm text-slate-800">{group.group_name}</span>
          </div>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${typeBadgeClass}`}>
            {typeLabel}
          </span>
        </div>
        <p className="text-xs text-amber-700 font-medium mr-6">קבוצה ללא שיבוץ לינה</p>
      </div>
    );
  }

  // Group allocations by neighborhood, sorted naturally by neighborhood sort_order then name
  const byNeighborhood = {};
  allocations.forEach(a => {
    const nid = a.neighborhood_id || "__none__";
    if (!byNeighborhood[nid]) byNeighborhood[nid] = [];
    byNeighborhood[nid].push(a);
  });

  const neighborhoodEntries = Object.entries(byNeighborhood).sort(([aidId], [bidId]) => {
    const a = neighborhoodsMap[aidId];
    const b = neighborhoodsMap[bidId];
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    // VIP last
    if (a.is_vip && !b.is_vip) return 1;
    if (!a.is_vip && b.is_vip) return -1;
    // sort_order first, then numeric from name
    const ao = a.sort_order ?? 999;
    const bo = b.sort_order ?? 999;
    return ao !== bo ? ao - bo : (a.name || "").localeCompare(b.name || "");
  });

  return (
    <div className="border border-slate-200 bg-slate-50 rounded-xl overflow-hidden">
      {/* Group header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <span className="font-bold text-sm text-slate-800">{group.group_name}</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${typeBadgeClass}`}>
            {typeLabel}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs text-slate-600">
          <span>{totalPax} משתתפים</span>
          {Object.entries(breakdown).map(([g, n]) => (
            <span key={g} className="text-slate-500">{GENDER_LABEL[g] || g}: {n}</span>
          ))}
        </div>
      </div>

      {/* Neighborhood cards — 2-column grid on md+ */}
      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        {neighborhoodEntries.map(([nid, allocs]) => (
          <NeighborhoodSection
            key={nid}
            neighborhood={neighborhoodsMap[nid]}
            allocations={allocs}
            tentsMap={tentsMap}
          />
        ))}
      </div>
    </div>
  );
}