import StandaloneActivityCard from "@/components/standalone-activities/StandaloneActivityCard";

export default function StandaloneActivitiesTab({ activities, onSelect, onCancel, canCancel }) {
  if (activities.length === 0) {
    return <div className="text-center py-16 text-sm text-muted-foreground">אין פעילויות כלליות פעילות</div>;
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {activities.map((activity) => (
        <StandaloneActivityCard key={activity.id} activity={activity} onSelect={onSelect} onCancel={onCancel} canCancel={canCancel} />
      ))}
    </div>
  );
}