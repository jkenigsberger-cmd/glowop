/**
 * Parses and displays dietary/allergy summary for a meal card.
 * Priority: current profile special_diets > stale meal special_diets_summary > null
 */
import { DIET_FIELDS, parseDiets } from "@/lib/kitchenDiets";

export default function KitchenDietaryBadge({ meal, profile }) {
  // Priority: current profile diet > stale meal snapshot
  const diets =
    parseDiets(profile?.special_diets) ||
    parseDiets(meal?.special_diets_summary) ||
    null;

  if (!diets) return null;

  const lifeCount = Number(diets.lifeThreatening_count) || 0;
  const activeFields = DIET_FIELDS.filter(f => Number(diets[f.key]) > 0);
  const dietNotes = diets.diet_notes?.trim();

  if (lifeCount === 0 && activeFields.length === 0 && !dietNotes) return null;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
        צרכים תזונתיים ואלרגיות
      </p>

      {/* Life-threatening — prominent red box */}
      {lifeCount > 0 && (
        <div className="flex items-center gap-2 bg-red-600 text-white rounded-lg px-3 py-2">
          <span className="text-base">⚠</span>
          <span className="font-bold text-sm">
            אלרגיות מסכנות חיים: {lifeCount}
          </span>
        </div>
      )}

      {/* Dietary counts */}
      {activeFields.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFields.map(f => (
            <span
              key={f.key}
              className="inline-flex items-center gap-1 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-full px-2.5 py-0.5 font-medium"
            >
              {f.label}: {diets[f.key]}
            </span>
          ))}
        </div>
      )}

      {/* Notes */}
      {dietNotes && (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
          📝 {dietNotes}
        </p>
      )}
    </div>
  );
}