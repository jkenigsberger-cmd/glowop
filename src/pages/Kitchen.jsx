import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, subDays, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import { ChevronRight, ChevronLeft, UtensilsCrossed, CalendarDays, FileText, X, Coffee, List, Sandwich } from "lucide-react";
import { PRISA_TYPE_LABELS, PRISA_SLOT_LABELS, PRISA_SLOT_ORDER } from "@/lib/prisaLabels";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import KitchenMealCard from "@/components/kitchen/KitchenMealCard";
import KitchenCoffeeCard from "@/components/kitchen/KitchenCoffeeCard";
import ReviewAlertsBanner from "@/components/alerts/ReviewAlertsBanner";
import KitchenCalendar from "@/components/calendar/KitchenCalendar";
import { isOperationalGroup } from "@/lib/quotePreparationFlow";

const MEAL_ORDER = { BREAKFAST: 0, LUNCH: 1, DINNER: 2, COFFEE_CORNER: 3, OTHER: 4 };
const coffeeTypeLabel = (value) => value === "HOT_WATER_THERMOCAN_ONLY" ? "מיחם וטרמוקן בלבד" : value || "פינת קפה רגילה";

const TODAY = new Date().toISOString().slice(0, 10);

export default function Kitchen() {
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [reportModal, setReportModal] = useState(false);
  const [reportFrom,  setReportFrom]  = useState(TODAY);
  const [reportTo,    setReportTo]    = useState(TODAY);
  const [kitchenTab, setKitchenTab]   = useState("list"); // "list" | "calendar"
  const navigate = useNavigate();

  // Load all active meal reservations
  const { data: allMeals = [], isLoading: loadingMeals } = useQuery({
    queryKey: ["mealReservations_kitchen"],
    queryFn: () => base44.entities.MealReservation.filter({ status: "ACTIVE" }),
  });

  // Load CoffeeCornerRequests separately
  const { data: allCoffeeRequests = [], isLoading: loadingCoffee } = useQuery({
    queryKey: ["coffeeCornerRequests_kitchen"],
    queryFn: () => base44.entities.CoffeeCornerRequest.filter({ status: "ACTIVE" }),
  });

  // Load PrisaRequests separately
  const { data: allPrisaRequests = [], isLoading: loadingPrisa } = useQuery({
    queryKey: ["prisaRequests_kitchen"],
    queryFn: () => base44.entities.PrisaRequest.filter({ status: "ACTIVE" }),
  });

  // Load groups + profiles in parallel
  const { data: groups = [] } = useQuery({
    queryKey: ["groups_kitchen"],
    queryFn: async () => (await base44.entities.Group.list()).filter(isOperationalGroup),
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

  // Meals for selected date — exclude COFFEE_CORNER from legacy MealReservation
  const dayMeals = useMemo(() => {
    return allMeals
      .filter(m => groupMap[m.group_id] && m.date === selectedDate && m.meal_type !== "COFFEE_CORNER")
      .sort((a, b) => {
        const typeCmp = (MEAL_ORDER[a.meal_type] ?? 99) - (MEAL_ORDER[b.meal_type] ?? 99);
        if (typeCmp !== 0) return typeCmp;
        return (a.start_time || "").localeCompare(b.start_time || "");
      });
  }, [allMeals, groupMap, selectedDate]);

  // CoffeeCornerRequests for selected date (new entity)
  const dayCoffeeRequests = useMemo(() => {
    return allCoffeeRequests
      .filter(r => groupMap[r.group_id] && r.date === selectedDate)
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  }, [allCoffeeRequests, groupMap, selectedDate]);

  // Legacy COFFEE_CORNER from MealReservation — only show if a matching active CoffeeCornerRequest exists
  // This prevents ghost records from showing when the CoffeeCornerRequest was cancelled but MealReservation was not
  const dayCoffeeLegacy = useMemo(() => {
    const activeCoffeeKey = new Set(
      allCoffeeRequests
        .filter(r => groupMap[r.group_id] && r.date === selectedDate)
        .map(r => `${r.group_id}|${r.date}`)
    );
    return allMeals
      .filter(m =>
        m.date === selectedDate &&
        m.meal_type === "COFFEE_CORNER" &&
        activeCoffeeKey.has(`${m.group_id}|${m.date}`)
      )
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  }, [allMeals, allCoffeeRequests, groupMap, selectedDate]);

  const dayCoffeeCorners = useMemo(() => [...dayCoffeeRequests, ...dayCoffeeLegacy], [dayCoffeeRequests, dayCoffeeLegacy]);

  // PrisaRequests for selected date
  const dayPrisaRequests = useMemo(() => {
    return allPrisaRequests
      .filter(r => groupMap[r.group_id] && r.date === selectedDate)
      .sort((a, b) => (PRISA_SLOT_ORDER[a.pickup_slot] ?? 99) - (PRISA_SLOT_ORDER[b.pickup_slot] ?? 99));
  }, [allPrisaRequests, groupMap, selectedDate]);

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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">

          {/* Desktop layout */}
          <div className="hidden sm:flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UtensilsCrossed className="w-5 h-5 text-primary" />
              <div>
                <h1 className="text-xl font-bold">מטבח</h1>
                <p className="text-xs text-muted-foreground">ארוחות יומיות לצוות המטבח</p>
              </div>
            </div>
            {kitchenTab === "list" && (
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
            )}
          </div>

          {/* Tab switcher — desktop */}
          <div className="hidden sm:flex mt-3 gap-1 border-b border-slate-200 pb-1">
            <Button size="sm" variant={kitchenTab === "list" ? "default" : "ghost"}
              onClick={() => setKitchenTab("list")} className="gap-1.5 text-xs">
              <List className="w-3.5 h-3.5" /> רשימה יומית
            </Button>
            <Button size="sm" variant={kitchenTab === "calendar" ? "default" : "ghost"}
              onClick={() => setKitchenTab("calendar")} className="gap-1.5 text-xs">
              <CalendarDays className="w-3.5 h-3.5" /> לוח שנה מטבח
            </Button>
          </div>

          {/* Report button + date input — desktop, list tab only */}
          {kitchenTab === "list" && (
            <>
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
              <div className="hidden sm:flex mt-2 justify-end">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="text-xs border border-input rounded-md px-2 py-1 bg-transparent text-slate-600 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </>
          )}

          {/* Mobile layout */}
          <div className="flex sm:hidden flex-col gap-2">
            {/* Mobile tab switcher */}
            <div className="flex gap-1">
              <Button size="sm" variant={kitchenTab === "list" ? "default" : "outline"} onClick={() => setKitchenTab("list")} className="flex-1 text-xs gap-1">
                <List className="w-3.5 h-3.5" /> רשימה יומית
              </Button>
              <Button size="sm" variant={kitchenTab === "calendar" ? "default" : "outline"} onClick={() => setKitchenTab("calendar")} className="flex-1 text-xs gap-1">
                <CalendarDays className="w-3.5 h-3.5" /> לוח שנה
              </Button>
            </div>
            {kitchenTab === "list" && (
              <>
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
              </>
            )}
          </div>

        </div>
      </div>

      {/* Kitchen calendar tab */}
      {kitchenTab === "calendar" && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <KitchenCalendar onDaySelect={(dateStr) => { setKitchenTab("list"); setSelectedDate(dateStr); }} />
        </div>
      )}

      {/* Daily list content */}
      {kitchenTab === "list" && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-8">

          {/* Kitchen review alerts — default to the next 14 days, with a "show all" toggle */}
          <ReviewAlertsBanner module="KITCHEN" dateWindowDays={14} />

          {loadingMeals || loadingCoffee || loadingPrisa ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : dayMeals.length === 0 && dayCoffeeCorners.length === 0 && dayPrisaRequests.length === 0 ? (
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
                {dayCoffeeCorners.length > 0 && (
                  <>
                    <div className="h-8 w-px bg-border" />
                    <div className="text-center">
                      <p className="text-2xl font-bold text-amber-600">{dayCoffeeCorners.length}</p>
                      <p className="text-xs text-amber-600">פינות קפה</p>
                    </div>
                  </>
                )}
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
                        const raw = profileMap[m.group_id]?.special_diets || m.special_diets_summary;
                        const d = raw ? JSON.parse(raw) : null;
                        return s + (Number(d?.lifeThreatening_count) || 0);
                      } catch { return s; }
                    }, 0)}
                  </p>
                  <p className="text-xs text-red-600 font-medium">אלרגיות מסכנות חיים</p>
                </div>
              </div>

              {/* Coffee Corner — separate section (CoffeeCornerRequest + legacy MealReservation COFFEE_CORNER) */}
              {dayCoffeeCorners.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border px-4 py-2.5 bg-amber-100 text-amber-800 border-amber-200">
                    <div className="flex items-center gap-2 font-bold text-base">
                      <Coffee className="w-5 h-5" />
                      פינת קפה
                    </div>
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <span>{dayCoffeeCorners.length} קבוצות</span>
                      <span className="opacity-60">·</span>
                      <span>{dayCoffeeCorners.reduce((s, r) => s + (Number(r.pax) || 0), 0)} אנשים</span>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {dayCoffeeRequests.map(req => (
                      <div key={req.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{groupMap[req.group_id]?.group_name || "קבוצה לא ידועה"}</p>
                            <p className="text-xs text-amber-700 font-medium mt-0.5">{coffeeTypeLabel(req.coffee_corner_type)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-2xl font-bold text-amber-700">{req.pax || "—"}</p>
                            <p className="text-[10px] text-amber-600">אנשים</p>
                          </div>
                        </div>
                        {req.start_time && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <span>🕐</span>
                            <span>{req.start_time}{req.end_time ? ` – ${req.end_time}` : ""}</span>
                          </div>
                        )}
                        {req.location_name_snapshot && (
                          <p className="text-xs text-slate-500">📍 {req.location_name_snapshot}</p>
                        )}
                        {req.notes && (
                          <p className="text-xs text-slate-500 border-t border-amber-100 pt-2">{req.notes}</p>
                        )}
                      </div>
                    ))}
                    {dayCoffeeLegacy.map(meal => (
                      <KitchenCoffeeCard key={meal.id} meal={meal} group={groupMap[meal.group_id]} />
                    ))}
                  </div>
                </section>
              )}

              {/* פריסה — separate section near Coffee Corner */}
              {dayPrisaRequests.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border px-4 py-2.5 bg-orange-100 text-orange-800 border-orange-200">
                    <div className="flex items-center gap-2 font-bold text-base">
                      <Sandwich className="w-5 h-5" />
                      פריסה
                    </div>
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <span>{dayPrisaRequests.length} קבוצות</span>
                      <span className="opacity-60">·</span>
                      <span>{dayPrisaRequests.reduce((s, r) => s + (Number(r.effective_quantity) || 0), 0)} להכנה</span>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {dayPrisaRequests.map(req => (
                      <div key={req.id} className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{groupMap[req.group_id]?.group_name || "קבוצה לא ידועה"}</p>
                            <p className="text-xs text-orange-700 font-medium mt-0.5">{PRISA_SLOT_LABELS[req.pickup_slot] || req.pickup_slot}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-2xl font-bold text-orange-700">{req.effective_quantity}</p>
                            <p className="text-[10px] text-orange-600">להכנה</p>
                          </div>
                        </div>
                        <p className="text-xs text-slate-500">
                          כמות: {req.quantity} · סוג: {PRISA_TYPE_LABELS[req.type] || req.type}
                        </p>
                        {req.notes && (
                          <p className="text-xs text-slate-500 border-t border-orange-100 pt-2">{req.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Meals grouped by type */}
              {Object.entries(mealsByType).map(([mealType, mealsInGroup]) => {
                const MEAL_TYPE_HEB = { BREAKFAST: "ארוחת בוקר", LUNCH: "ארוחת צהריים", DINNER: "ארוחת ערב", SANDWICH: "כריכים", OTHER: "אחר" };
                const MEAL_TYPE_COLORS = {
                  BREAKFAST: "bg-amber-100 text-amber-800 border-amber-200",
                  LUNCH:     "bg-green-100 text-green-800 border-green-200",
                  DINNER:    "bg-blue-100 text-blue-800 border-blue-200",
                  SANDWICH:  "bg-orange-100 text-orange-800 border-orange-200",
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
      )}

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