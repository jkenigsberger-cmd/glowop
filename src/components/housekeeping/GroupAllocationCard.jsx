import { AlertTriangle } from "lucide-react";
import TentAllocationRow from "./TentAllocationRow";

const GENDER_LABEL = { BOYS: "בנים", GIRLS: "בנות", MEN: "גברים", WOMEN: "נשים" };

function genderBreakdown(allocations) {
  const counts = {};
  allocations.forEach(a => {
    const key = a.gender_group;
    if (key) counts[key] = (counts[key] || 0) + (a.allocated_pax || 0);
  });
  return counts;
}

export default function GroupAllocationCard({ group, allocations, tentsMap, neighborhoodsMap, type }) {
  const typeLabel = type === "checkin" ? "CHECK IN" : type === "checkout" ? "CHECK OUT" : "תפוס";
  const typeBadgeClass = type === "checkin"
    ? "bg-blue-100 text-blue-700 border-blue-300"
    : type === "checkout"
    ? "bg-orange-100 text-orange-700 border-orange-300"
    : "bg-slate-100 text-slate-600 border-slate-300";

  const totalPax = allocations.reduce((s, a) => s + (a.allocated_pax || 0), 0);
  const breakdown = genderBreakdown(allocations);

  const neighborhoodNames = [...new Set(
    allocations.map(a => neighborhoodsMap[a.neighborhood_id]?.name).filter(Boolean)
  )].join(", ");

  const hasNotes = allocations.some(a => a.notes);

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

  return (
    <div className="border border-slate-200 bg-slate-50 rounded-xl overflow-hidden">
      {/* Group header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          <span className="font-bold text-sm text-slate-800">{group.group_name}</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${typeBadgeClass}`}>
            {typeLabel}
          </span>
          {neighborhoodNames && (
            <span className="text-xs text-slate-500">{neighborhoodNames}</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs text-slate-600">
          <span>{totalPax} משתתפים</span>
          {Object.entries(breakdown).map(([g, n]) => (
            <span key={g} className="text-slate-500">{GENDER_LABEL[g] || g}: {n}</span>
          ))}
        </div>
      </div>

      {/* Tent rows */}
      <div className="p-3 space-y-2">
        {allocations.map(alloc => (
          <TentAllocationRow
            key={alloc.id}
            allocation={alloc}
            tent={tentsMap[alloc.tent_id]}
            neighborhood={neighborhoodsMap[alloc.neighborhood_id]}
          />
        ))}
      </div>
    </div>
  );
}