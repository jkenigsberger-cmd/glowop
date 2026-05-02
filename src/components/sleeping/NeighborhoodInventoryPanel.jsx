import { useState } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const GENDER_LABEL = { BOYS: "בנים", GIRLS: "בנות", MEN: "גברים", WOMEN: "נשים" };
const TYPE_LABEL   = { STAFF: "צוות", STUDENT: "חניכים", SECURITY: "אבטחה" };

// color per gender+type for VIP allocated cards
function allocCardStyle(gender, type) {
  if (type === "SECURITY") {
    return gender === "MEN"
      ? "bg-orange-50 border-orange-300 text-orange-800"
      : "bg-fuchsia-50 border-fuchsia-300 text-fuchsia-800";
  }
  return gender === "MEN" || gender === "BOYS"
    ? "bg-blue-50 border-blue-300 text-blue-800"
    : "bg-pink-50 border-pink-300 text-pink-800";
}

/**
 * Renders one neighborhood and its tents with availability info.
 *
 * conflictMap: { [tent_id]: { group_name, gender_group } | 'BLOCKED_NEIGHBORHOOD' }
 * currentGroupAllocMap: { [tent_id]: SleepingAllocation }
 */
export default function NeighborhoodInventoryPanel({
  neighborhood,
  tents,
  conflictMap,
  currentGroupAllocMap,
  onAllocateTent,
}) {
  const [open, setOpen] = useState(true);
  const isVip = neighborhood.is_vip === true;
  const neighborhoodBlocked = Object.values(conflictMap).some(v => v === 'BLOCKED_NEIGHBORHOOD');

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-right"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-slate-700">{neighborhood.name}</span>
          {isVip && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">VIP</span>
          )}
          {neighborhoodBlocked && !isVip && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
              חסומה — קבוצת חניכים אחרת
            </span>
          )}
          <span className="text-xs text-slate-400">{tents.length} אוהלים</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-3 py-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {tents.map(tent => {
            const conflict = conflictMap[tent.id];
            const myAlloc  = currentGroupAllocMap[tent.id];
            const isBlocked = conflict === 'BLOCKED_NEIGHBORHOOD';
            const isBookedByOther = conflict && conflict !== 'BLOCKED_NEIGHBORHOOD';
            const isAllocatedByMe = !!myAlloc && myAlloc.status !== 'CANCELLED';

            let cardClass = "border rounded-lg px-3 py-2 text-xs space-y-1 ";
            if (isAllocatedByMe && myAlloc.status === 'CONFIRMED') cardClass += "bg-emerald-50 border-emerald-300";
            else if (isAllocatedByMe) cardClass += "bg-blue-50 border-blue-300";
            else if (isBlocked || isBookedByOther) cardClass += "bg-red-50 border-red-200 opacity-70";
            else cardClass += "bg-white border-slate-200 hover:border-primary/40";

            return (
              <div key={tent.id} className={cardClass}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{tent.code}</span>
                  <div className="flex items-center gap-1">
                    {tent.is_accessible && <span title="נגיש" className="text-blue-500">♿</span>}
                    <span className="text-slate-400">{tent.capacity} 🛏️</span>
                  </div>
                </div>

                {isAllocatedByMe && (
                  <div className="space-y-0.5">
                    <div className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded px-1.5 py-0.5 border ${allocCardStyle(myAlloc.gender_group, myAlloc.allocation_type)}`}>
                      {TYPE_LABEL[myAlloc.allocation_type] || myAlloc.allocation_type}
                      {" · "}
                      {GENDER_LABEL[myAlloc.gender_group] || myAlloc.gender_group}
                      {" · "}
                      {myAlloc.allocated_pax} אנשים
                    </div>
                    <div className={`text-[9px] ${myAlloc.status === 'CONFIRMED' ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {myAlloc.status === 'CONFIRMED' ? '✓ מאושר' : '⏳ טיוטה'}
                    </div>
                  </div>
                )}

                {isBookedByOther && !isAllocatedByMe && (
                  <div className="text-[10px] text-red-600">
                    תפוס — {GENDER_LABEL[conflict.gender_group] || conflict.gender_group}
                  </div>
                )}

                {isBlocked && !isAllocatedByMe && (
                  <div className="text-[10px] text-red-500">שכונה חסומה</div>
                )}

                {!isAllocatedByMe && !isBookedByOther && !isBlocked && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] text-primary border border-primary/20 w-full mt-0.5"
                    onClick={() => onAllocateTent(tent, neighborhood)}
                  >
                    <Plus className="w-3 h-3 ml-1" /> הקצה
                  </Button>
                )}

                {isAllocatedByMe && myAlloc.status === 'DRAFT' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] text-slate-400 border border-slate-200 w-full mt-0.5"
                    onClick={() => onAllocateTent(tent, neighborhood)}
                  >
                    ✏️ ערוך
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}