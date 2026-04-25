import { Label } from "@/components/ui/label";

const DIET_OPTIONS = [
  { key: "vegetarian_count",     emoji: "🥬", label: "צמחוני" },
  { key: "vegan_count",          emoji: "🌱", label: "טבעוני" },
  { key: "glutenFree_count",     emoji: "🌾", label: "צליאק" },
  { key: "mehadrinKosher_count", emoji: "✡️", label: "מהדרין" },
  { key: "lifeThreatening_count",emoji: "⚠️", label: "מסכן חיים" },
  { key: "nutFree_count",        emoji: "🥜", label: "ללא אגוזים" },
  { key: "eggFree_count",        emoji: "🥚", label: "ללא ביצים" },
  { key: "lactoseFree_count",    emoji: "🥛", label: "ללא לקטוז" },
];

export default function GuestFormStep1({ form, setForm }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
              <div className="text-xs font-medium text-slate-700 truncate">{label}</div>
            </div>
            <input
              type="number"
              min="0"
              value={form[key] || 0}
              onChange={e => set(key, Number(e.target.value))}
              className="w-14 border border-slate-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        ))}
      </div>

      {/* Coffee corner */}
      <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 bg-amber-50">
        <input
          type="checkbox"
          id="coffee"
          checked={form.upgraded_coffee}
          onChange={e => set("upgraded_coffee", e.target.checked)}
          className="w-4 h-4 accent-primary"
        />
        <label htmlFor="coffee" className="text-sm font-medium text-slate-700 cursor-pointer">
          ☕ פינת קפה ועוגיות (תוספת בתשלום)
        </label>
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