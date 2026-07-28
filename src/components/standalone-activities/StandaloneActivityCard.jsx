import { Button } from "@/components/ui/button";
import { equipmentTextSummary } from "@/components/schedule/LogisticsFields";

export default function StandaloneActivityCard({ activity, onSelect, onCancel, canCancel }) {
  const equipment = activity.assignments.map(equipmentTextSummary).filter(Boolean).join(" · ");
  return (
    <div className="rounded-xl border border-purple-200 bg-card p-4 space-y-3" dir="rtl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <span className="inline-block text-[11px] bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 font-semibold">פעילות כללית</span>
          <h3 className="font-semibold text-foreground mt-1">{activity.title}</h3>
        </div>
        <div className="text-xs text-muted-foreground text-left" dir="ltr">{activity.event_date}<br />{activity.start_time}–{activity.end_time}</div>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        {activity.spaceNames.length > 0 && <p>מרחבים: {activity.spaceNames.join(", ")}</p>}
        {activity.expected_pax > 0 && <p>משתתפים: {activity.expected_pax}</p>}
        {activity.organizer_name && <p>אחראי: {activity.organizer_name}</p>}
        {equipment && <p>ציוד: {equipment}</p>}
        {activity.preparation_notes && <p>הכנה: {activity.preparation_notes}</p>}
      </div>
      <div className="flex gap-2 justify-end">
        {canCancel && <Button size="sm" variant="outline" onClick={() => onCancel(activity)}>ביטול פעילות</Button>}
        <Button size="sm" onClick={() => onSelect(activity.id)}>פרטים ועריכה</Button>
      </div>
    </div>
  );
}