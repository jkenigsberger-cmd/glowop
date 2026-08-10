/**
 * CheckInOutCalendar — read-only group movement calendar (Sunday-first).
 * Data source: Group entity only. No records are created or modified.
 */
import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { getMonthDatesSunday, getWeekDatesSunday, HEB_DAYS_SUN } from "@/lib/calendarWeek";
import { isGroupOperationallyEnabled } from "@/lib/groupOperationalIsolation";
import { classifyGroupsForDate } from "@/lib/groupDateReaders";
import useGroupStayPeriods from "@/hooks/useGroupStayPeriods";

const fmt = (d) => moment(d).format("YYYY-MM-DD");
const isSameDay = (a, b) => fmt(a) === fmt(b);
const GROUP_TYPE_HEB = { LODGING: "לינה", DAY_USE: "פעילות יום" };
const STATUS_HEB = { DRAFT: "טיוטה", PENDING_APPROVAL: "בהמתנה", CONFIRMED: "מאושר", COMPLETED: "הסתיים" };

function useGroups() {
  return useQuery({
    queryKey: ["cio-groups"],
    queryFn: () => base44.entities.Group.list("-arrival_date", 500),
    select: items => items.filter(isGroupOperationallyEnabled),
  });
}

/** For a given date string, classify each group */
const classifyGroups = classifyGroupsForDate;

// ── Day Detail Modal ──────────────────────────────────────────────────────────

function DayModal({ dateStr, groups, periodsByGroupId, onClose }) {
  const navigate = useNavigate();
  const { arrivals, departures, staying } = useMemo(
    () => classifyGroups(groups, dateStr, periodsByGroupId),
    [groups, dateStr, periodsByGroupId]
  );
  const dayLabel = moment(dateStr).format("dddd, D בMMMM YYYY");

  const Section = ({ title, items, chipCls }) =>
    items.length === 0 ? null : (
      <div className="space-y-2">
        <p className={cn("text-xs font-bold uppercase tracking-wide px-1", chipCls)}>{title} ({items.length})</p>
        {items.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => { onClose(); navigate(`/groups/${g.id}`); }}
            className="w-full text-right rounded-xl border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 transition-colors space-y-0.5"
          >
            <p className="font-semibold text-slate-800 text-sm">{g.group_name}</p>
            <div className="flex gap-2 text-[11px] text-slate-500 flex-wrap">
              {g.total_pax && <span>👥 {g.total_pax}</span>}
              {g.group_type && <span>{GROUP_TYPE_HEB[g.group_type] || g.group_type}</span>}
              {g.status && <span className="text-slate-400">{STATUS_HEB[g.status] || g.status}</span>}
              {title === "נכנסים" && g.arrival_time && (
                <span className="text-emerald-600 font-medium">🕐 שעת הגעה: {g.arrival_time}</span>
              )}
              {title === "יוצאים" && g.departure_time && (
                <span className="text-orange-500 font-medium">🕐 שעת יציאה: {g.departure_time}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">{dayLabel}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        {arrivals.length === 0 && departures.length === 0 && staying.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">אין תנועות ביום זה</p>
        )}
        <Section title="נכנסים" items={arrivals} chipCls="text-emerald-700" />
        <Section title="יוצאים" items={departures} chipCls="text-orange-700" />
        <Section title="שוהים" items={staying} chipCls="text-blue-700" />
      </div>
    </div>
  );
}

// ── Month Grid Cell ────────────────────────────────────────────────────────────

function CIODayCell({ date, groups, periodsByGroupId, isCurrentMonth, onClick }) {
  const navigate = useNavigate();
  const dateStr = fmt(date);
  const isToday = isSameDay(date, moment());
  const { arrivals, departures, staying } = useMemo(
    () => classifyGroups(groups, dateStr, periodsByGroupId),
    [groups, dateStr, periodsByGroupId]
  );

  const chips = [
    ...arrivals.map((g) => ({ g, label: "נכנס", cls: "bg-emerald-500 text-white" })),
    ...departures.map((g) => ({ g, label: "יוצא", cls: "bg-orange-500 text-white" })),
    ...staying.slice(0, 1).map((g) => ({ g, label: "שוהה", cls: "bg-blue-400 text-white" })),
  ];
  const overflow = staying.length > 1 ? staying.length - 1 : 0;

  return (
    <div
      className={cn(
        "min-h-[90px] p-1 flex flex-col gap-0.5 border-b border-r border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors",
        isCurrentMonth ? "bg-white" : "bg-slate-50/60"
      )}
      onClick={() => onClick(dateStr)}
    >
      <span className={cn(
        "text-[11px] font-semibold self-end leading-none mb-0.5",
        isToday
          ? "bg-primary text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
          : isCurrentMonth ? "text-slate-600" : "text-slate-300"
      )}>
        {date.format("D")}
      </span>
      <div className="flex flex-col gap-0.5 overflow-hidden">
        {chips.slice(0, 3).map(({ g, label, cls }) => (
          <button
            key={g.id + label}
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`/groups/${g.id}`); }}
            className={cn("w-full text-right text-[10px] leading-tight rounded px-1 py-0.5 truncate font-medium hover:opacity-80", cls)}
            title={`${label}: ${g.group_name}`}
          >
            {label}: {g.group_name}
          </button>
        ))}
        {overflow > 0 && (
          <span className="text-[10px] text-slate-400 px-1">+{overflow} שוהים</span>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CheckInOutCalendar() {
  const [pivot, setPivot] = useState(moment());
  const [modalDate, setModalDate] = useState(null);
  const { data: groups = [] } = useGroups();
  const { periodsByGroupId } = useGroupStayPeriods(groups);

  const dates = useMemo(() => getMonthDatesSunday(pivot), [pivot]);
  const currentMonth = pivot.month();

  const go = (dir) => setPivot((p) => p.clone().add(dir, "month"));

  return (
    <div className="space-y-4" dir="rtl">
      {/* Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => go(-1)}><ChevronRight className="w-4 h-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setPivot(moment())} className="px-3">היום</Button>
          <Button size="sm" variant="outline" onClick={() => go(1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-base font-bold text-slate-700 mr-2">{pivot.format("MMMM YYYY")}</span>
        </div>
        {/* Legend */}
        <div className="flex gap-3 text-[11px] text-slate-600">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />נכנסים</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-orange-500 inline-block" />יוצאים</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-400 inline-block" />שוהים</span>
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        {/* Header row */}
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {HEB_DAYS_SUN.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-slate-500 py-2.5 border-r border-slate-100 last:border-r-0">
              {d}
            </div>
          ))}
        </div>
        {/* Weeks */}
        {Array.from({ length: dates.length / 7 }, (_, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {dates.slice(wi * 7, wi * 7 + 7).map((date) => (
              <CIODayCell
                key={date.toISOString()}
                date={date}
                groups={groups}
                periodsByGroupId={periodsByGroupId}
                isCurrentMonth={date.month() === currentMonth}
                onClick={setModalDate}
              />
            ))}
          </div>
        ))}
      </div>

      {modalDate && (
        <DayModal dateStr={modalDate} groups={groups} periodsByGroupId={periodsByGroupId} onClose={() => setModalDate(null)} />
      )}
    </div>
  );
}