import { useEffect } from "react";
import { differenceInCalendarDays, addDays, format, parseISO } from "date-fns";

const MEAL_TYPES = { BREAKFAST: "ארוחת בוקר", LUNCH: "ארוחת צהריים", DINNER: "ארוחת ערב" };

function generateMeals(arrivalDate, departureDate, arrivalLunch, departureLunch) {
  const start = parseISO(arrivalDate);
  const end = parseISO(departureDate);
  const nights = differenceInCalendarDays(end, start);
  const result = [];

  for (let i = 0; i <= nights; i++) {
    const date = format(addDays(start, i), "yyyy-MM-dd");
    const isArrival = i === 0;
    const isDeparture = i === nights;

    if (isArrival) {
      if (arrivalLunch) result.push({ date, meal_type: "LUNCH", sandwich_instead: false });
      result.push({ date, meal_type: "DINNER", sandwich_instead: false });
    } else if (isDeparture) {
      result.push({ date, meal_type: "BREAKFAST", sandwich_instead: false });
      if (departureLunch) result.push({ date, meal_type: "LUNCH", sandwich_instead: false });
    } else {
      result.push({ date, meal_type: "BREAKFAST", sandwich_instead: false });
      result.push({ date, meal_type: "LUNCH", sandwich_instead: false });
      result.push({ date, meal_type: "DINNER", sandwich_instead: false });
    }
  }
  return result;
}

function hebrewDate(dateStr) {
  try {
    return format(parseISO(dateStr), "dd/MM");
  } catch { return dateStr; }
}

export default function GuestFormStep2({ quoteData, mealOptions, setMealOptions, meals, setMeals }) {
  const { arrival_date, departure_date } = quoteData || {};
  const nights = arrival_date && departure_date
    ? differenceInCalendarDays(parseISO(departure_date), parseISO(arrival_date))
    : 0;

  // Regenerate meals when options change, preserving sandwich choices
  useEffect(() => {
    if (!arrival_date || !departure_date) return;
    const prevMap = new Map(meals.map(m => [`${m.date}_${m.meal_type}`, m.sandwich_instead]));
    const fresh = generateMeals(arrival_date, departure_date, mealOptions.arrival_lunch, mealOptions.departure_lunch);
    setMeals(fresh.map(m => ({ ...m, sandwich_instead: prevMap.get(`${m.date}_${m.meal_type}`) || false })));
  }, [mealOptions.arrival_lunch, mealOptions.departure_lunch, arrival_date, departure_date]);

  const toggleSandwich = (date, meal_type) => {
    setMeals(prev => prev.map(m =>
      m.date === date && m.meal_type === meal_type ? { ...m, sandwich_instead: !m.sandwich_instead } : m
    ));
  };

  const toggleLunch = (key) => {
    setMealOptions(o => ({ arrival_lunch: false, departure_lunch: false, [key]: !o[key] }));
  };

  // Group meals by date
  const byDate = meals.reduce((acc, m) => {
    if (!acc[m.date]) acc[m.date] = [];
    acc[m.date].push(m);
    return acc;
  }, {});

  const sandwichCount = meals.filter(m => m.sandwich_instead).length;
  const regularCount = meals.length - sandwichCount;

  return (
    <div className="space-y-5">
      {/* Stay banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 flex flex-wrap gap-4">
        <div><span className="text-blue-500 text-xs">צ׳ק-אין</span><br /><strong>{arrival_date}</strong></div>
        <div><span className="text-blue-500 text-xs">צ׳ק-אאוט</span><br /><strong>{departure_date}</strong></div>
        <div><span className="text-blue-500 text-xs">לילות</span><br /><strong>{nights}</strong></div>
      </div>

      {/* Lunch toggle */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">ארוחת צהריים נוספת</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: "arrival_lunch",   label: "🍽️ צהריים ביום הגעה" },
            { key: "departure_lunch", label: "🍽️ צהריים ביום עזיבה" },
            { key: "none",            label: "✖️ ללא צהריים נוסף" },
          ].map(({ key, label }) => {
            const isNone = key === "none";
            const active = isNone
              ? (!mealOptions.arrival_lunch && !mealOptions.departure_lunch)
              : mealOptions[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => isNone
                  ? setMealOptions({ arrival_lunch: false, departure_lunch: false })
                  : toggleLunch(key)
                }
                className={`py-2 px-2 rounded-xl border text-xs font-medium transition-all text-center ${
                  active
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-slate-600 border-slate-200 hover:border-primary"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Meal grid */}
      <div className="space-y-3">
        {Object.entries(byDate).map(([date, dayMeals], di) => {
          const isArrival = date === arrival_date;
          const isDeparture = date === departure_date;
          return (
            <div key={date}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold text-slate-500">{hebrewDate(date)}</span>
                {isArrival && <span className="text-[10px] bg-blue-100 text-blue-600 rounded-full px-2 py-0.5">יום הגעה</span>}
                {isDeparture && <span className="text-[10px] bg-purple-100 text-purple-600 rounded-full px-2 py-0.5">יום עזיבה</span>}
              </div>
              <div className="space-y-1.5">
                {dayMeals.map(m => (
                  <div
                    key={`${m.date}_${m.meal_type}`}
                    className={`flex items-center justify-between rounded-xl px-4 py-2.5 border transition-all ${
                      m.sandwich_instead
                        ? "bg-amber-50 border-amber-300"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div>
                      <span className="text-sm font-medium text-slate-700">{MEAL_TYPES[m.meal_type]}</span>
                      {m.sandwich_instead && (
                        <span className="text-xs text-amber-600 mr-2">← סנדוויץ׳</span>
                      )}
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={m.sandwich_instead}
                        onChange={() => toggleSandwich(m.date, m.meal_type)}
                        className="accent-amber-500"
                      />
                      סנדוויץ׳ במקום
                    </label>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {meals.length > 0 && (
        <div className="border-t border-slate-200 pt-3 flex gap-4 text-xs text-slate-500">
          <span>סה״כ: <strong className="text-slate-700">{meals.length}</strong> ארוחות</span>
          <span>רגילות: <strong className="text-slate-700">{regularCount}</strong></span>
          <span>סנדוויץ׳: <strong className="text-amber-600">{sandwichCount}</strong></span>
        </div>
      )}
    </div>
  );
}