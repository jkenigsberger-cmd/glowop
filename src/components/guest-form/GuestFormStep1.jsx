import { Label } from "@/components/ui/label";

const DIET_OPTIONS = [
  { key: "vegetarian_count",     emoji: "🥬", label: "צמחוני" },
  { key: "vegan_count",          emoji: "🌱", label: "טבעוני" },
  { key: "glutenFree_count",     emoji: "🌾", label: "צליאק" },
  { key: "lifeThreatening_count",emoji: "⚠️", label: "אלרגיה מסכנת חיים" },
  { key: "nutFree_count",        emoji: "🥜", label: "ללא אגוזים" },
  { key: "eggFree_count",        emoji: "🥚", label: "ללא ביצים" },
  { key: "lactoseFree_count",    emoji: "🥛", label: "ללא לקטוז" },
];

const COFFEE_OPTIONS = [
  { key: "coffee_full",     label: "פינת קפה מלאה" },
  { key: "coffee_cookies",  label: "פינת קפה ועוגיות" },
  { key: "coffee_pastry",   label: "פינת קפה ומאפה" },
];

export default function GuestFormStep1({ form, setForm }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const selectedCoffee = form.coffee_corner_option || null;
  const toggleCoffee = (key) => {
    set("coffee_corner_option", selectedCoffee === key ? null : key);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">
        עבור כל דרישה תזונתית, ציינו כמה משתתפים זקוקים לה. השאירו 0 אם לא רלוונטי.
      </p>

      {/* Diet grid */}
      <div className="grid grid-cols-2 gap-3">
        {DIET_OPTIONS.map(({ key, emoji, label }) => (
          <div key={key} className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50">
            <span className="text-xl flex-shrink-0">{emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-700 break-words leading-tight">{label}</div>
            </div>
            <input
              type="number"
              min="0"
              value={form[key] || 0}
              onChange={e => set(key, Number(e.target.value))}
              className="w-14 border border-slate-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary flex-shrink-0"
            />
          </div>
        ))}
      </div>

      {/* Coffee corner */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">☕ פינת קפה (אופציונלי)</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {COFFEE_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleCoffee(key)}
              className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all text-center ${
                selectedCoffee === key
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white text-slate-600 border-slate-200 hover:border-amber-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {selectedCoffee && (
          <button
            type="button"
            onClick={() => set("coffee_corner_option", null)}
            className="text-xs text-slate-400 hover:text-slate-600 underline-offset-2 hover:underline"
          >
            ✕ הסר בחירה
          </button>
        )}
      </div>

      {/* Diet notes */}
      <div className="space-y-1">
        <Label className="text-slate-600">הערות נוספות לגבי מזון ואלרגיות</Label>
        <textarea
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-1 focus:ring-primary bg-white"
          placeholder="פרטו אלרגיות ספציפיות, צרכים מיוחדים..."
          value={form.diet_notes}
          onChange={e => set("diet_notes", e.target.value)}
        />
      </div>
    </div>
  );
}