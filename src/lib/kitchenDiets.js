/**
 * Shared dietary parsing/aggregation logic for the Kitchen module.
 * Source of truth for diet field labels and JSON parsing.
 */

export const DIET_FIELDS = [
  { key: "vegetarian_count",     label: "צמחונים" },
  { key: "vegan_count",          label: "טבעונים" },
  { key: "glutenFree_count",     label: "ללא גלוטן" },
  { key: "lactoseFree_count",    label: "ללא לקטוז" },
  { key: "eggFree_count",        label: "ללא ביצים" },
  { key: "nutFree_count",        label: "ללא אגוזים" },
  { key: "mehadrinKosher_count", label: "מהדרין / כשרות מיוחדת" },
];

export function parseDiets(raw) {
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

/**
 * Aggregates special diets across a list of meals.
 * For each meal, prefers the group's OperationalGroupProfile.special_diets,
 * falling back to the meal's special_diets_summary snapshot.
 * Returns { lifeThreatening, fields: [{key, label, count}], notes }.
 */
export function aggregateDietsForMeals(meals, profileMap) {
  const totals = { lifeThreatening: 0, fields: {}, notes: [] };
  for (const meal of meals || []) {
    const profile = profileMap?.[meal.group_id];
    const diets = parseDiets(profile?.special_diets) || parseDiets(meal?.special_diets_summary);
    if (!diets) continue;
    totals.lifeThreatening += Number(diets.lifeThreatening_count) || 0;
    for (const f of DIET_FIELDS) {
      const v = Number(diets[f.key]) || 0;
      if (v > 0) totals.fields[f.key] = (totals.fields[f.key] || 0) + v;
    }
    const note = diets.diet_notes?.trim();
    if (note) totals.notes.push(note);
  }
  const fields = DIET_FIELDS
    .filter(f => totals.fields[f.key] > 0)
    .map(f => ({ key: f.key, label: f.label, count: totals.fields[f.key] }));
  return {
    lifeThreatening: totals.lifeThreatening,
    fields,
    notes: totals.notes,
  };
}