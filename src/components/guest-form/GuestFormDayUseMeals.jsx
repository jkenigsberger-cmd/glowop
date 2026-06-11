import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Binary only — no "לא בטוח" in DAY_USE
const MEAL_OPTIONS = ["כן", "לא"];

function MealQuestion({ mealLabel, emoji, value, onChange, defaultPax }) {
  const isYes = value?.answer === "כן";
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <span className="font-medium text-slate-700 text-sm">{mealLabel}</span>
      </div>
      <div className="px-4 py-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {MEAL_OPTIONS.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange({ ...value, answer: opt })}
              className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all text-center ${
                value?.answer === opt
                  ? opt === "כן"
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-slate-400 text-white border-slate-400"
                  : "bg-white text-slate-600 border-slate-200 hover:border-primary"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>

        {isYes && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">מספר משתתפים</Label>
                <Input
                  type="number"
                  min="0"
                  value={value?.pax ?? defaultPax ?? ""}
                  onChange={e => onChange({ ...value, pax: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">שעה מועדפת</Label>
                <Input
                  type="time"
                  value={value?.time ?? ""}
                  onChange={e => onChange({ ...value, time: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">הערות</Label>
              <textarea
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[56px] focus:outline-none focus:ring-1 focus:ring-primary bg-white resize-none"
                placeholder="בקשות מיוחדות לארוחה זו..."
                value={value?.notes ?? ""}
                onChange={e => onChange({ ...value, notes: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GuestFormDayUseMeals({ meals, setMeals, coffeeCorner, setCoffeeCorner, quoteData }) {
  const defaultPax = quoteData?.total_pax || quoteData?.participant_count || "";
  const date = quoteData?.arrival_date || "";

  const update = (key, val) => setMeals(prev => ({ ...prev, [key]: val }));

  const coffeeChecked = coffeeCorner?.answer === "כן";
  const handleCoffeeToggle = (checked) => {
    setCoffeeCorner(checked
      ? { answer: "כן", service_type: "קפה ועוגיות" }
      : { answer: "לא", service_type: "קפה ועוגיות" }
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        אנא ציינו אילו ארוחות תרצו ביום הפעילות.
      </p>

      {date && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-xs text-blue-700 font-medium">
          📅 תאריך הפעילות: <strong>{date}</strong>
        </div>
      )}

      <MealQuestion
        mealLabel="ארוחת בוקר"
        emoji="🌅"
        value={meals.breakfast}
        onChange={v => update("breakfast", v)}
        defaultPax={defaultPax}
      />
      <MealQuestion
        mealLabel="ארוחת צהריים"
        emoji="🍽️"
        value={meals.lunch}
        onChange={v => update("lunch", v)}
        defaultPax={defaultPax}
      />
      <MealQuestion
        mealLabel="ארוחת ערב"
        emoji="🌙"
        value={meals.dinner}
        onChange={v => update("dinner", v)}
        defaultPax={defaultPax}
      />
      <MealQuestion
        mealLabel="כריכים"
        emoji="🥪"
        value={meals.sandwiches}
        onChange={v => update("sandwiches", v)}
        defaultPax={defaultPax}
      />

      {/* Coffee corner — simple checkbox only */}
      <div className="border border-amber-200 rounded-xl bg-amber-50/40 px-4 py-4">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={coffeeChecked}
            onChange={e => handleCoffeeToggle(e.target.checked)}
            className="w-5 h-5 accent-amber-500 rounded"
          />
          <div>
            <span className="font-medium text-slate-700 text-sm">☕ פינת קפה ועוגיות</span>
            <p className="text-xs text-slate-400 mt-0.5">סמנו אם תרצו פינת קפה ועוגיות במהלך הפעילות</p>
          </div>
        </label>
      </div>
    </div>
  );
}