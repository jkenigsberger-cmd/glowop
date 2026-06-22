/**
 * Reusable logistics needs section for activity forms.
 * Props:
 *   value: object with logistics fields
 *   onChange: (patch) => void  — merges patch into parent form
 *   compact?: boolean — smaller layout for split rows
 */
import { Input } from "@/components/ui/input";

export const LOGISTICS_DEFAULTS = {
  needs_projector: false,
  needs_screen: false,
  needs_microphone: false,
  needs_sound: false,
  needs_whiteboard: false,
  needs_chair_circle: false,
  chairs_count: "",
  logistics_other: "",
};

const CHECKBOXES = [
  { key: "needs_projector",    label: "מקרן" },
  { key: "needs_screen",       label: "מסך" },
  { key: "needs_microphone",   label: "מיקרופון" },
  { key: "needs_sound",        label: "מערכת סאונד" },
  { key: "needs_whiteboard",   label: "לוח" },
  { key: "needs_chair_circle", label: "מעגל כיסאות" },
];

export const LOGISTICS_BADGE_LABELS = {
  needs_projector:    "מקרן",
  needs_screen:       "מסך",
  needs_microphone:   "מיקרופון",
  needs_sound:        "סאונד",
  needs_whiteboard:   "לוח",
  needs_chair_circle: "מעגל כיסאות",
};

/** Returns true if any logistics need is set */
export function hasLogistics(item) {
  if (!item) return false;
  return CHECKBOXES.some(c => item[c.key]) || item.chairs_count > 0 || !!item.logistics_other;
}

/** Extract logistics fields from a form/item object */
export function pickLogistics(form) {
  return {
    needs_projector:    !!form.needs_projector,
    needs_screen:       !!form.needs_screen,
    needs_microphone:   !!form.needs_microphone,
    needs_sound:        !!form.needs_sound,
    needs_whiteboard:   !!form.needs_whiteboard,
    needs_chair_circle: !!form.needs_chair_circle,
    chairs_count:       form.chairs_count ? Number(form.chairs_count) : null,
    logistics_other:    form.logistics_other || null,
  };
}

export default function LogisticsFields({ value, onChange, compact = false }) {
  const set = (k, v) => onChange({ [k]: v });

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-600">צרכים לוגיסטיים</p>
      <div className={`flex flex-wrap gap-x-4 gap-y-1.5 ${compact ? "gap-x-3" : ""}`}>
        {CHECKBOXES.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!value[key]}
              onChange={e => set(key, e.target.checked)}
              className="w-3.5 h-3.5 accent-blue-600 shrink-0"
            />
            <span className="text-xs text-slate-700">{label}</span>
          </label>
        ))}
      </div>
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2"}`}>
        <div className="space-y-0.5">
          <label className="text-[10px] text-slate-500">כמות כיסאות</label>
          <Input
            type="number"
            min="0"
            value={value.chairs_count ?? ""}
            onChange={e => set("chairs_count", e.target.value)}
            placeholder="0"
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[10px] text-slate-500">אחר</label>
          <Input
            value={value.logistics_other ?? ""}
            onChange={e => set("logistics_other", e.target.value)}
            placeholder="ציוד נוסף..."
            className="h-7 text-xs"
          />
        </div>
      </div>
    </div>
  );
}

/** Small display badges for logistics needs */
export function LogisticsBadges({ item }) {
  if (!item) return null;
  const badges = CHECKBOXES
    .filter(c => item[c.key])
    .map(c => LOGISTICS_BADGE_LABELS[c.key]);

  if (item.chairs_count > 0) badges.push(`${item.chairs_count} כיסאות`);
  if (item.logistics_other) badges.push(item.logistics_other);

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {badges.map(b => (
        <span key={b} className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 font-medium">
          {b}
        </span>
      ))}
    </div>
  );
}