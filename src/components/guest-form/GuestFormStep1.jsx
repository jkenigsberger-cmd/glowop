import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const DIET_OPTIONS = [
  { key: "vegetarian_count",     emoji: "🥬", label: "צמחוני" },
  { key: "vegan_count",          emoji: "🌱", label: "טבעוני" },
  { key: "glutenFree_count",     emoji: "🌾", label: "צליאק" },
  { key: "lifeThreatening_count",emoji: "⚠️", label: "אלרגיה מסכנת חיים" },
  { key: "nutFree_count",        emoji: "🥜", label: "ללא אגוזים" },
  { key: "eggFree_count",        emoji: "🥚", label: "ללא ביצים" },
  { key: "lactoseFree_count",    emoji: "🥛", label: "ללא לקטוז" },
];

const COFFEE_SERVICE_OPTIONS = [
  { value: "קפה ועוגיות",  label: "קפה ועוגיות" },
  { value: "אחר",           label: "אחר" },
];

export default function GuestFormStep1({ form, setForm, isDayUse = false }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setCoffeeDetail = (k, v) => setForm(f => ({ ...f, coffee_corner_detail: { ...(f.coffee_corner_detail || {}), [k]: v } }));

  const coffeeWanted = form.coffee_corner_option === true;
  const toggleCoffee = () => {
    if (coffeeWanted) {
      set("coffee_corner_option", false);
    } else {
      set("coffee_corner_option", true);
      // default service type
      if (!form.coffee_corner_detail?.service_type) setCoffeeDetail("service_type", "קפה ועוגיות");
    }
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

      {/* Coffee corner — hidden for DAY_USE (handled in meals step) */}
      {!isDayUse && (
      <div className="space-y-3 border border-amber-200 rounded-xl p-4 bg-amber-50/40">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">☕ פינת קפה (אופציונלי)</p>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!coffeeWanted}
              onChange={toggleCoffee}
              className="w-4 h-4 accent-amber-500"
            />
            <span className="text-sm text-slate-600">{coffeeWanted ? "כן, נרצה" : "לא רלוונטי"}</span>
          </label>
        </div>

        {coffeeWanted && (
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">סוג פינת קפה</Label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                value={form.coffee_corner_detail?.service_type || "קפה ועוגיות"}
                onChange={e => setCoffeeDetail("service_type", e.target.value)}
              >
                {COFFEE_SERVICE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">שעה מועדפת</Label>
                <Input type="time" value={form.coffee_corner_detail?.time || ""} onChange={e => setCoffeeDetail("time", e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">מספר אנשים</Label>
                <Input type="number" min="0" value={form.coffee_corner_detail?.pax || ""} onChange={e => setCoffeeDetail("pax", e.target.value)} className="text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">מיקום / הערות</Label>
              <textarea
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[48px] focus:outline-none focus:ring-1 focus:ring-primary bg-white resize-none"
                placeholder="לדוגמה: מתחם חוץ, כיתה מס׳ 3..."
                value={form.coffee_corner_detail?.notes || ""}
                onChange={e => setCoffeeDetail("notes", e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
      )}

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