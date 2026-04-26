import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const GENDER_LABEL = { BOYS: "בנים 👦", GIRLS: "בנות 👧", MEN: "גברים 👨", WOMEN: "נשים 👩" };
const TYPE_LABEL   = { STUDENT: "חניכים", STAFF: "צוות" };

export default function SleepingAllocationList({ allocations, tents, neighborhoods, conflictTentIds, onDelete }) {
  const tentMap = {};
  tents.forEach(t => { tentMap[t.id] = t; });
  const neighborhoodMap = {};
  neighborhoods.forEach(n => { neighborhoodMap[n.id] = n; });

  const active = allocations.filter(a => a.status !== 'CANCELLED');
  if (active.length === 0) return (
    <p className="text-sm text-slate-400 italic text-center py-4">אין הקצאות עדיין. בחר אוהל מהרשימה למטה.</p>
  );

  return (
    <div className="space-y-2">
      {active.map(a => {
        const tent = tentMap[a.tent_id];
        const hood = neighborhoodMap[a.neighborhood_id];
        const hasConflict = conflictTentIds.has(a.tent_id);
        return (
          <div key={a.id} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm ${
            a.status === 'CONFIRMED' ? 'bg-emerald-50 border-emerald-200' :
            hasConflict ? 'bg-red-50 border-red-300' :
            'bg-slate-50 border-slate-200'
          }`}>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800">{tent?.code || a.tent_id}</span>
                <span className="text-xs text-slate-500">{hood?.name || ""}</span>
                <span className="text-xs px-1.5 py-0.5 rounded border bg-white border-slate-200">
                  {TYPE_LABEL[a.allocation_type]}
                </span>
                <span className="text-xs text-slate-600">{GENDER_LABEL[a.gender_group]}</span>
                <span className="font-medium text-slate-700">{a.allocated_pax} מקומות</span>
              </div>
              {hasConflict && (
                <p className="text-xs text-red-600">⚠️ קונפליקט עם קבוצה אחרת מאושרת</p>
              )}
              {a.notes && <p className="text-xs text-slate-400">{a.notes}</p>}
            </div>
            <div className="flex items-center gap-2 mr-2">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                a.status === 'CONFIRMED'
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                {a.status === 'CONFIRMED' ? 'מאושר' : 'טיוטה'}
              </span>
              {a.status === 'DRAFT' && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-red-500"
                  onClick={() => onDelete(a.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}