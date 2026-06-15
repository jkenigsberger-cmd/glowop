import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import "moment/locale/he";
import { X, Users, UtensilsCrossed, Activity, AlertTriangle, ArrowDownCircle, ArrowUpCircle, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

moment.locale("he");

const fmt = (d) => moment(d).format("YYYY-MM-DD");

const MEAL_TYPE_HEB = {
  BREAKFAST: "ארוחת בוקר",
  LUNCH: "ארוחת צהריים",
  DINNER: "ארוחת ערב",
  COFFEE_CORNER: "פינת קפה",
  OTHER: "אחר",
};

const MEAL_ORDER = { BREAKFAST: 0, LUNCH: 1, DINNER: 2, COFFEE_CORNER: 3, OTHER: 4 };

function SectionHeader({ icon: Icon, title, count, color = "text-slate-700" }) {
  return (
    <div className={cn("flex items-center gap-2 font-bold text-sm mb-2", color)}>
      <Icon className="w-4 h-4 shrink-0" />
      <span>{title}</span>
      {count != null && (
        <span className="ml-auto text-xs font-semibold bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{count}</span>
      )}
    </div>
  );
}

function GroupRow({ group, type, navigate }) {
  const isCheckin  = type === "checkin";
  const isCheckout = type === "checkout";
  const isStaying  = type === "staying";

  return (
    <button
      type="button"
      className="w-full text-right flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-100 bg-white hover:bg-slate-50 transition-colors"
      onClick={() => navigate(`/groups/${group.id}`)}
    >
      <span className={cn(
        "w-2.5 h-2.5 rounded-full shrink-0",
        isCheckin ? "bg-emerald-500" : isCheckout ? "bg-orange-500" : "bg-blue-400"
      )} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate">{group.group_name}</p>
        <p className="text-xs text-slate-500">
          {isCheckin ? `נכנסים • ${group.arrival_date}` : isCheckout ? `יוצאים • ${group.departure_date}` : `שוהים • ${group.arrival_date} – ${group.departure_date}`}
        </p>
      </div>
      {group.total_pax && (
        <span className="text-xs text-slate-500 shrink-0">{group.total_pax} 👤</span>
      )}
    </button>
  );
}

const EXCLUDED = new Set(["CANCELLED", "COMPLETED", "ARCHIVED"]);

export default function OperationalDaySummary({ date, isOpen, onClose, allGroups, allMeals, allActivities, allSpaces, allAlerts }) {
  const navigate = useNavigate();

  const dateStr   = date ? fmt(date) : "";
  const dateLabel = date ? moment(date).format("dddd, D בMMMM YYYY") : "";

  const spaceById = useMemo(() => Object.fromEntries((allSpaces || []).map(s => [s.id, s])), [allSpaces]);

  const { checkins, checkouts, staying } = useMemo(() => {
    if (!dateStr) return { checkins: [], checkouts: [], staying: [] };
    const groups = (allGroups || []).filter(g => !EXCLUDED.has(g.status) && g.arrival_date && g.departure_date);
    return {
      checkins:  groups.filter(g => fmt(g.arrival_date)   === dateStr),
      checkouts: groups.filter(g => fmt(g.departure_date) === dateStr),
      staying:   groups.filter(g => fmt(g.arrival_date) < dateStr && fmt(g.departure_date) > dateStr),
    };
  }, [allGroups, dateStr]);

  const dayMeals = useMemo(() => {
    if (!dateStr) return [];
    return (allMeals || [])
      .filter(m => m.status === "ACTIVE" && m.date === dateStr)
      .sort((a, b) => (MEAL_ORDER[a.meal_type] ?? 99) - (MEAL_ORDER[b.meal_type] ?? 99));
  }, [allMeals, dateStr]);

  const mealsByType = useMemo(() => {
    const map = {};
    dayMeals.forEach(m => {
      const t = m.meal_type || "OTHER";
      if (!map[t]) map[t] = [];
      map[t].push(m);
    });
    return map;
  }, [dayMeals]);

  const dayActivities = useMemo(() => {
    if (!dateStr) return [];
    return (allActivities || [])
      .filter(i => i.status === "ACTIVE" && i.date === dateStr)
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  }, [allActivities, dateStr]);

  const groupIdsOnDay = useMemo(() => {
    return new Set([...checkins, ...checkouts, ...staying].map(g => g.id));
  }, [checkins, checkouts, staying]);

  const dayAlerts = useMemo(() => {
    return (allAlerts || []).filter(a => a.status === "OPEN" && groupIdsOnDay.has(a.group_id));
  }, [allAlerts, groupIdsOnDay]);

  const groupById = useMemo(() => Object.fromEntries((allGroups || []).map(g => [g.id, g])), [allGroups]);

  const totalPaxOnSite = useMemo(() => {
    return [...staying, ...checkins].reduce((s, g) => s + (Number(g.total_pax) || 0), 0);
  }, [checkins, staying]);

  if (!isOpen || !date) return null;

  const allGroupsOnDay = [...checkins, ...checkouts, ...staying];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800">סיכום תפעולי</h2>
            <p className="text-sm text-muted-foreground">{dateLabel}</p>
          </div>
          {/* Quick stats */}
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {allGroupsOnDay.length > 0 && <span>{allGroupsOnDay.length} קבוצות</span>}
            {totalPaxOnSite > 0 && <span>{totalPaxOnSite} אורחים</span>}
            <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

          {/* ── 1. תנועת קבוצות ─────────────────────────────────────────── */}
          <section>
            <SectionHeader icon={Users} title="תנועת קבוצות" color="text-slate-700" />
            {checkins.length === 0 && checkouts.length === 0 && staying.length === 0 ? (
              <p className="text-xs text-slate-400 px-1">אין קבוצות ביום זה</p>
            ) : (
              <div className="space-y-1.5">
                {checkins.length > 0 && (
                  <>
                    <p className="text-xs font-bold text-emerald-600 flex items-center gap-1 px-1 pt-1">
                      <ArrowDownCircle className="w-3 h-3" /> נכנסים ({checkins.length})
                    </p>
                    {checkins.map(g => <GroupRow key={g.id} group={g} type="checkin" navigate={navigate} />)}
                  </>
                )}
                {checkouts.length > 0 && (
                  <>
                    <p className="text-xs font-bold text-orange-600 flex items-center gap-1 px-1 pt-1">
                      <ArrowUpCircle className="w-3 h-3" /> יוצאים ({checkouts.length})
                    </p>
                    {checkouts.map(g => <GroupRow key={g.id} group={g} type="checkout" navigate={navigate} />)}
                  </>
                )}
                {staying.length > 0 && (
                  <>
                    <p className="text-xs font-bold text-blue-500 flex items-center gap-1 px-1 pt-1">
                      <Moon className="w-3 h-3" /> שוהים ({staying.length})
                    </p>
                    {staying.map(g => <GroupRow key={g.id} group={g} type="staying" navigate={navigate} />)}
                  </>
                )}
              </div>
            )}
          </section>

          {/* ── 2. מטבח ─────────────────────────────────────────────────── */}
          <section>
            <SectionHeader icon={UtensilsCrossed} title="מטבח" count={dayMeals.length} color="text-amber-700" />
            {dayMeals.length === 0 ? (
              <p className="text-xs text-slate-400 px-1">אין ארוחות מתוכננות</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(mealsByType).map(([mealType, meals]) => {
                  const totalPax = meals.reduce((s, m) => s + (Number(m.pax) || 0), 0);
                  return (
                    <div key={mealType}>
                      <div className="flex items-center justify-between mb-1 px-1">
                        <span className="text-xs font-bold text-amber-700">{MEAL_TYPE_HEB[mealType] || mealType}</span>
                        <span className="text-xs text-slate-500">{totalPax} מנות · {meals.length} קבוצות</span>
                      </div>
                      {meals.map(m => {
                        const g = groupById[m.group_id];
                        let diets = null;
                        try { diets = m.special_diets_summary ? JSON.parse(m.special_diets_summary) : null; } catch {}
                        const lifeThreaten = Number(diets?.lifeThreatening_count) || 0;
                        return (
                          <div key={m.id} className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-center gap-2 mb-1">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{g?.group_name || "קבוצה"}</p>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                {m.start_time && <span className="text-[10px] text-slate-500" dir="ltr">{m.start_time}{m.end_time ? `–${m.end_time}` : ""}</span>}
                                {m.pax > 0 && <span className="text-[10px] text-slate-500">{m.pax} מנות</span>}
                                {m.sandwich_option && <span className="text-[10px] text-blue-600 font-medium">+ כריך</span>}
                                {lifeThreaten > 0 && <span className="text-[10px] text-red-600 font-bold">⚠ {lifeThreaten} אלרגיות</span>}
                                {m.notes && <span className="text-[10px] text-slate-400 truncate max-w-[140px]">{m.notes}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── 3. פעילויות ─────────────────────────────────────────────── */}
          <section>
            <SectionHeader icon={Activity} title="פעילויות" count={dayActivities.length} color="text-purple-700" />
            {dayActivities.length === 0 ? (
              <p className="text-xs text-slate-400 px-1">אין פעילויות מתוזמנות</p>
            ) : (
              <div className="space-y-1.5">
                {dayActivities.map(item => {
                  const g = groupById[item.group_id];
                  const space = spaceById[item.activity_space_id];
                  return (
                    <div key={item.id} className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.start_time && (
                            <span className="text-[10px] font-mono bg-white border border-purple-200 rounded px-1.5 py-0.5 text-purple-700 shrink-0" dir="ltr">
                              {item.start_time}{item.end_time ? `–${item.end_time}` : ""}
                            </span>
                          )}
                          <span className="text-xs font-semibold text-slate-800 truncate">{item.activity_name}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {g && <span className="text-[10px] text-slate-500 truncate">{g.group_name}</span>}
                          {space && <span className="text-[10px] text-purple-500">📍 {space.name || space.code}</span>}
                          {item.pax > 0 && <span className="text-[10px] text-slate-400">{item.pax} 👤</span>}
                          {item.notes && <span className="text-[10px] text-slate-400 truncate max-w-[160px]">{item.notes}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── 4. התראות ───────────────────────────────────────────────── */}
          {dayAlerts.length > 0 && (
            <section>
              <SectionHeader icon={AlertTriangle} title="התראות" count={dayAlerts.length} color="text-red-600" />
              <div className="space-y-1.5">
                {dayAlerts.map(alert => (
                  <div key={alert.id} className={cn(
                    "rounded-lg border px-3 py-2 text-xs",
                    alert.severity === "CRITICAL" ? "bg-red-50 border-red-200 text-red-800" :
                    alert.severity === "WARNING"  ? "bg-amber-50 border-amber-200 text-amber-800" :
                                                   "bg-blue-50 border-blue-200 text-blue-800"
                  )}>
                    <p className="font-semibold">{alert.title}</p>
                    {alert.message && <p className="mt-0.5 text-[11px] opacity-80">{alert.message}</p>}
                    <p className="mt-0.5 text-[10px] opacity-60">{groupById[alert.group_id]?.group_name}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl shrink-0 flex justify-end">
          <Button size="sm" variant="outline" onClick={onClose}>סגור</Button>
        </div>
      </div>
    </div>
  );
}