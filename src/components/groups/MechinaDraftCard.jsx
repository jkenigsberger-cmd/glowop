import { Link } from "react-router-dom";
import { CalendarRange, ChevronLeft } from "lucide-react";

const formatDate = value => value ? value.split("-").reverse().join("/") : "—";

export default function MechinaDraftCard({ group }) {
  return (
    <article className="rounded-xl border border-violet-200 bg-card px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-sm">{group.group_name}</h3>
          <span className="text-[10px] font-semibold rounded-full border border-violet-300 bg-violet-50 text-violet-700 px-2 py-0.5">טיוטה לא תפעולית</span>
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <CalendarRange className="w-3.5 h-3.5" />
          {formatDate(group.arrival_date)}–{formatDate(group.departure_date)}
        </p>
      </div>
      <Link to={`/groups/${group.id}`} className="text-xs font-medium text-primary flex items-center gap-1 hover:underline">
        פתיחת פרטי קבוצה <ChevronLeft className="w-3.5 h-3.5" />
      </Link>
    </article>
  );
}