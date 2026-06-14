export default function KitchenCoffeeCard({ meal, group }) {
  const groupName = group?.group_name || "קבוצה לא ידועה";

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-800 text-sm">{groupName}</p>
          <p className="text-xs text-amber-700 font-medium mt-0.5">
            {meal.coffee_service_type || "קפה ועוגיות"}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-amber-700">{meal.pax || "—"}</p>
          <p className="text-[10px] text-amber-600">אנשים</p>
        </div>
      </div>

      {meal.start_time && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span>🕐</span>
          <span>{meal.start_time}{meal.end_time ? ` – ${meal.end_time}` : ""}</span>
        </div>
      )}

      {meal.notes && (
        <p className="text-xs text-slate-500 border-t border-amber-100 pt-2">{meal.notes}</p>
      )}
    </div>
  );
}