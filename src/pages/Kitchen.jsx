import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, subDays, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import { ChevronRight, ChevronLeft, UtensilsCrossed, CalendarDays, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import KitchenMealCard from "@/components/kitchen/KitchenMealCard";
import ReviewAlertsBanner from "@/components/alerts/ReviewAlertsBanner";

const MEAL_ORDER = { BREAKFAST: 0, LUNCH: 1, DINNER: 2, OTHER: 3 };

const TODAY = new Date().toISOString().slice(0, 10);

export default function Kitchen() {
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [reportModal, setReportModal] = useState(false);
  const [reportFrom,  setReportFrom]  = useState(TODAY);
  const [reportTo,    setReportTo]    = useState(TODAY);
  const navigate = useNavigate();

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
      <div className="border-b border-border bg-card sticky top-12 sm:top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">

          {/* Desktop layout */}
          <div className="hidden sm:flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UtensilsCrossed className="w-5 h-5 text-primary" />
              <div>
                <h1 className="text-xl font-bold">מטבח</h1>
                <p className="text-xs text-muted-foreground">ארוחות יומיות לצוות המטבח</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={goToPreviousDay}>
                <ChevronRight className="w-4 h-4" />
                <span className="text-xs mr-1">יום קודם</span>
              </Button>
              <div className="text-center min-w-[9rem]">
                <p className="text-sm font-semibold">{dateLabel}</p>
                {isToday && <span className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5">היום</span>}
              </div>
              <Button variant="ghost" size="sm" onClick={goToNextDay}>
                <span className="text-xs ml-1">יום הבא</span>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {!isToday && (
                <Button variant="outline" size="sm" onClick={() => setSelectedDate(TODAY)} className="text-xs">היום</Button>
              )}
            </div>
          </div>

          {/* Report button — desktop */}
          <div className="hidden sm:flex mt-2 justify-between items-center">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs border-green-300 text-green-700 hover:bg-green-50"
              onClick={() => { setReportFrom(selectedDate); setReportTo(selectedDate); setReportModal(true); }}
            >
              <FileText className="w-3.5 h-3.5" />
              הפק דוח מטבח
            </Button>
          </div>

          {/* Desktop: date input */}
          <div className="hidden sm:flex mt-2 justify-end">
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-xs border border-input rounded-md px-2 py-1 bg-transparent text-slate-600 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Mobile layout */}
          <div className="flex sm:hidden flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{dateLabel}</p>
                {isToday && <span className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5">היום</span>}
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="text-sm border border-input rounded-md px-2 py-1 bg-transparent text-slate-600 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="flex-1 h-10 text-sm gap-1" onClick={goToPreviousDay}>
                <ChevronRight className="w-4 h-4" /> יום קודם
              </Button>
              {!isToday && (
                <Button variant="outline" size="sm" className="h-10 px-4 text-sm font-semibold"
                  onClick={() => setSelectedDate(TODAY)}>היום</Button>
              )}
              <Button variant="outline" size="sm" className="flex-1 h-10 text-sm gap-1" onClick={goToNextDay}>
                יום הבא <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5 text-sm border-green-300 text-green-700 hover:bg-green-50"
              onClick={() => { setReportFrom(selectedDate); setReportTo(selectedDate); setReportModal(true); }}
            >
              <FileText className="w-4 h-4" />
              הפק דוח מטבח
            </Button>
          </div>

        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-8">

        {/* Kitchen review alerts */}
        <ReviewAlertsBanner module="KITCHEN" />

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
                      // Prefer current profile diet over stale meal snapshot
                      const raw = profileMap[m.group_id]?.special_diets || m.special_diets_summary;
                      const d = raw ? JSON.parse(raw) : null;
                      return s + (Number(d?.lifeThreatening_count) || 0);
                    } catch { return s; }
                  }, 0)}
                </p>
                <p className="text-xs text-red-600 font-medium">אלרגיות מסכנות חיים</p>
              </div>
            </div>

            {/* Meals grouped by type */}
            {Object.entries(mealsByType).map(([mealType, mealsInGroup]) => {
              const MEAL_TYPE_HEB = { BREAKFAST: "ארוחת בוקר", LUNCH: "ארוחת צהריים", DINNER: "ארוחת ערב", OTHER: "אחר" };
              const MEAL_TYPE_COLORS = {
                BREAKFAST: "bg-amber-100 text-amber-800 border-amber-200",
                LUNCH:     "bg-green-100 text-green-800 border-green-200",
                DINNER:    "bg-blue-100 text-blue-800 border-blue-200",
                OTHER:     "bg-slate-100 text-slate-700 border-slate-200",
              };
              const totalPaxForType = mealsInGroup.reduce((s, m) => s + (Number(m.pax) || 0), 0);
              return (
                <section key={mealType} className="space-y-3">
                  <div className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${MEAL_TYPE_COLORS[mealType] || MEAL_TYPE_COLORS.OTHER}`}>
                    <h2 className="font-bold text-base">{MEAL_TYPE_HEB[mealType] || mealType}</h2>
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <span>{mealsInGroup.length} קבוצות</span>
                      <span className="opacity-60">·</span>
                      <span>{totalPaxForType} מנות</span>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {mealsInGroup.map(meal => (
                      <KitchenMealCard
                        key={meal.id}
                        meal={meal}
                        group={groupMap[meal.group_id]}
                        profile={profileMap[meal.group_id]}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>

      {/* Kitchen Report modal */}
      {reportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-700" />
                הפקת דוח מטבח
              </h2>
              <button onClick={() => setReportModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">מתאריך</label>
                <input
                  type="date"
                  value={reportFrom}
                  onChange={e => setReportFrom(e.target.value)}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">עד תאריך</label>
                <input
                  type="date"
                  value={reportTo}
                  min={reportFrom}
                  onChange={e => setReportTo(e.target.value)}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setReportModal(false)}>
                ביטול
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-green-700 hover:bg-green-800 gap-1.5"
                disabled={!reportFrom || !reportTo || reportTo < reportFrom}
                onClick={() => {
                  setReportModal(false);
                  navigate(`/kitchen-report?from=${reportFrom}&to=${reportTo}`);
                }}
              >
                <FileText className="w-4 h-4" />
                הפק דוח
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}