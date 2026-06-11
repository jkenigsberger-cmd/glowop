import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MEAL_QUESTION_ANSWER = ["כן", "לא", "לא בטוח / נדבר על זה"];

function MealQuestion({ mealLabel, emoji, stateKey, value, onChange, defaultPax }) {
  const isYes = value?.answer === "כן";
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <span className="font-medium text-slate-700 text-sm">{mealLabel}</span>
      </div>
      <div className="px-4 py-3 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {MEAL_QUESTION_ANSWER.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange({ ...value, answer: opt })}
              className={`py-2 px-2 rounded-xl border text-xs font-medium transition-all text-center ${
                value?.answer === opt
                  ? opt === "כן"
                    ? "bg-green-600 text-white border-green-600"
                    : opt === "לא"
                      ? "bg-slate-400 text-white border-slate-400"
                      : "bg-amber-500 text-white border-amber-500"
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

function CoffeeQuestion({ value, onChange, defaultPax }) {
  const isYes = value?.answer === "כן";
  return (
    <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/30">
      <div className="px-4 py-3 bg-amber-50 flex items-center gap-2">
        <span className="text-lg">☕</span>
        <span className="font-medium text-slate-700 text-sm">האם תרצו פינת קפה?</span>
      </div>
      <div className="px-4 py-3 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {MEAL_QUESTION_ANSWER.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange({ ...value, answer: opt, service_type: value?.service_type || "קפה ועוגיות" })}
              className={`py-2 px-2 rounded-xl border text-xs font-medium transition-all text-center ${
                value?.answer === opt
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-white text-slate-600 border-slate-200 hover:border-amber-400"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>

        {isYes && (
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs text-slate-500">סוג פינת קפה</Label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                value={value?.service_type ?? "קפה ועוגיות"}
                onChange={e => onChange({ ...value, service_type: e.target.value })}
              >
                <option value="קפה ועוגיות">קפה ועוגיות</option>
                <option value="אחר">אחר</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">מספר אנשים</Label>
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
              <Label className="text-xs text-slate-500">מיקום / הערות</Label>
              <textarea
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[56px] focus:outline-none focus:ring-1 focus:ring-primary bg-white resize-none"
                placeholder="לדוגמה: מתחם חוץ, כיתה מס׳ 3, או כל הערה אחרת..."
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

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        אנא ציינו אילו ארוחות תרצו ביום הפעילות. עבור כל ארוחה — ציינו את מספר המשתתפים ואת השעה המועדפת.
      </p>

      {date && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-xs text-blue-700 font-medium">
          📅 תאריך הפעילות: <strong>{date}</strong>
        </div>
      )}

      <MealQuestion
        mealLabel="ארוחת בוקר"
        emoji="🌅"
        stateKey="breakfast"
        value={meals.breakfast}
        onChange={v => update("breakfast", v)}
        defaultPax={defaultPax}
      />
      <MealQuestion
        mealLabel="ארוחת צהריים"
        emoji="🍽️"
        stateKey="lunch"
        value={meals.lunch}
        onChange={v => update("lunch", v)}
        defaultPax={defaultPax}
      />
      <MealQuestion
        mealLabel="ארוחת ערב"
        emoji="🌙"
        stateKey="dinner"
        value={meals.dinner}
        onChange={v => update("dinner", v)}
        defaultPax={defaultPax}
      />

      <CoffeeQuestion
        value={coffeeCorner}
        onChange={setCoffeeCorner}
        defaultPax={defaultPax}
      />
    </div>
  );
}