import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import "moment/locale/he";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import CalendarEventModal from "../components/calendar/CalendarEventModal.jsx";

moment.locale("he");

// ─── Date helpers ─────────────────────────────────────────────────────────────
const fmt = (d) => moment(d).format("YYYY-MM-DD");
const isSameDay = (a, b) => fmt(a) === fmt(b);

function getWeekDates(pivot) {
  const start = moment(pivot).startOf("isoWeek");
  return Array.from({ length: 7 }, (_, i) => start.clone().add(i, "days"));
}

function getMonthDates(pivot) {
  const start = moment(pivot).startOf("month").startOf("isoWeek");
  const end   = moment(pivot).endOf("month").endOf("isoWeek");
  const days  = [];
  let cur = start.clone();
  while (cur.isSameOrBefore(end, "day")) {
    days.push(cur.clone());
    cur.add(1, "day");
  }
  return days;
}

// ─── Event builders ───────────────────────────────────────────────────────────
const EXCLUDED_STATUSES = new Set(["CANCELLED", "COMPLETED", "ARCHIVED"]);

function buildGroupEvents(groups) {
  const events = [];
  groups.forEach((g) => {
    if (EXCLUDED_STATUSES.has(g.status)) return;
    if (!g.arrival_date || !g.departure_date) return;
    const arr = moment(g.arrival_date);
    const dep = moment(g.departure_date);
    events.push({
      id: `ci-${g.id}`, eventType: "groupStayCheckIn", date: fmt(arr),
      groupId: g.id, groupName: g.group_name, pax: g.total_pax,
      label: `✓ ${g.group_name}`, chipCls: "bg-emerald-500 text-white",
    });
    let cur = arr.clone().add(1, "day");
    while (cur.isBefore(dep, "day")) {
      events.push({
        id: `sl-${g.id}-${fmt(cur)}`, eventType: "groupStaySleeping", date: fmt(cur),
        groupId: g.id, groupName: g.group_name, pax: g.total_pax,
        label: `🌙 ${g.group_name}`, chipCls: "bg-blue-500 text-white",
      });
      cur.add(1, "day");
    }
    if (dep.isAfter(arr, "day")) {
      events.push({
        id: `co-${g.id}`, eventType: "groupStayCheckOut", date: fmt(dep),
        groupId: g.id, groupName: g.group_name, pax: g.total_pax,
        label: `↑ ${g.group_name}`, chipCls: "bg-orange-500 text-white",
      });
    }
  });
  return events;
}

function buildMealEvents(meals, groupById) {
  return meals.filter((m) => m.status === "ACTIVE").map((m) => {
    const g = groupById[m.group_id];
    return {
      id: `meal-${m.id}`, eventType: "meal", date: fmt(moment(m.date)),
      groupId: m.group_id, groupName: g?.group_name || "—", pax: m.pax,
      mealType: m.meal_type, timeRange: m.start_time && m.end_time ? `${m.start_time}–${m.end_time}` : null,
      sandwichOption: m.sandwich_option, specialDietsSummary: m.special_diets_summary,
      label: `🍽 ${m.meal_type} · ${g?.group_name || ""}`, chipCls: "bg-amber-400 text-white",
    };
  });
}

function buildActivityEvents(items, groupById, spaceById) {
  return items.filter((i) => i.status === "ACTIVE" && i.activity_space_id).map((i) => {
    const g = groupById[i.group_id];
    const s = spaceById[i.activity_space_id];
    return {
      id: `act-${i.id}`, eventType: "activity", date: fmt(moment(i.date)),
      groupId: i.group_id, groupName: g?.group_name || "—", pax: i.pax,
      activityName: i.activity_name, spaceName: s?.name || s?.code || "—",
      timeRange: i.start_time && i.end_time ? `${i.start_time}–${i.end_time}` : null,
      notes: i.notes, label: `🏃 ${i.activity_name}`, chipCls: "bg-purple-500 text-white",
    };
  });
}

function buildHoldEvents(holds, groupById) {
  const events = [];
  holds.filter((h) => h.status === "ACTIVE").forEach((h) => {
    if (!h.arrival_date) return;
    const arr = moment(h.arrival_date);
    const dep = h.departure_date ? moment(h.departure_date) : arr.clone();
    const g = groupById[h.group_id];
    let cur = arr.clone();
    while (cur.isSameOrBefore(dep, "day")) {
      events.push({
        id: `hold-${h.id}-${fmt(cur)}`, eventType: "operationalHold", date: fmt(cur),
        groupId: h.group_id, groupName: g?.group_name || "—", pax: h.total_pax,
        label: `⟳ ${g?.group_name || "Hold"}`, chipCls: "bg-slate-300 text-slate-700 border border-dashed border-slate-500",
      });
      cur.add(1, "day");
    }
  });
  return events;
}

// ─── Legend ───────────────────────────────────────────────────────────────────
const LEGEND_ITEMS = [
  { cls: "bg-emerald-500", label: "צ׳ק-אין" },
  { cls: "bg-blue-500",    label: "לינה" },
  { cls: "bg-orange-500",  label: "צ׳ק-אאוט" },
  { cls: "bg-amber-400",   label: "ארוחה" },
  { cls: "bg-purple-500",  label: "פעילות" },
  { cls: "bg-slate-300 border border-dashed border-slate-400", label: "Hold" },
];

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600 bg-white border border-slate-100 rounded-lg px-4 py-2.5">
      {LEGEND_ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span className={cn("inline-block w-3 h-3 rounded shrink-0", item.cls)} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MONTH VIEW — compact grid
// ═══════════════════════════════════════════════════════════════════════════════

function MonthEventChip({ event, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className={cn(
        "w-full text-right text-[10px] leading-tight rounded px-1 py-0.5 truncate font-medium hover:opacity-80 transition-opacity",
        event.chipCls
      )}
      title={event.label}
    >
      {event.label}
    </button>
  );
}

function MonthDayCell({ date, events, onClick, isCurrentMonth }) {
  const isToday = isSameDay(date, moment());
  const dayEvents = events.filter((e) => e.date === fmt(date));
  const visible = dayEvents.slice(0, 3);
  const overflow = dayEvents.length - 3;

  return (
    <div className={cn(
      "min-h-[88px] p-1 flex flex-col gap-0.5 border-b border-r border-slate-100",
      isCurrentMonth ? "bg-white" : "bg-slate-50/60",
    )}>
      <span className={cn(
        "text-[11px] font-semibold self-end leading-none mb-0.5",
        isToday
          ? "bg-primary text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
          : isCurrentMonth ? "text-slate-600" : "text-slate-300"
      )}>
        {date.format("D")}
      </span>
      <div className="flex flex-col gap-0.5 overflow-hidden">
        {visible.map((ev) => (
          <MonthEventChip key={ev.id} event={ev} onClick={onClick} />
        ))}
        {overflow > 0 && (
          <span className="text-[10px] text-slate-400 px-1 font-medium">+{overflow} עוד</span>
        )}
      </div>
    </div>
  );
}

const HEB_DAYS = ["שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת", "ראשון"];

function MonthView({ dates, allEvents, pivot, onClick }) {
  const currentMonth = pivot.month();
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
        {HEB_DAYS.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-slate-500 py-2.5 border-r border-slate-100 last:border-r-0">
            {d}
          </div>
        ))}
      </div>
      {Array.from({ length: dates.length / 7 }, (_, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {dates.slice(wi * 7, wi * 7 + 7).map((date) => (
            <MonthDayCell
              key={date.toISOString()}
              date={date}
              events={allEvents}
              onClick={onClick}
              isCurrentMonth={date.month() === currentMonth}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEK VIEW — spacious operational board
// ═══════════════════════════════════════════════════════════════════════════════

const EVENT_TYPE_CONFIG = {
  groupStayCheckIn:  { label: "צ׳ק-אין",   bg: "bg-emerald-50", border: "border-emerald-300", dot: "bg-emerald-500", text: "text-emerald-800", badge: "bg-emerald-500 text-white", emoji: "✓" },
  groupStaySleeping: { label: "לינה",       bg: "bg-blue-50",    border: "border-blue-300",    dot: "bg-blue-500",    text: "text-blue-800",    badge: "bg-blue-500 text-white",    emoji: "🌙" },
  groupStayCheckOut: { label: "צ׳ק-אאוט",  bg: "bg-orange-50",  border: "border-orange-300",  dot: "bg-orange-500",  text: "text-orange-800",  badge: "bg-orange-500 text-white",  emoji: "↑" },
  meal:              { label: "ארוחה",      bg: "bg-amber-50",   border: "border-amber-300",   dot: "bg-amber-400",   text: "text-amber-800",   badge: "bg-amber-400 text-white",   emoji: "🍽" },
  activity:          { label: "פעילות",     bg: "bg-purple-50",  border: "border-purple-300",  dot: "bg-purple-500",  text: "text-purple-800",  badge: "bg-purple-500 text-white",  emoji: "🏃" },
  operationalHold:   { label: "Hold",       bg: "bg-slate-50",   border: "border-slate-300 border-dashed", dot: "bg-slate-400", text: "text-slate-600", badge: "bg-slate-200 text-slate-700", emoji: "⟳" },
};

const MEAL_TYPE_HEB = { BREAKFAST: "בוקר", LUNCH: "צהריים", DINNER: "ערב", OTHER: "אחר" };

const GROUP_ORDER = ["groupStayCheckIn", "groupStaySleeping", "groupStayCheckOut", "meal", "activity", "operationalHold"];

function WeekEventCard({ event, onClick }) {
  const cfg = EVENT_TYPE_CONFIG[event.eventType] || EVENT_TYPE_CONFIG.meal;
  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className={cn(
        "w-full text-right rounded-lg border px-3 py-2 flex flex-col gap-1 hover:shadow-md transition-all cursor-pointer",
        cfg.bg, cfg.border
      )}
    >
      {/* Top row: badge + group name */}
      <div className="flex items-start justify-between gap-1">
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0", cfg.badge)}>
          {cfg.emoji} {cfg.label}
        </span>
        {event.pax && (
          <span className="text-[10px] text-slate-400 font-medium shrink-0">{event.pax} 👤</span>
        )}
      </div>
      {/* Group name */}
      <span className={cn("text-sm font-semibold leading-tight text-right", cfg.text)}>
        {event.groupName}
      </span>
      {/* Sub-details */}
      <div className="flex flex-wrap gap-1 items-center">
        {event.timeRange && (
          <span className="text-[10px] text-slate-500 bg-white border border-slate-200 rounded px-1.5 py-0.5">
            {event.timeRange}
          </span>
        )}
        {event.mealType && (
          <span className="text-[10px] text-amber-700 font-medium">
            {MEAL_TYPE_HEB[event.mealType] || event.mealType}
          </span>
        )}
        {event.activityName && (
          <span className="text-[10px] text-purple-700 font-medium truncate max-w-[120px]">
            {event.activityName}
          </span>
        )}
        {event.spaceName && (
          <span className="text-[10px] text-slate-400">📍 {event.spaceName}</span>
        )}
      </div>
    </button>
  );
}

function WeekDayColumn({ date, events, onClick }) {
  const isToday = isSameDay(date, moment());
  const dayEvents = events.filter((e) => e.date === fmt(date));

  // Group by event type in specified order
  const grouped = GROUP_ORDER.reduce((acc, type) => {
    const group = dayEvents.filter((e) => e.eventType === type);
    if (group.length > 0) acc.push({ type, events: group });
    return acc;
  }, []);

  const totalCount = dayEvents.length;

  return (
    <div className={cn(
      "flex flex-col min-h-[500px] border-r border-slate-200 last:border-r-0",
      isToday ? "bg-blue-50/30" : "bg-white"
    )}>
      {/* Day header */}
      <div className={cn(
        "px-3 py-3 border-b text-center sticky top-0 z-10",
        isToday ? "bg-primary text-primary-foreground border-primary/30" : "bg-slate-50 border-slate-200 text-slate-600"
      )}>
        <div className={cn("text-xs font-semibold uppercase tracking-wide", isToday ? "text-primary-foreground/80" : "text-slate-400")}>
          {date.format("dddd")}
        </div>
        <div className={cn("text-2xl font-bold leading-tight mt-0.5", isToday ? "text-white" : "text-slate-800")}>
          {date.format("D")}
        </div>
        <div className={cn("text-[10px] mt-0.5", isToday ? "text-primary-foreground/70" : "text-slate-400")}>
          {date.format("MMM")}
        </div>
        {totalCount > 0 && (
          <div className={cn(
            "text-[10px] font-semibold mt-1.5 rounded-full px-2 py-0.5 inline-block",
            isToday ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
          )}>
            {totalCount} אירועים
          </div>
        )}
      </div>

      {/* Events */}
      <div className="flex-1 p-2 space-y-3 overflow-y-auto">
        {grouped.length === 0 && (
          <div className="flex items-center justify-center h-24 text-slate-300 text-xs">
            —
          </div>
        )}
        {grouped.map(({ type, events: group }) => {
          const cfg = EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.meal;
          return (
            <div key={type} className="space-y-1.5">
              {/* Group label */}
              <div className="flex items-center gap-1.5 px-1">
                <span className={cn("w-2 h-2 rounded-full shrink-0", cfg.dot)} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{cfg.label}</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              {/* Cards */}
              {group.map((ev) => (
                <WeekEventCard key={ev.id} event={ev} onClick={onClick} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ dates, allEvents, onClick }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="grid grid-cols-7">
        {dates.map((date) => (
          <WeekDayColumn
            key={date.toISOString()}
            date={date}
            events={allEvents}
            onClick={onClick}
          />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENDA VIEW — mobile-friendly single-day list
// ═══════════════════════════════════════════════════════════════════════════════

function AgendaEventRow({ event, onClick }) {
  const cfg = EVENT_TYPE_CONFIG[event.eventType] || EVENT_TYPE_CONFIG.meal;
  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className={cn(
        "w-full text-right rounded-xl border px-4 py-3 flex flex-col gap-1.5 hover:shadow-md transition-all",
        cfg.bg, cfg.border
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full shrink-0", cfg.badge)}>
          {cfg.emoji} {cfg.label}
        </span>
        {event.pax > 0 && (
          <span className="text-xs text-slate-500 font-medium">{event.pax} 👤</span>
        )}
      </div>
      <span className={cn("text-base font-bold leading-tight", cfg.text)}>{event.groupName}</span>
      <div className="flex flex-wrap gap-1.5 items-center">
        {event.timeRange && (
          <span className="text-xs text-slate-600 bg-white border border-slate-200 rounded px-2 py-0.5 font-medium" dir="ltr">
            {event.timeRange}
          </span>
        )}
        {event.mealType && (
          <span className="text-xs text-amber-700 font-medium">{MEAL_TYPE_HEB[event.mealType] || event.mealType}</span>
        )}
        {event.activityName && (
          <span className="text-xs text-purple-700 font-medium">{event.activityName}</span>
        )}
        {event.spaceName && (
          <span className="text-xs text-slate-400">📍 {event.spaceName}</span>
        )}
      </div>
    </button>
  );
}

function AgendaView({ pivot, allEvents, onClick, onPrev, onNext, onToday }) {
  const dateStr = fmt(pivot);
  const dayEvents = allEvents.filter(e => e.date === dateStr);

  const grouped = GROUP_ORDER.reduce((acc, type) => {
    const grp = dayEvents.filter(e => e.eventType === type);
    if (grp.length > 0) acc.push({ type, events: grp });
    return acc;
  }, []);

  const isToday = isSameDay(pivot, moment());
  const dayLabel = pivot.format("dddd, D בMMMM YYYY");

  return (
    <div className="space-y-4">
      {/* Day nav */}
      <div className="flex items-center gap-2">
        <button onClick={onPrev} className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50">
          <ChevronRight className="w-4 h-4" /> יום קודם
        </button>
        <button onClick={onToday} className={cn(
          "h-11 px-4 rounded-xl border text-sm font-bold transition-colors",
          isToday ? "bg-primary text-white border-primary" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
        )}>
          היום
        </button>
        <button onClick={onNext} className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50">
          יום הבא <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Date label */}
      <div className={cn(
        "text-center py-3 rounded-xl font-bold text-base",
        isToday ? "bg-primary/10 text-primary" : "bg-slate-50 text-slate-700"
      )}>
        {dayLabel}
        {isToday && <span className="mr-2 text-sm font-normal">— היום</span>}
      </div>

      {/* Events */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">אין אירועים ביום זה</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ type, events: grp }) => {
            const cfg = EVENT_TYPE_CONFIG[type] || EVENT_TYPE_CONFIG.meal;
            return (
              <div key={type} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", cfg.dot)} />
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{cfg.label}</span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>
                {grp.map(ev => (
                  <AgendaEventRow key={ev.id} event={ev} onClick={onClick} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════

export default function Calendar() {
  const [pivot, setPivot]       = useState(moment());
  const [view, setView]         = useState("week");
  const [selected, setSelected] = useState(null);

  const { data: groups = [] } = useQuery({
    queryKey: ["cal-groups"],
    queryFn: () => base44.entities.Group.list("-arrival_date", 500),
  });
  const { data: meals = [] } = useQuery({
    queryKey: ["cal-meals"],
    queryFn: () => base44.entities.MealReservation.filter({ status: "ACTIVE" }),
  });
  const { data: scheduleItems = [] } = useQuery({
    queryKey: ["cal-schedule"],
    queryFn: () => base44.entities.GroupScheduleItem.filter({ status: "ACTIVE" }),
  });
  const { data: activitySpaces = [] } = useQuery({
    queryKey: ["cal-spaces"],
    queryFn: () => base44.entities.ActivitySpace.list(),
  });
  const { data: holds = [] } = useQuery({
    queryKey: ["cal-holds"],
    queryFn: () => base44.entities.OperationalHold.filter({ status: "ACTIVE" }),
  });

  const groupById = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g])), [groups]);
  const spaceById = useMemo(() => Object.fromEntries(activitySpaces.map((s) => [s.id, s])), [activitySpaces]);

  const allEvents = useMemo(() => [
    ...buildGroupEvents(groups),
    ...buildMealEvents(meals, groupById),
    ...buildActivityEvents(scheduleItems, groupById, spaceById),
    ...buildHoldEvents(holds, groupById),
  ], [groups, meals, scheduleItems, activitySpaces, holds, groupById, spaceById]);

  const dates = useMemo(
    () => view === "week" ? getWeekDates(pivot) : getMonthDates(pivot),
    [pivot, view]
  );

  const go = (dir) => setPivot((p) => p.clone().add(dir, view === "week" ? "week" : "month"));
  const goAgendaDay = (dir) => setPivot((p) => p.clone().add(dir, "day"));
  const goToday = () => setPivot(moment());

  const titleStr = view === "week"
    ? `${dates[0].format("D MMM")} – ${dates[6].format("D MMM YYYY")}`
    : pivot.format("MMMM YYYY");

  return (
    <div className="min-h-screen bg-background" dir="rtl">

      {/* ── MOBILE layout ────────────────────────────────────────────── */}
      <div className="sm:hidden px-4 py-4 space-y-4">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            לוח שנה תפעולי
          </h1>
        </div>
        <Legend />
        <AgendaView
          pivot={pivot}
          allEvents={allEvents}
          onClick={setSelected}
          onPrev={() => goAgendaDay(-1)}
          onNext={() => goAgendaDay(1)}
          onToday={goToday}
        />
      </div>

      {/* ── DESKTOP layout ───────────────────────────────────────────── */}
      <div className="hidden sm:block max-w-[1400px] mx-auto px-3 sm:px-6 py-6 space-y-4">

        {/* Page header */}
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            לוח שנה תפעולי
          </h1>
          <p className="text-sm text-muted-foreground">צפייה בלבד — עריכה ב-GroupDetail / שיבוץ / לוח ארוחות</p>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => go(-1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={goToday} className="px-3">
              היום
            </Button>
            <Button size="sm" variant="outline" onClick={() => go(1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-base font-bold text-slate-700 mr-2">{titleStr}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant={view === "week" ? "default" : "outline"} onClick={() => setView("week")}>
              שבוע
            </Button>
            <Button size="sm" variant={view === "month" ? "default" : "outline"} onClick={() => setView("month")}>
              חודש
            </Button>
          </div>
        </div>

        {/* Legend */}
        <Legend />

        {/* Calendar body */}
        {view === "week" ? (
          <WeekView dates={dates} allEvents={allEvents} onClick={setSelected} />
        ) : (
          <MonthView dates={dates} allEvents={allEvents} pivot={pivot} onClick={setSelected} />
        )}

      </div>

      <CalendarEventModal
        event={selected}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}