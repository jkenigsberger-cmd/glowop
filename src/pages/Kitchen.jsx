import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, subDays, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import { ChevronRight, ChevronLeft, UtensilsCrossed, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import KitchenMealCard from "@/components/kitchen/KitchenMealCard";

const MEAL_ORDER = { BREAKFAST: 0, LUNCH: 1, DINNER: 2, OTHER: 3 };

const TODAY = new Date().toISOString().slice(0, 10);

export default function Kitchen() {
  const [selectedDate, setSelectedDate] = useState(TODAY);

  // Load all active meal reservations
  const { data: allMeals = [], isLoading: loadingMeals } = useQuery({
    queryKey: ["mealReservations_kitchen"],
    queryFn: () => base44.entities.MealReservation.filter({ status: "ACTIVE" }),
  });

  // Load groups + profiles in parallel
  const { data: groups = [] } = useQuery({
    queryKey: ["groups_kitchen"],
    queryFn: () => base44.entities.Group.list(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_kitchen"],
    queryFn: () => base44.entities.OperationalGroupProfile.list(),
  });

  // Index for fast lookup
  const groupMap = useMemo(() => {
    const m = {};
    groups.forEach(g => { m[g.id] = g; });
    return m;
  }, [groups]);

  const profileMap = useMemo(() => {
    const m = {};
    profiles.forEach(p => { m[p.group_id] = p; });
    return m;
  }, [profiles]);

  // Meals for selected date, sorted by meal type then time
  const dayMeals = useMemo(() => {
    return allMeals
      .filter(m => m.date === selectedDate)
      .sort((a, b) => {
        const typeCmp = (MEAL_ORDER[a.meal_type] ?? 99) - (MEAL_ORDER[b.meal_type] ?? 99);
        if (typeCmp !== 0) return typeCmp;
        return (a.start_time || "").localeCompare(b.start_time || "");
      });
  }, [allMeals, selectedDate]);

  // Group meals by meal type
  const mealsByType = useMemo(() => {
    const grouped = {};
    dayMeals.forEach(m => {
      const t = m.meal_type || "OTHER";
      if (!grouped[t]) grouped[t] = [];
      grouped[t].push(m);
    });
    return grouped;
  }, [dayMeals]);

  const dateLabel = useMemo(() => {
    try {
      return format(parseISO(selectedDate), "EEEE, d בMMMM yyyy", { locale: he });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const isToday = selectedDate === TODAY;

  const goToPreviousDay = () => {
    setSelectedDate(prev => format(subDays(parseISO(prev), 1), "yyyy-MM-dd"));
  };

  const goToNextDay = () => {
    setSelectedDate(prev => format(addDays(parseISO(prev), 1), "yyyy-MM-dd"));
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UtensilsCrossed className="w-5 h-5 text-primary" />
              <div>
                <h1 className="text-xl font-bold">מטבח</h1>
                <p className="text-xs text-muted-foreground">ארוחות יומיות לצוות המטבח</p>
              </div>
            </div>

            {/* Date navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPreviousDay}
                aria-label="יום קודם"
              >
                <ChevronRight className="w-4 h-4" />
                <span className="text-xs mr-1">יום קודם</span>
              </Button>

              <div className="text-center min-w-[9rem]">
                <p className="text-sm font-semibold">{dateLabel}</p>
                {isToday && (
                  <span className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5">היום</span>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={goToNextDay}
                aria-label="יום הבא"
              >
                <span className="text-xs ml-1">יום הבא</span>
                <ChevronLeft className="w-4 h-4" />
              </Button>

              {!isToday && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate(TODAY)}
                  className="text-xs"
                >
                  היום
                </Button>
              )}
            </div>
          </div>

          {/* Date input for quick jump */}
          <div className="mt-2 flex justify-end">
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-xs border border-input rounded-md px-2 py-1 bg-transparent text-slate-600 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-8">

        {loadingMeals ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : dayMeals.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
            <p className="text-slate-500 font-medium">אין ארוחות מתוכננות ליום זה</p>
            <p className="text-xs text-muted-foreground">בדוק תאריך אחר או הוסף ארוחות דרך דף הקבוצה</p>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="flex items-center gap-4 bg-card border border-border rounded-xl px-4 py-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{dayMeals.length}</p>
                <p className="text-xs text-muted-foreground">ארוחות</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {dayMeals.reduce((s, m) => s + (Number(m.pax) || 0), 0)}
                </p>
                <p className="text-xs text-muted-foreground">סה״כ מנות</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {dayMeals.reduce((s, m) => {
                    try {
                      const d = m.special_diets_summary
                        ? JSON.parse(m.special_diets_summary)
                        : profileMap[m.group_id]?.special_diets
                          ? JSON.parse(profileMap[m.group_id].special_diets)
                          : null;
                      return s + (Number(d?.lifeThreatening_count) || 0);
                    } catch { return s; }
                  }, 0)}
                </p>
                <p className="text-xs text-red-600 font-medium">אלרגיות מסכנות חיים</p>
              </div>
            </div>

            {/* Meals grouped by type */}
            {Object.entries(mealsByType).map(([mealType, meals]) => (
              <section key={mealType}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {meals.map(meal => (
                    <KitchenMealCard
                      key={meal.id}
                      meal={meal}
                      group={groupMap[meal.group_id]}
                      profile={profileMap[meal.group_id]}
                    />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}