/**
 * Parses and displays dietary/allergy summary for a meal card.
 * Priority: meal special_diets_summary > profile special_diets > null
 */

const DIET_FIELDS = [
  { key: "vegetarian_count",     label: "צמחונים" },
  { key: "vegan_count",          label: "טבעונים" },
  { key: "glutenFree_count",     label: "ללא גלוטן" },
  { key: "lactoseFree_count",    label: "ללא לקטוז" },
  { key: "eggFree_count",        label: "ללא ביצים" },
  { key: "nutFree_count",        label: "ללא אגוזים" },
  { key: "mehadrinKosher_count", label: "מהדרין / כשרות מיוחדת" },
];

function parseDiets(raw) {
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

export default function KitchenDietaryBadge({ meal, profile }) {
  // Priority: meal-specific > profile
  const diets =
    parseDiets(meal?.special_diets_summary) ||
    parseDiets(profile?.special_diets) ||
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