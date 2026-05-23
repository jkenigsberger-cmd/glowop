import KitchenDietaryBadge from "./KitchenDietaryBadge";
import { Clock, Users } from "lucide-react";

const MEAL_LABELS = {
  BREAKFAST: "ארוחת בוקר",
  LUNCH:     "ארוחת צהריים",
  DINNER:    "ארוחת ערב",
  OTHER:     "אחר",
};

const MEAL_COLORS = {
  BREAKFAST: "border-amber-300 bg-amber-50",
  LUNCH:     "border-green-300 bg-green-50",
  DINNER:    "border-blue-300 bg-blue-50",
  OTHER:     "border-slate-300 bg-slate-50",
};

const MEAL_HEADER_COLORS = {
  BREAKFAST: "bg-amber-100 text-amber-800",
  LUNCH:     "bg-green-100 text-green-800",
  DINNER:    "bg-blue-100 text-blue-800",
  OTHER:     "bg-slate-100 text-slate-700",
};

export default function KitchenMealCard({ meal, group, profile }) {
  const mealType = meal.meal_type || "OTHER";
  const label = MEAL_LABELS[mealType] || mealType;
  const borderColor = MEAL_COLORS[mealType] || MEAL_COLORS.OTHER;
  const headerColor = MEAL_HEADER_COLORS[mealType] || MEAL_HEADER_COLORS.OTHER;

  const participants = profile?.participant_count ?? group?.participant_count;
  const staff        = profile?.staff_count       ?? group?.staff_count;
  const totalPax     = meal.pax || profile?.total_pax || group?.total_pax;
  const groupName    = group?.group_name || "—";

  const hasSandwich = !!meal.sandwich_option;

  return (
    <div className={`rounded-xl border-2 ${borderColor} overflow-hidden shadow-sm`}>
      {/* Header */}
      <div className={`px-4 py-2 flex items-center justify-between ${headerColor}`}>
        <span className="font-bold text-sm">
          {label}
        </span>
        {meal.start_time && (
          <span className="flex items-center gap-1 text-xs font-medium opacity-80">
            <Clock className="w-3 h-3" />
            {meal.start_time}{meal.end_time ? `–${meal.end_time}` : ""}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 bg-white space-y-2">
        {/* Sandwich banner */}
        {hasSandwich && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2">
            <span className="text-base">🥪</span>
            <span className="text-sm font-bold text-amber-800">כריכים במקום ארוחה רגילה</span>
          </div>
        )}
        {/* Group + pax */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">{groupName}</p>
          </div>
          <div className="text-left shrink-0">
            <div className="flex items-center gap-1 text-slate-700">
              <Users className="w-3.5 h-3.5" />
              <span className="font-bold text-base">{totalPax}</span>
              <span className="text-xs text-slate-500">סה״כ</span>
            </div>
            {(participants != null || staff != null) && (
              <p className="text-xs text-slate-500 mt-0.5">
                {participants != null && `חניכים: ${participants}`}
                {participants != null && staff != null && " | "}
                {staff != null && `צוות: ${staff}`}
              </p>
            )}
          </div>
        </div>

        {/* Dietary */}
        <KitchenDietaryBadge meal={meal} profile={profile} />

        {/* Kitchen notes */}
        {meal.notes && (
          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 mt-1">
            💬 {meal.notes}
          </p>
        )}
      </div>
    </div>
  );
}