import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ShieldAlert, Loader2 } from "lucide-react";

function Row({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <span className="text-[11px] text-slate-400 block">{label}</span>
      <span className="text-sm text-slate-700 font-medium">{value}</span>
    </div>
  );
}

function fmtDate(d) {
  try { return format(parseISO(d), "dd/MM/yyyy"); } catch { return d; }
}

const GROUP_TYPE_LABEL = { LODGING: "לינה", DAY_USE: "יום כיף" };
const SOURCE_LABEL     = { QUOTE_APPROVAL: "אישור הצעת מחיר" };

export default function OperationalHoldCard({ groupId }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    base44.auth.me().then(user => {
      const role = user?.role ?? "";
      setIsAdmin(role.toUpperCase() === "ADMIN");
      setAuthChecked(true);
    });
  }, []);

  const { data: holds = [], isLoading } = useQuery({
    queryKey: ["operationalHolds", groupId],
    queryFn: () => base44.entities.OperationalHold.filter({ group_id: groupId }),
    enabled: isAdmin && authChecked,
  });

  if (!authChecked || !isAdmin) return null;

  const hold = holds.find(h => h.status === "ACTIVE");

  return (
    <section>
      <h2 className="font-semibold flex items-center gap-2 mb-3 text-sm text-slate-500">
        <ShieldAlert className="w-4 h-4 text-slate-400" />
        אחזקה תפעולית
        <span className="text-[10px] font-normal bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">admin</span>
      </h2>

      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
          </div>
        ) : !hold ? (
          <p className="text-sm text-slate-400 italic text-center py-1">
            לא קיימת אחזקה תפעולית פעילה לקבוצה זו
          </p>
        ) : (
          <div className="space-y-3">
            {/* Status + type row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
                {hold.status}
              </span>
              <span className="text-xs px-2 py-0.5 rounded border bg-slate-100 text-slate-600 border-slate-200">
                {GROUP_TYPE_LABEL[hold.group_type] || hold.group_type}
              </span>
              <span className="text-xs px-2 py-0.5 rounded border bg-slate-100 text-slate-600 border-slate-200">
                {hold.hold_type}
              </span>
            </div>

            {/* Dates + pax grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
              <Row label="הגעה"         value={hold.arrival_date   ? fmtDate(hold.arrival_date)   : null} />
              <Row label="עזיבה"        value={hold.departure_date ? fmtDate(hold.departure_date) : null} />
              <Row label='סה"כ משתתפים' value={hold.total_pax} />
              <Row label="חניכים"       value={hold.participant_count} />
              <Row label="צוות"         value={hold.staff_count} />
              <Row label="מקור"         value={SOURCE_LABEL[hold.source] || hold.source} />
            </div>

            {/* Booleans */}
            <div className="flex flex-wrap gap-2 pt-1">
              <span className={`text-xs px-2 py-0.5 rounded border ${hold.includes_meals ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-400 border-slate-200"}`}>
                {hold.includes_meals ? "✓" : "✗"} ארוחות
              </span>
              <span className={`text-xs px-2 py-0.5 rounded border ${hold.includes_activities ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-400 border-slate-200"}`}>
                {hold.includes_activities ? "✓" : "✗"} פעילויות
              </span>
            </div>

            {/* Override warning */}
            {hold.override_capacity_warning && (
              <div className="text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2 space-y-0.5">
                <p className="font-semibold">⚠️ אזהרת קיבולת נעקפה</p>
                {hold.override_reason && <p className="text-amber-600">{hold.override_reason}</p>}
              </div>
            )}

            {/* Debug: quote_id very subtle */}
            {hold.quote_id && (
              <p className="text-[10px] text-slate-300 font-mono mt-1 truncate">
                quote: {hold.quote_id}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}