import { Link } from "react-router-dom";
import { UtensilsCrossed, ChevronLeft } from "lucide-react";

const MEAL_LABELS = { BREAKFAST: "ארוחת בוקר", LUNCH: "ארוחת צהריים", DINNER: "ארוחת ערב", OTHER: "אחר" };
const coffeeTypeLabel = (value) => value === "HOT_WATER_THERMOCAN_ONLY" ? "מיחם וטרמוקן בלבד" : value || "פינת קפה רגילה";
const MEAL_COLORS = {
  BREAKFAST: "bg-yellow-50 border-yellow-200 text-yellow-700",
  LUNCH:     "bg-orange-50 border-orange-200 text-orange-700",
  DINNER:    "bg-indigo-50 border-indigo-200 text-indigo-700",
  OTHER:     "bg-slate-50 border-slate-200 text-slate-600",
  COFFEE_CORNER: "bg-amber-50 border-amber-200 text-amber-700",
};

function parseDiets(json) {
  if (!json) return 0;
  try {
    const d = JSON.parse(json);
    return (d.vegetarian_count || 0) + (d.vegan_count || 0) + (d.glutenFree_count || 0) +
      (d.mehadrinKosher_count || 0) + (d.lifeThreatening_count || 0) + (d.nutFree_count || 0) +
      (d.eggFree_count || 0) + (d.lactoseFree_count || 0);
  } catch { return 0; }
}

export default function DashboardMealsToday({ meals, groupById, profileById }) {
  if (meals.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">אין ארוחות מתוכננות לתאריך זה</p>;
  }

  const sorted = [...meals].sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  return (
    <div className="space-y-2">
      {sorted.map(meal => {
        const group = groupById[meal.group_id];
        const isCoffee = !!meal.coffee_corner_type;
        const specialCount = parseDiets(meal.special_diets_summary);
        return (
          <Link
            key={meal.id}
            to={group ? `/groups/${group.id}` : "#"}
            className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/30 hover:bg-muted/20 transition-colors"
          >
            <div className="text-xs text-muted-foreground text-center w-12 shrink-0">
              <p className="font-semibold text-foreground">{meal.start_time}</p>
              <p>{meal.end_time}</p>
            </div>
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 ${isCoffee ? MEAL_COLORS.COFFEE_CORNER : MEAL_COLORS[meal.meal_type] || MEAL_COLORS.OTHER}`}>
                  {isCoffee ? coffeeTypeLabel(meal.coffee_corner_type) : MEAL_LABELS[meal.meal_type] || meal.meal_type}
                </span>
                <span className="text-sm font-medium">{group?.group_name || "—"}</span>
                <span className="text-xs text-muted-foreground">{meal.pax} אנשים</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {meal.sandwich_option && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">כריכים</span>
                )}
                {specialCount > 0 && (
                  <span className="text-[10px] bg-rose-100 text-rose-700 border border-rose-200 rounded-full px-2 py-0.5">
                    {specialCount} דיאטות מיוחדות
                  </span>
                )}
                {meal.notes && <span className="text-[10px] text-muted-foreground truncate max-w-xs">{meal.notes}</span>}
              </div>
            </div>
            <ChevronLeft className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}