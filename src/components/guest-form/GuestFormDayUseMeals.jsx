// DAY_USE simple meal + coffee selection — no time, no pax, no notes per item

const MEALS = [
  { key: "breakfast", label: "ארוחת בוקר",  emoji: "🌅" },
  { key: "lunch",     label: "ארוחת צהריים", emoji: "🍽️" },
  { key: "dinner",    label: "ארוחת ערב",    emoji: "🌙" },
];

function YesNoButton({ value, option, onClick }) {
  const isSelected = value === option;
  const isYes = option === "כן";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${
        isSelected
          ? isYes
            ? "bg-green-600 text-white border-green-600"
            : "bg-slate-400 text-white border-slate-400"
          : "bg-white text-slate-600 border-slate-200 hover:border-primary"
      }`}
    >
      {option}
    </button>
  );
}

function MealRow({ label, emoji, value, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 w-40 shrink-0">
        <span className="text-base">{emoji}</span>
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <div className="flex gap-2 flex-1">
        <YesNoButton value={value} option="כן" onClick={() => onChange("כן")} />
        <YesNoButton value={value} option="לא" onClick={() => onChange("לא")} />
      </div>
    </div>
  );
}

export default function GuestFormDayUseMeals({ meals, setMeals, coffeeCorner, setCoffeeCorner, quoteData }) {
  const date = quoteData?.arrival_date || "";

  const update = (key, val) => {
    setMeals(prev => ({ ...prev, [key]: val }));
  };

  const coffeeAnswer = coffeeCorner?.answer ?? null;
  const handleCoffee = (val) => {
    setCoffeeCorner({ answer: val, service_type: "קפה ועוגיות" });
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-1">ארוחות ביום הפעילות</h3>
        <p className="text-xs text-slate-500">
          סמנו אילו אפשרויות מזון תרצו ביום הפעילות. הכמות תחושב לפי סה״כ המשתתפים.
        </p>
      </div>

      {date && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-xs text-blue-700 font-medium">
          📅 תאריך הפעילות: <strong>{date}</strong>
        </div>
      )}

      <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
        {MEALS.map(({ key, label, emoji }) => (
          <div key={key} className="px-4 py-3">
            <MealRow
              label={label}
              emoji={emoji}
              value={meals[key] ?? null}
              onChange={val => update(key, val)}
            />
          </div>
        ))}

      </div>

      {/* Coffee table — simple yes/no, appears exactly once */}
      <div className="border border-amber-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-amber-50 flex items-center gap-2">
          <span className="text-base">☕</span>
          <span className="font-medium text-slate-700 text-sm">פינת קפה ועוגיות</span>
        </div>
        <div className="px-4 py-3 flex gap-2">
          <YesNoButton value={coffeeAnswer} option="כן" onClick={() => handleCoffee("כן")} />
          <YesNoButton value={coffeeAnswer} option="לא" onClick={() => handleCoffee("לא")} />
        </div>
      </div>
    </div>
  );
}