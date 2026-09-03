import { aggregateDietsForMeals } from "@/lib/kitchenDiets";

/**
 * Compact inline summary of special diets for one meal type (breakfast/lunch/dinner).
 * Rendered inside the meal-type header bar in Kitchen.jsx.
 */
export default function KitchenMealTypeDietSummary({ meals, profileMap }) {
  const { lifeThreatening, fields } = aggregateDietsForMeals(meals, profileMap);
  if (lifeThreatening === 0 && fields.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {lifeThreatening > 0 && (
        <span className="inline-flex items-center gap-1 bg-red-600 text-white rounded-full px-2 py-0.5 text-[11px] font-bold">
          ⚠ חיים: {lifeThreatening}
        </span>
      )}
      {fields.map(f => (
        <span
          key={f.key}
          className="inline-flex items-center bg-white/70 rounded-full px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-white/60"
        >
          {f.label}: {f.count}
        </span>
      ))}
    </div>
  );
}