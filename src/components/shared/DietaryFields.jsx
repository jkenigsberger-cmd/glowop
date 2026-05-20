/**
 * DietaryFields — reusable dietary/allergy input section.
 * Used in GroupFormModal (group level) and new meal form.
 *
 * Props:
 *   value: object with diet keys + diet_notes
 *   onChange: (newValue) => void
 *   compact: bool — smaller grid (default false)
 */
import { Input } from "@/components/ui/input";

export const DIET_FIELDS = [
  { key: "vegetarian_count",      label: "צמחונים",                      emoji: "🥦" },
  { key: "vegan_count",           label: "טבעונים",                      emoji: "🌱" },
  { key: "glutenFree_count",      label: "ללא גלוטן",                    emoji: "🌾" },
  { key: "lactoseFree_count",     label: "ללא לקטוז",                    emoji: "🥛" },
  { key: "eggFree_count",         label: "ללא ביצים",                    emoji: "🥚" },
  { key: "nutFree_count",         label: "ללא אגוזים",                   emoji: "🥜" },
  { key: "mehadrinKosher_count",  label: "מהדרין / כשרות מיוחדת",       emoji: "✡️" },
  { key: "lifeThreatening_count", label: "אלרגיות מסכנות חיים",         emoji: "⚠️" },
  { key: "other_count",           label: "אחר",                          emoji: "🍽️" },
];

export const EMPTY_DIETS = {
  vegetarian_count: 0,
  vegan_count: 0,
  glutenFree_count: 0,
  lactoseFree_count: 0,
  eggFree_count: 0,
  nutFree_count: 0,
  mehadrinKosher_count: 0,
  lifeThreatening_count: 0,
  other_count: 0,
  diet_notes: "",
};

export function parseDiets(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

export function mergeDiets(base) {
  return { ...EMPTY_DIETS, ...(base || {}) };
}

export default function DietaryFields({ value = EMPTY_DIETS, onChange, compact = false }) {
  const set = (k, v) => onChange({ ...value, [k]: v });

  return (
    <div className="space-y-3">
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
        {DIET_FIELDS.map(f => (
          <div key={f.key} className="flex items-center gap-2">
            <span className="text-base w-5 shrink-0 text-center">{f.emoji}</span>
            <label className={`flex-1 text-slate-600 leading-tight ${compact ? "text-[11px]" : "text-xs"}`}>{f.label}</label>
            <Input
              type="number"
              min="0"
              value={value[f.key] ?? 0}
              onChange={e => set(f.key, Number(e.target.value) || 0)}
              className={`text-center shrink-0 ${compact ? "w-14 h-7 text-xs" : "w-16 h-8 text-xs"} ${f.key === "lifeThreatening_count" && Number(value[f.key]) > 0 ? "border-red-400 bg-red-50" : ""}`}
              placeholder="0"
            />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <label className="text-xs text-slate-500">הערות תזונתיות / אלרגיות נוספות</label>
        <Input
          value={value.diet_notes || ""}
          onChange={e => set("diet_notes", e.target.value)}
          placeholder="הערות תזונה נוספות..."
        />
      </div>
      {Number(value.lifeThreatening_count) > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-300 rounded-lg px-3 py-2 text-xs text-red-700 font-semibold">
          ⚠️ שים לב: {value.lifeThreatening_count} אלרגיות מסכנות חיים — יש לעדכן את צוות המטבח!
        </div>
      )}
    </div>
  );
}