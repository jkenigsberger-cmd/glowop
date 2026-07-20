/**
 * KitchenCalendar — read-only monthly kitchen calendar (Sunday-first).
 * Data sources: MealReservation, CoffeeCornerRequest, Group.
 * No records are created or modified.
 */
import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import { ChevronLeft, ChevronRight, X, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { getMonthDatesSunday, HEB_DAYS_SUN } from "@/lib/calendarWeek";
import { isOperationalGroup } from "@/lib/quotePreparationFlow";

const fmt = (d) => moment(d).format("YYYY-MM-DD");
const isSameDay = (a, b) => fmt(a) === fmt(b);

const MEAL_TYPE_HEB = {
  BREAKFAST: "בוקר",
  LUNCH:     "צהריים",
  DINNER:    "ערב",
  SANDWICH:  "כריכים",
  OTHER:     "אחר",
};

const MEAL_TYPE_COLORS = {
  BREAKFAST: "text-amber-700",
  LUNCH:     "text-green-700",
  DINNER:    "text-blue-700",
  OTHER:     "text-slate-600",
};

// ── Day Detail Modal ──────────────────────────────────────────────────────────

function KitchenDayModal({ dateStr, meals, coffeeRequests, groupMap, onClose, onNavigate }) {
  const dayLabel = moment(dateStr).format("dddd, D בMMMM YYYY");
  const dayMeals = useMemo(() =>
    meals.filter(m => m.date === dateStr && m.meal_type !== "COFFEE_CORNER")
         .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")),
    [meals, dateStr]
  );
  const dayCoffee = useMemo(() =>
    coffeeRequests.filter(r => r.date === dateStr)
                  .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")),
    [coffeeRequests, dateStr]
  );

  const totalPax = dayMeals.reduce((s, m) => s + (Number(m.pax) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">סיכום מטבח — {dayLabel}</h2>
            {(dayMeals.length > 0 || dayCoffee.length > 0) && (
              <p className="text-xs text-slate-500 mt-0.5">
                {dayMeals.length} ארוחות · {totalPax} מנות{dayCoffee.length > 0 ? ` · ${dayCoffee.length} פינות קפה` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onNavigate(dateStr)} className="text-xs">
              פתח במטבח
            </Button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {dayMeals.length === 0 && dayCoffee.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">אין ארוחות ביום זה</p>
        )}

        {/* Meals */}
        {dayMeals.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">ארוחות</p>
            {dayMeals.map((m) => {
              const group = groupMap[m.group_id];
              let lifeThreat = 0;
              try {
                const d = m.special_diets_summary ? JSON.parse(m.special_diets_summary) : null;
                lifeThreat = Number(d?.lifeThreatening_count) || 0;
              } catch {}
              return (
                <div key={m.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("text-xs font-bold", MEAL_TYPE_COLORS[m.meal_type] || "text-slate-600")}>
                      {MEAL_TYPE_HEB[m.meal_type] || m.meal_type}
                    </span>
                    <span className="text-sm font-bold text-slate-700">{m.pax || "—"} 👤</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{group?.group_name || "—"}</p>
                  {m.start_time && (
                    <p className="text-xs text-slate-500">🕐 {m.start_time}{m.end_time ? ` – ${m.end_time}` : ""}</p>
                  )}
                  {m.sandwich_option && <p className="text-xs text-orange-600 font-medium">🥪 כריכים</p>}
                  {lifeThreat > 0 && (
                    <p className="text-xs text-red-600 font-bold">⚠️ {lifeThreat} אלרגיות מסכנות חיים</p>
                  )}
                  {m.notes && <p className="text-xs text-slate-500 border-t border-slate-200 pt-1">{m.notes}</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* Coffee */}
        {dayCoffee.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-600">פינת קפה</p>
            {dayCoffee.map((r) => (
              <div key={r.id} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-amber-700">{r.coffee_corner_type || "פינת קפה"}</span>
                  <span className="text-sm font-bold text-amber-800">{r.pax || "—"} 👤</span>
                </div>
                <p className="text-sm font-semibold text-slate-800">{groupMap[r.group_id]?.group_name || "—"}</p>
                {r.start_time && (
                  <p className="text-xs text-slate-500">🕐 {r.start_time}{r.end_time ? ` – ${r.end_time}` : ""}</p>
                )}
                {r.location_name_snapshot && <p className="text-xs text-slate-500">📍 {r.location_name_snapshot}</p>}
                {r.notes && <p className="text-xs text-slate-500 border-t border-amber-100 pt-1">{r.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Month Grid Cell ────────────────────────────────────────────────────────────

function KitchenDayCell({ date, meals, coffeeRequests, isCurrentMonth, onClick }) {
  const dateStr = fmt(date);
  const isToday = isSameDay(date, moment());

  const dayMeals = useMemo(() =>
    meals.filter(m => m.date === dateStr && m.meal_type !== "COFFEE_CORNER"),
    [meals, dateStr]
  );
  const dayCoffee = useMemo(() =>
    coffeeRequests.filter(r => r.date === dateStr),
    [coffeeRequests, dateStr]
  );

  const totalPax = dayMeals.reduce((s, m) => s + (Number(m.pax) || 0), 0);

  const byType = useMemo(() => {
    const m = {};
    dayMeals.forEach((meal) => {
      const t = meal.meal_type;
      m[t] = (m[t] || 0) + (Number(meal.pax) || 0);
    });
    return m;
  }, [dayMeals]);

  const hasContent = dayMeals.length > 0 || dayCoffee.length > 0;

  return (
    <div
      className={cn(
        "min-h-[90px] p-1.5 flex flex-col gap-0.5 border-b border-r border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors",
        isCurrentMonth ? "bg-white" : "bg-slate-50/60"
      )}
      onClick={() => hasContent && onClick(dateStr)}
    >
      <span className={cn(
        "text-[11px] font-semibold self-end leading-none mb-0.5",
        isToday
          ? "bg-primary text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
          : isCurrentMonth ? "text-slate-600" : "text-slate-300"
      )}>
        {date.format("D")}
      </span>

      {hasContent && (
        <div className="space-y-0.5 text-[10px] leading-snug">
          {dayMeals.length > 0 && (
            <div className="bg-slate-100 rounded px-1 py-0.5 text-slate-600 font-medium">
              🍽 {dayMeals.length} ארוחות · {totalPax}👤
            </div>
          )}
          {byType.BREAKFAST > 0 && (
            <div className="text-amber-700">בוקר {byType.BREAKFAST}</div>
          )}
          {byType.LUNCH > 0 && (
            <div className="text-green-700">צהריים {byType.LUNCH}</div>
          )}
          {byType.DINNER > 0 && (
            <div className="text-blue-700">ערב {byType.DINNER}</div>
          )}
          {dayCoffee.length > 0 && (
            <div className="text-amber-600">☕ {dayCoffee.length} קפה</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function KitchenCalendar({ onDaySelect }) {
  const [pivot, setPivot] = useState(moment());
  const [modalDate, setModalDate] = useState(null);
  const navigate = useNavigate();

  const { data: meals = [] } = useQuery({
    queryKey: ["kc-meals"],
    queryFn: () => base44.entities.MealReservation.filter({ status: "ACTIVE" }),
  });
  const { data: coffeeRequests = [] } = useQuery({
    queryKey: ["kc-coffee"],
    queryFn: () => base44.entities.CoffeeCornerRequest.filter({ status: "ACTIVE" }),
  });
  const { data: groups = [] } = useQuery({
    queryKey: ["kc-groups"],
    queryFn: async () => (await base44.entities.Group.list("-arrival_date", 300)).filter(isOperationalGroup),
  });

  const groupMap = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g])), [groups]);
  const operationalMeals = useMemo(() => meals.filter(m => groupMap[m.group_id]), [meals, groupMap]);
  const operationalCoffee = useMemo(() => coffeeRequests.filter(r => groupMap[r.group_id]), [coffeeRequests, groupMap]);
  const dates = useMemo(() => getMonthDatesSunday(pivot), [pivot]);
  const currentMonth = pivot.month();

  const go = (dir) => setPivot((p) => p.clone().add(dir, "month"));

  const handleNavigate = (dateStr) => {
    setModalDate(null);
    if (onDaySelect) {
      onDaySelect(dateStr);
    } else {
      navigate(`/kitchen`);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => go(-1)}><ChevronRight className="w-4 h-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setPivot(moment())} className="px-3">היום</Button>
          <Button size="sm" variant="outline" onClick={() => go(1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-base font-bold text-slate-700 mr-2">{pivot.format("MMMM YYYY")}</span>
        </div>
        <div className="flex gap-3 text-[11px] text-slate-600">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" />ארוחת בוקר</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-500 inline-block" />צהריים</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" />ערב</span>
          <span className="flex items-center gap-1">☕ פינת קפה</span>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {HEB_DAYS_SUN.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-slate-500 py-2.5 border-r border-slate-100 last:border-r-0">
              {d}
            </div>
          ))}
        </div>
        {Array.from({ length: dates.length / 7 }, (_, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {dates.slice(wi * 7, wi * 7 + 7).map((date) => (
              <KitchenDayCell
                key={date.toISOString()}
                date={date}
                meals={operationalMeals}
                coffeeRequests={operationalCoffee}
                isCurrentMonth={date.month() === currentMonth}
                onClick={setModalDate}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Note */}
      <p className="text-[11px] text-slate-400 text-center">לחיצה על יום עם ארוחות פותחת סיכום יומי</p>

      {modalDate && (
        <KitchenDayModal
          dateStr={modalDate}
          meals={operationalMeals}
          coffeeRequests={operationalCoffee}
          groupMap={groupMap}
          onClose={() => setModalDate(null)}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}