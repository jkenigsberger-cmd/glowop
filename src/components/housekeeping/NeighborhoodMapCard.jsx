import { useState } from "react";
import { ChevronDown, ChevronUp, List, Map } from "lucide-react";
import TentAllocationRow from "./TentAllocationRow";

// ── Helpers ───────────────────────────────────────────────────────────────────

const GENDER_LABEL = { BOYS: "בנים", GIRLS: "בנות", MEN: "גברים", WOMEN: "נשים" };
const GENDER_COLOR = {
  BOYS:  { bg: "bg-emerald-100", border: "border-emerald-400", text: "text-emerald-800", dot: "bg-emerald-500" },
  GIRLS: { bg: "bg-orange-100",  border: "border-orange-400",  text: "text-orange-800",  dot: "bg-orange-500"  },
  MEN:   { bg: "bg-emerald-100", border: "border-emerald-400", text: "text-emerald-800",  dot: "bg-emerald-500" },
  WOMEN: { bg: "bg-orange-100",  border: "border-orange-400",  text: "text-orange-800",  dot: "bg-orange-500"  },
};

// Parse tent code: returns { num, suffix, raw }
// e.g. "11א" → { num: 11, suffix: "א", raw: "11א" }
// e.g. "41"  → { num: 41, suffix: "",  raw: "41"  }
function parseTentCode(code) {
  const raw = String(code || "");
  const match = raw.match(/^(\d+)(.*)$/);
  if (!match) return { num: 9999, suffix: "", raw };
  return { num: Number(match[1]), suffix: match[2] || "", raw };
}

// Natural sort comparator for tent objects
function tentSortKey(tent) {
  const { num, suffix } = parseTentCode(tent?.code);
  // suffix: "" → 0, "א" → 1, "ב" → 2, etc.
  const suffixOrder = suffix === "" ? 0 : suffix.charCodeAt(0);
  return num * 1000 + suffixOrder;
}

// Group tents into "pair groups" by base number (for paired א/ב tents)
function groupTentsByBase(tents) {
  const groups = {};
  const order = [];
  tents.forEach(tent => {
    const { num } = parseTentCode(tent?.code);
    if (!groups[num]) { groups[num] = []; order.push(num); }
    groups[num].push(tent);
  });
  // Sort each group internally
  order.forEach(k => groups[k].sort((a, b) => tentSortKey(a) - tentSortKey(b)));
  // Return as ordered array of groups
  return order.sort((a, b) => a - b).map(k => groups[k]);
}

// ── Tent Node (radial map cell) ────────────────────────────────────────────────

function TentNode({ tent, allocation, isSelected, onClick }) {
  const isActive  = !!allocation;
  const isVip     = allocation?.allocation_type === "STAFF" || tent?.tent_type === "VIP";
  const gc        = isActive ? (GENDER_COLOR[allocation?.gender_group] || GENDER_COLOR.BOYS) : null;

  const baseStyle = isActive
    ? isVip
      ? "bg-amber-50 border-2 border-amber-400 text-amber-900 shadow-md"
      : `${gc.bg} border-2 ${gc.border} ${gc.text} shadow-md`
    : "bg-slate-50 border-2 border-slate-200 text-slate-400";

  const selectedStyle = isSelected ? "ring-2 ring-primary ring-offset-1 scale-110" : "hover:scale-105";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-0 transition-all ${baseStyle} ${selectedStyle} cursor-pointer`}
    >
      <span className="text-[11px] font-bold leading-tight">{tent?.code || "?"}</span>
      {isActive ? (
        <span className="text-[13px] font-black leading-tight">{allocation.allocated_pax}</span>
      ) : (
        <span className="text-[11px] text-slate-300 leading-tight">—</span>
      )}
    </button>
  );
}

// ── Pair Node (for א/ב pairs) ─────────────────────────────────────────────────

function PairNode({ tents, allocByTentId, isSelected, onSelect }) {
  return (
    <div className="flex flex-col gap-1">
      {tents.map(tent => (
        <TentNode
          key={tent.id}
          tent={tent}
          allocation={allocByTentId[tent.id] || null}
          isSelected={isSelected === tent.id}
          onClick={() => onSelect(tent.id)}
        />
      ))}
    </div>
  );
}

// ── Radial Map ─────────────────────────────────────────────────────────────────

function TentRadialMap({ tentGroups, allocByTentId, selectedTentId, onSelect }) {
  const n = tentGroups.length;
  if (n === 0) return (
    <p className="text-xs text-slate-400 text-center py-4">טרם בוצע פירוט לאוהלים</p>
  );

  // Center of SVG
  const CX = 120, CY = 120, R = 78;
  // Spoke endpoints for connectors
  const spokePoints = tentGroups.map((_, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2; // start top, clockwise
    return {
      x: CX + R * Math.cos(angle),
      y: CY + R * Math.sin(angle),
    };
  });

  return (
    <div className="relative flex items-center justify-center" style={{ minHeight: 260 }}>
      {/* SVG spokes */}
      <svg
        width={240} height={240}
        className="absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{ zIndex: 0 }}
      >
        {spokePoints.map((pt, i) => (
          <line
            key={i}
            x1={CX} y1={CY}
            x2={pt.x} y2={pt.y}
            stroke="#e2e8f0" strokeWidth="1.5"
          />
        ))}
        {/* Center hub */}
        <circle cx={CX} cy={CY} r={14} fill="white" stroke="#e2e8f0" strokeWidth="1.5" />
        <text x={CX} y={CY + 4} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="600">MAP</text>
      </svg>

      {/* Tent nodes positioned absolutely around center */}
      <div className="relative" style={{ width: 240, height: 240 }}>
        {tentGroups.map((group, i) => {
          const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
          const nx = CX + R * Math.cos(angle) - 28; // 28 = half of w-14
          const ny = CY + R * Math.sin(angle) - (group.length > 1 ? 35 : 28);
          const isSingle = group.length === 1;
          return (
            <div
              key={i}
              className="absolute"
              style={{ left: nx, top: ny }}
            >
              {isSingle ? (
                <TentNode
                  tent={group[0]}
                  allocation={allocByTentId[group[0].id] || null}
                  isSelected={selectedTentId === group[0].id}
                  onClick={() => onSelect(group[0].id)}
                />
              ) : (
                <PairNode
                  tents={group}
                  allocByTentId={allocByTentId}
                  isSelected={selectedTentId}
                  onSelect={onSelect}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Detail Panel for selected tent ────────────────────────────────────────────

function TentDetailPanel({ tent, allocation, onClose }) {
  if (!tent) return null;
  const isVip = allocation?.allocation_type === "STAFF" || tent.tent_type === "VIP";
  const gc = allocation ? (GENDER_COLOR[allocation.gender_group] || GENDER_COLOR.BOYS) : null;

  return (
    <div className={`rounded-xl border-2 p-3 space-y-1.5 text-sm ${
      allocation
        ? isVip
          ? "bg-amber-50 border-amber-300"
          : `${gc.bg} ${gc.border}`
        : "bg-slate-50 border-slate-200"
    }`}>
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-800">אוהל {tent.code}</span>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs px-1">✕</button>
      </div>
      {allocation ? (
        <div className="space-y-0.5 text-xs">
          <p className="font-semibold text-slate-700">להכין {allocation.allocated_pax} מיטות</p>
          <p className="text-slate-600">
            {GENDER_LABEL[allocation.gender_group] || allocation.gender_group}
            {" · "}
            {isVip ? "צוות / VIP" : "תלמידים"}
          </p>
          <p className="text-slate-500">{allocation.arrival_date} → {allocation.departure_date}</p>
          {allocation.notes && <p className="text-slate-400 truncate">📝 {allocation.notes}</p>}
          <p className="text-slate-400">קיבולת: {tent.capacity} מיטות</p>
        </div>
      ) : (
        <p className="text-xs text-slate-400">אוהל פנוי — אין שיבוץ פעיל</p>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function NeighborhoodMapCard({ neighborhood, allocations, tentsMap, allNeighborhoodTents }) {
  const [view, setView]           = useState("map"); // "map" | "list"
  const [selectedTentId, setSelectedTentId] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const totalPax    = allocations.reduce((s, a) => s + (a.allocated_pax || 0), 0);
  const name        = neighborhood?.name || "שכונה לא ידועה";

  // Build allocation lookup by tentId
  const allocByTentId = {};
  allocations.forEach(a => { allocByTentId[a.tent_id] = a; });

  // Use tents that either have an allocation OR are in allNeighborhoodTents
  // Sorted and grouped
  const sortedTents = [...(allNeighborhoodTents || [])].sort((a, b) => tentSortKey(a) - tentSortKey(b));
  const tentGroups  = groupTentsByBase(sortedTents);

  // For list: only allocated tents, sorted
  const sortedAllocations = [...allocations].sort((a, b) => {
    const ta = tentsMap[a.tent_id];
    const tb = tentsMap[b.tent_id];
    return tentSortKey(ta) - tentSortKey(tb);
  });

  const selectedTent  = selectedTentId ? tentsMap[selectedTentId] : null;
  const selectedAlloc = selectedTentId ? (allocByTentId[selectedTentId] || null) : null;

  const handleSelectTent = (tentId) => {
    setSelectedTentId(prev => prev === tentId ? null : tentId);
  };

  return (
    <div className="border border-slate-200 bg-white rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-50 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-2 min-w-0 text-right flex-1"
        >
          <span className="font-bold text-sm text-slate-800">{name}</span>
          <span className="text-[11px] text-slate-500">
            · {allocations.length} אוהלים · {totalPax} אנשים
          </span>
          {collapsed
            ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            : <ChevronUp   className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          }
        </button>

        {/* View toggle */}
        {!collapsed && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setView("map")}
              className={`p-1.5 rounded-md transition-colors ${view === "map" ? "bg-primary text-white" : "text-slate-400 hover:bg-slate-100"}`}
              title="תצוגת מפה"
            >
              <Map className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`p-1.5 rounded-md transition-colors ${view === "list" ? "bg-primary text-white" : "text-slate-400 hover:bg-slate-100"}`}
              title="תצוגת רשימה"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="p-3">
          {allocations.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">טרם בוצע פירוט לאוהלים</p>
          ) : view === "map" ? (
            <div className="space-y-3">
              <TentRadialMap
                tentGroups={tentGroups}
                allocByTentId={allocByTentId}
                selectedTentId={selectedTentId}
                onSelect={handleSelectTent}
              />
              {/* Detail panel */}
              {selectedTent && (
                <TentDetailPanel
                  tent={selectedTent}
                  allocation={selectedAlloc}
                  onClose={() => setSelectedTentId(null)}
                />
              )}
              {/* Always show simple textual list below map */}
              <div className="border-t border-slate-100 pt-2 space-y-1">
                {sortedAllocations.map(alloc => {
                  const tent = tentsMap[alloc.tent_id];
                  return (
                    <div key={alloc.id} className="flex items-center justify-between text-xs text-slate-600 px-1">
                      <span className="font-semibold text-slate-700">אוהל {tent?.code || "?"}</span>
                      <span className="text-slate-500">להכין {alloc.allocated_pax} מיטות</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* List view — full TentAllocationRow */
            <div className="space-y-1.5">
              {sortedAllocations.map(alloc => (
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
      )}
    </div>
  );
}