import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Users, ChevronLeft } from "lucide-react";
import GroupStatusBadge from "@/components/groups/GroupStatusBadge";

/**
 * Compact group card for the Groups page.
 * Shows: name, type badge, status badge, date range, pax, contact.
 */
export default function GroupCard({ group }) {
  const isDayUse = group.group_type === "DAY_USE";

  return (
    <Link
      to={`/groups/${group.id}`}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
    >
      <div className="flex-1 min-w-0 space-y-1">
        {/* Line 1: name + type + status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-slate-800">{group.group_name}</span>
          <span className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 border ${isDayUse ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
            {isDayUse ? "באי יום" : "לינה"}
          </span>
          <GroupStatusBadge status={group.status} />
        </div>

        {/* Line 2: dates, pax, contact */}
        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
          <span>
            {group.arrival_date ? format(parseISO(group.arrival_date), "dd/MM/yy") : "—"}
            {!isDayUse && group.departure_date && `–${format(parseISO(group.departure_date), "dd/MM/yy")}`}
          </span>
          {group.total_pax ? (
            <span className="flex items-center gap-0.5">
              <Users className="w-3 h-3" />
              {group.total_pax} אנשים
            </span>
          ) : null}
          {group.contact_name && <span>{group.contact_name}</span>}
        </div>
      </div>

      <ChevronLeft className="w-4 h-4 text-slate-300 shrink-0" />
    </Link>
  );
}