import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import "moment/locale/he";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import CalendarEventModal from "@/components/calendar/CalendarEventModal.jsx";

moment.locale("he");

// ─── Date helpers ─────────────────────────────────────────────────────────────

const fmt = (d) => moment(d).format("YYYY-MM-DD");
const isSameDay = (a, b) => fmt(a) === fmt(b);

function getWeekDates(pivot) {
  const start = moment(pivot).startOf("isoWeek"); // Monday
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

function buildGroupEvents(groups) {
  const events = [];
  groups.forEach((g) => {
    if (!g.arrival_date || !g.departure_date) return;
    const arr = moment(g.arrival_date);
    const dep = moment(g.departure_date);

    // Check-in
    events.push({
      id: `ci-${g.id}`,
      eventType: "groupStayCheckIn",
      date: fmt(arr),
      groupId: g.id,
      groupName: g.group_name,
      pax: g.total_pax,
      label: `✓ ${g.group_name}`,
      chipCls: "bg-emerald-500 text-white",
    });

    // Sleeping nights (day after arrival up to but NOT including departure)
    let cur = arr.clone().add(1, "day");
    while (cur.isBefore(dep, "day")) {
      events.push({
        id: `sl-${g.id}-${fmt(cur)}`,
        eventType: "groupStaySleeping",
        date: fmt(cur),
        groupId: g.id,
        groupName: g.group_name,
        pax: g.total_pax,
        label: `🌙 ${g.group_name}`,
        chipCls: "bg-blue-500 text-white",
      });
      cur.add(1, "day");
    }

    // Check-out (only if departure > arrival — not same-day)
    if (dep.isAfter(arr, "day")) {
      events.push({
        id: `co-${g.id}`,
        eventType: "groupStayCheckOut",
        date: fmt(dep),
        groupId: g.id,
        groupName: g.group_name,
        pax: g.total_pax,
        label: `↑ ${g.group_name}`,
        chipCls: "bg-orange-500 text-white",
      });
    }
  });
  return events;
}

function buildMealEvents(meals, groupById) {
  return meals
    .filter((m) => m.status === "ACTIVE")
    .map((m) => {
      const g = groupById[m.group_id];
      return {
        id: `meal-${m.id}`,
        eventType: "meal",
        date: fmt(moment(m.date)),
        groupId: m.group_id,
        groupName: g?.group_name || "—",
        pax: m.pax,
        mealType: m.meal_type,
        timeRange: m.start_time && m.end_time ? `${m.start_time}–${m.end_time}` : null,
        sandwichOption: m.sandwich_option,
        specialDietsSummary: m.special_diets_summary,
        label: `🍽 ${m.meal_type} · ${g?.group_name || ""}`,
        chipCls: "bg-amber-400 text-white",
      };
    });
}

function buildActivityEvents(items, groupById, spaceById) {
  return items
    .filter((i) => i.status === "ACTIVE" && i.activity_space_id)
    .map((i) => {
      const g = groupById[i.group_id];
      const s = spaceById[i.activity_space_id];
      return {
        id: `act-${i.id}`,
        eventType: "activity",
        date: fmt(moment(i.date)),
        groupId: i.group_id,
        groupName: g?.group_name || "—",
        pax: i.pax,
        activityName: i.activity_name,
        spaceName: s?.name || s?.code || "—",
        timeRange: i.start_time && i.end_time ? `${i.start_time}–${i.end_time}` : null,
        notes: i.notes,
        label: `🏃 ${i.activity_name}`,
        chipCls: "bg-purple-500 text-white",
      };
    });
}

function buildHoldEvents(holds, groupById) {
  const events = [];
  holds
    .filter((h) => h.status === "ACTIVE")
    .forEach((h) => {
      if (!h.arrival_date) return;
      const arr = moment(h.arrival_date);
      const dep = h.departure_date ? moment(h.departure_date) : arr.clone();
      const g = groupById[h.group_id];
      let cur = arr.clone();
      while (cur.isSameOrBefore(dep, "day")) {
        events.push({
          id: `hold-${h.id}-${fmt(cur)}`,
          eventType: "operationalHold",
          date: fmt(cur),
          groupId: h.group_id,
          groupName: g?.group_name || "—",
          pax: h.total_pax,
          label: `⟳ ${g?.group_name || "Hold"}`,
          chipCls: "bg-slate-300 text-slate-700 border border-dashed border-slate-500",
        });
        cur.add(1, "day");
      }
    });
  return events;
}

// ─── Event chip ───────────────────────────────────────────────────────────────

function EventChip({ event, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className={cn(
        "w-full text-right text-[10px] leading-tight rounded px-1 py-0.5 truncate font-medium cursor-pointer hover:opacity-80 transition-opacity",
        event.chipCls
      )}
      title={event.label}
    >
      {event.label}
    </button>
  );
}

// ─── Day Cell ─────────────────────────────────────────────────────────────────

function DayCell({ date, events, onClick, isCurrentMonth }) {
  const isToday = isSameDay(date, moment());
  const dayEvents = events.filter((e) => e.date === fmt(date));

  return (
    <div
      className={cn(
        "min-h-[90px] p-1 flex flex-col gap-0.5 bg-white border-b border-r border-slate-100",
        !isCurrentMonth && "bg-slate-50",
      )}
    >
      <span
        className={cn(
          "text-xs font-semibold self-end leading-none mb-0.5",
          isToday
            ? "bg-primary text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
            : "text-slate-500"
        )}
      >
        {date.format("D")}
      </span>

      <div className="flex flex-col gap-0.5 overflow-hidden">
        {dayEvents.slice(0, 4).map((ev) => (
          <EventChip key={ev.id} event={ev} onClick={onClick} />
        ))}
        {dayEvents.length > 4 && (
          <span className="text-[10px] text-slate-400 px-1">+{dayEvents.length - 4} נוספים</span>
        )}
      </div>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { cls: "bg-emerald-500", label: "צ׳ק-אין" },
    { cls: "bg-blue-500",    label: "לינה" },
    { cls: "bg-orange-500",  label: "צ׳ק-אאוט" },
    { cls: "bg-amber-400",   label: "ארוחה" },
    { cls: "bg-purple-500",  label: "פעילות" },
    { cls: "bg-slate-300 border border-dashed border-slate-500", label: "Hold" },
  ];
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1">
          <span className={cn("inline-block w-3 h-3 rounded-sm shrink-0", item.cls)} />
          {item.label}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const HEB_DAYS_WEEK  = ["שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת", "ראשון"];
const HEB_DAYS_MONTH = ["שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת", "ראשון"];

export default function Calendar() {
  const [pivot, setPivot]       = useState(moment());
  const [view, setView]         = useState("week"); // "week" | "month"
  const [selected, setSelected] = useState(null);

  // ── Queries ────────────────────────────────────────────────────────────────
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

  // ── Lookup maps ────────────────────────────────────────────────────────────
  const groupById = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g])), [groups]);
  const spaceById = useMemo(() => Object.fromEntries(activitySpaces.map((s) => [s.id, s])), [activitySpaces]);

  // ── All events ────────────────────────────────────────────────────────────
  const allEvents = useMemo(() => [
    ...buildGroupEvents(groups),
    ...buildMealEvents(meals, groupById),
    ...buildActivityEvents(scheduleItems, groupById, spaceById),
    ...buildHoldEvents(holds, groupById),
  ], [groups, meals, scheduleItems, activitySpaces, holds, groupById, spaceById]);

  // ── Displayed dates ───────────────────────────────────────────────────────
  const dates = useMemo(
    () => view === "week" ? getWeekDates(pivot) : getMonthDates(pivot),
    [pivot, view]
  );

  // ── Navigation ────────────────────────────────────────────────────────────
  const go = (dir) => setPivot((p) => p.clone().add(dir, view === "week" ? "week" : "month"));
  const goToday = () => setPivot(moment());

  const titleStr = view === "week"
    ? `${dates[0].format("D MMM")} – ${dates[6].format("D MMM YYYY")}`
    : pivot.format("MMMM YYYY");

  // ── Week header labels (Mon → Sun) ────────────────────────────────────────
  const headerDays = HEB_DAYS_WEEK;

  const currentMonth = pivot.month();

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 py-6 space-y-4">

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
            <span className="text-sm font-semibold text-slate-700 mr-2">{titleStr}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={view === "week" ? "default" : "outline"}
              onClick={() => setView("week")}
            >שבוע</Button>
            <Button
              size="sm"
              variant={view === "month" ? "default" : "outline"}
              onClick={() => setView("month")}
            >חודש</Button>
          </div>
        </div>

        {/* Legend */}
        <Legend />

        {/* Grid */}
        <div className="rounded-lg overflow-hidden border border-slate-200">
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
            {headerDays.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-slate-500 py-2 border-r border-slate-100 last:border-r-0">
                {d}
              </div>
            ))}
          </div>

          {/* Week(s) rows */}
          {Array.from({ length: dates.length / 7 }, (_, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {dates.slice(wi * 7, wi * 7 + 7).map((date) => (
                <DayCell
                  key={date.toISOString()}
                  date={date}
                  events={allEvents}
                  onClick={setSelected}
                  isCurrentMonth={view === "week" || date.month() === currentMonth}
                />
              ))}
            </div>
          ))}
        </div>

      </div>

      <CalendarEventModal
        event={selected}
        isOpen={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}