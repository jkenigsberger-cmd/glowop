import { Link } from "react-router-dom";
import { ChevronLeft, MapPin, AlertCircle } from "lucide-react";

export default function DashboardActivitiesToday({ activities, groupById, spaceById }) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">אין פעילויות מתוכננות להיום</p>;
  }

  const sorted = [...activities].sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  return (
    <div className="space-y-2">
      {sorted.map(item => {
        const group = groupById[item.group_id];
        const space = item.activity_space_id ? spaceById[item.activity_space_id] : null;
        return (
          <Link
            key={item.id}
            to={group ? `/groups/${group.id}` : "#"}
            className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/30 hover:bg-muted/20 transition-colors"
          >
            <div className="text-xs text-muted-foreground text-center w-12 shrink-0">
              <p className="font-semibold text-foreground">{item.start_time}</p>
              <p>{item.end_time}</p>
            </div>
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{item.activity_name}</span>
                <span className="text-xs text-muted-foreground">{group?.group_name || "—"}</span>
                {item.pax > 0 && <span className="text-xs text-muted-foreground">{item.pax} אנשים</span>}
              </div>
              <div className="flex items-center gap-1.5 text-xs flex-wrap">
                {space ? (
                  <span className="flex items-center gap-0.5 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 text-[10px]">
                    <MapPin className="w-2.5 h-2.5" /> {space.name}
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 text-[10px]">
                    <AlertCircle className="w-2.5 h-2.5" /> ללא מרחב משוריין
                  </span>
                )}
                {item.requested_location && !space && (
                  <span className="text-[10px] text-muted-foreground">בקשה: {item.requested_location}</span>
                )}
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}