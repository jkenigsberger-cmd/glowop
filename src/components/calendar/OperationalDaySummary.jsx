import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import "moment/locale/he";
import {
  X, Users, UtensilsCrossed, Activity, AlertTriangle,
  ArrowDownCircle, ArrowUpCircle, Moon, ChevronDown, ChevronUp,
  Coffee, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

const EXCLUDED = new Set(["CANCELLED", "COMPLETED", "ARCHIVED"]);

// ── Movement label ────────────────────────────────────────────────────────────
function movementLabel(group, dateStr) {
  if (fmt(group.arrival_date) === dateStr && fmt(group.departure_date) === dateStr) return { label: "נכנס ויוצא", color: "bg-purple-100 text-purple-700" };
  if (fmt(group.arrival_date) === dateStr) return { label: "נכנס", color: "bg-emerald-100 text-emerald-700" };
  if (fmt(group.departure_date) === dateStr) return { label: "יוצא", color: "bg-orange-100 text-orange-700" };
  return { label: "שוהה", color: "bg-blue-100 text-blue-700" };
}

// ── Dietary summary ───────────────────────────────────────────────────────────
function DietBadges({ specialDietsSummary }) {
  if (!specialDietsSummary) return null;
  let d = null;
  try { d = JSON.parse(specialDietsSummary); } catch { return null; }
  if (!d) return null;
  const items = [
    d.lifeThreatening_count > 0 && { label: `⚠ ${d.lifeThreatening_count} אלרגיות מסכנות חיים`, cls: "bg-red-100 text-red-700 font-bold" },
    d.vegetarian_count > 0 && { label: `${d.vegetarian_count} צמחוני`, cls: "bg-green-100 text-green-700" },
    d.vegan_count > 0 && { label: `${d.vegan_count} טבעוני`, cls: "bg-green-100 text-green-700" },
    d.glutenFree_count > 0 && { label: `${d.glutenFree_count} ללא גלוטן`, cls: "bg-amber-100 text-amber-700" },
  ].filter(Boolean);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {items.map((it, i) => (
        <span key={i} className={cn("text-[10px] rounded px-1.5 py-0.5 leading-none", it.cls)}>{it.label}</span>
      ))}
    </div>
  );
}

// ── Single group card (collapsible) ──────────────────────────────────────────
function GroupCard({ group, dateStr, meals, activities, spaces, alerts, defaultOpen }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(defaultOpen);

  const mv = movementLabel(group, dateStr);

  const spaceById = useMemo(() => Object.fromEntries((spaces || []).map(s => [s.id, s])), [spaces]);

  const groupMeals = useMemo(() =>
    (meals || [])
      .filter(m => m.group_id === group.id && m.date === dateStr && m.status === "ACTIVE")
      .sort((a, b) => (MEAL_ORDER[a.meal_type] ?? 99) - (MEAL_ORDER[b.meal_type] ?? 99)),
    [meals, group.id, dateStr]
  );

  const groupActivities = useMemo(() =>
    (activities || [])
      .filter(a => a.group_id === group.id && a.date === dateStr && a.status === "ACTIVE")
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")),
    [activities, group.id, dateStr]
  );

  const groupAlerts = useMemo(() =>
    (alerts || []).filter(a => a.group_id === group.id && a.status === "OPEN"),
    [alerts, group.id]
  );

  const isCheckin  = fmt(group.arrival_date) === dateStr;
  const isCheckout = fmt(group.departure_date) === dateStr;

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden",
      isCheckin && !isCheckout ? "border-emerald-200" :
      isCheckout && !isCheckin ? "border-orange-200" :
      groupAlerts.length > 0  ? "border-red-200" :
      "border-slate-200"
    )}>
      {/* Card header — always visible */}
      <button
        type="button"
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-right transition-colors",
          open ? "bg-slate-50" : "bg-white hover:bg-slate-50"
        )}
        onClick={() => setOpen(o => !o)}
      >
        {/* Movement dot */}
        <span className={cn("w-2 h-2 rounded-full shrink-0",
          isCheckin && !isCheckout ? "bg-emerald-500" :
          isCheckout && !isCheckin ? "bg-orange-500" :
          "bg-blue-400"
        )} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-800 truncate">{group.group_name}</p>
            <span className={cn("text-[10px] rounded px-1.5 py-0.5 leading-none font-medium", mv.color)}>
              {mv.label}
            </span>
            {groupAlerts.length > 0 && (
              <span className="text-[10px] rounded px-1.5 py-0.5 leading-none font-medium bg-red-100 text-red-700">
                ⚠ {groupAlerts.length} התראות
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {group.total_pax ? `${group.total_pax} אורחים` : ""}
            {group.arrival_date && group.departure_date && (
              <span className="mr-2">{group.arrival_date} – {group.departure_date}</span>
            )}
          </p>
        </div>

        {/* Quick counts */}
        <div className="flex items-center gap-2 shrink-0 text-slate-400">
          {groupMeals.length > 0 && (
            <span className="text-[10px] flex items-center gap-0.5">
              <UtensilsCrossed className="w-3 h-3" />{groupMeals.length}
            </span>
          )}
          {groupActivities.length > 0 && (
            <span className="text-[10px] flex items-center gap-0.5">
              <Activity className="w-3 h-3" />{groupActivities.length}
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">

          {/* 1. תנועה */}
          <div className="px-4 py-3 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">תנועה</p>
            {isCheckin && (
              <div className="flex items-center gap-2 text-emerald-700 text-xs">
                <ArrowDownCircle className="w-3.5 h-3.5 shrink-0" />
                <span>צ׳ק אין — {group.arrival_date}</span>
              </div>
            )}
            {isCheckout && (
              <div className="flex items-center gap-2 text-orange-600 text-xs">
                <ArrowUpCircle className="w-3.5 h-3.5 shrink-0" />
                <span>צ׳ק אאוט — {group.departure_date}</span>
              </div>
            )}
            {!isCheckin && !isCheckout && (
              <div className="flex items-center gap-2 text-blue-500 text-xs">
                <Moon className="w-3.5 h-3.5 shrink-0" />
                <span>שוהה באתר</span>
              </div>
            )}
          </div>

          {/* 2. מטבח */}
          {groupMeals.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600 mb-2">מטבח</p>
              <div className="space-y-2">
                {groupMeals.map(m => (
                  <div key={m.id} className="bg-amber-50 rounded-lg px-3 py-2 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-amber-800">
                        {MEAL_TYPE_HEB[m.meal_type] || m.meal_type}
                      </span>
                      {m.pax > 0 && <span className="text-xs text-slate-500">{m.pax} מנות</span>}
                    </div>
                    {m.start_time && (
                      <p className="text-[11px] text-slate-500" dir="ltr">
                        {m.start_time}{m.end_time ? ` – ${m.end_time}` : ""}
                      </p>
                    )}
                    {m.sandwich_option && <p className="text-[11px] text-blue-600">🥪 עם כריך</p>}
                    <DietBadges specialDietsSummary={m.special_diets_summary} />
                    {m.notes && <p className="text-[11px] text-slate-400">{m.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. פעילויות */}
          {groupActivities.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-purple-600 mb-2">פעילויות</p>
              <div className="space-y-1.5">
                {groupActivities.map(a => {
                  const space = spaceById[a.activity_space_id];
                  return (
                    <div key={a.id} className="bg-purple-50 rounded-lg px-3 py-2 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.start_time && (
                          <span className="text-[10px] font-mono bg-white border border-purple-200 rounded px-1.5 py-0.5 text-purple-700 shrink-0" dir="ltr">
                            {a.start_time}{a.end_time ? `–${a.end_time}` : ""}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-800 truncate">{a.activity_name}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {space && <span className="text-[11px] text-purple-500">📍 {space.name || space.code}</span>}
                        {a.pax > 0 && <span className="text-[11px] text-slate-400">{a.pax} 👤</span>}
                        {a.notes && <span className="text-[11px] text-slate-400">{a.notes}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. התראות */}
          {groupAlerts.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-red-500 mb-2">התראות</p>
              <div className="space-y-1.5">
                {groupAlerts.map(alert => (
                  <div key={alert.id} className={cn(
                    "rounded-lg border px-3 py-2 text-xs",
                    alert.severity === "CRITICAL" ? "bg-red-50 border-red-200 text-red-800" :
                    alert.severity === "WARNING"  ? "bg-amber-50 border-amber-200 text-amber-800" :
                                                   "bg-blue-50 border-blue-200 text-blue-800"
                  )}>
                    <p className="font-semibold">{alert.title}</p>
                    {alert.message && <p className="mt-0.5 text-[11px] opacity-80">{alert.message}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer — link to group */}
          <div className="px-4 py-2.5 bg-slate-50 flex justify-end">
            <button
              type="button"
              onClick={() => navigate(`/groups/${group.id}`)}
              className="text-[11px] text-primary hover:underline flex items-center gap-1"
            >
              פרטי קבוצה <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Modal ─────────────────────────────────────────────────────────────────
export default function OperationalDaySummary({
  date, isOpen, onClose,
  allGroups, allMeals, allActivities, allSpaces, allAlerts
}) {
  const dateStr   = date ? fmt(date) : "";
  const dateLabel = date ? moment(date).format("dddd, D בMMMM YYYY") : "";

  const { checkins, checkouts, staying, allGroupsOnDay } = useMemo(() => {
    if (!dateStr) return { checkins: [], checkouts: [], staying: [], allGroupsOnDay: [] };
    const groups = (allGroups || []).filter(g => !EXCLUDED.has(g.status) && g.arrival_date && g.departure_date);
    const checkins  = groups.filter(g => fmt(g.arrival_date)   === dateStr);
    const checkouts = groups.filter(g => fmt(g.departure_date) === dateStr);
    const staying   = groups.filter(g => fmt(g.arrival_date) < dateStr && fmt(g.departure_date) > dateStr);
    // Ordered: checkins first, then checkouts, then staying
    const allGroupsOnDay = [
      ...checkins,
      ...checkouts.filter(g => fmt(g.arrival_date) !== dateStr),
      ...staying,
    ];
    return { checkins, checkouts, staying, allGroupsOnDay };
  }, [allGroups, dateStr]);

  const dayMeals = useMemo(() =>
    (allMeals || []).filter(m => m.status === "ACTIVE" && m.date === dateStr),
    [allMeals, dateStr]
  );

  const dayActivities = useMemo(() =>
    (allActivities || []).filter(a => a.status === "ACTIVE" && a.date === dateStr),
    [allActivities, dateStr]
  );

  const groupIdsOnDay = useMemo(() => new Set(allGroupsOnDay.map(g => g.id)), [allGroupsOnDay]);

  const dayAlerts = useMemo(() =>
    (allAlerts || []).filter(a => a.status === "OPEN" && groupIdsOnDay.has(a.group_id)),
    [allAlerts, groupIdsOnDay]
  );

  const totalPaxOnSite = useMemo(() =>
    [...checkins, ...staying].reduce((s, g) => s + (Number(g.total_pax) || 0), 0),
    [checkins, staying]
  );

  if (!isOpen || !date) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-800">סיכום תפעולי</h2>
            <p className="text-sm text-muted-foreground">{dateLabel}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Daily totals strip ── */}
        <div className="shrink-0 px-5 py-3 border-b border-slate-100 bg-white">
          {allGroupsOnDay.length === 0 ? (
            <p className="text-sm text-slate-400">אין קבוצות ביום זה</p>
          ) : (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">{allGroupsOnDay.length} קבוצות באתר</span>
              {totalPaxOnSite > 0 && <span>{totalPaxOnSite} אורחים</span>}
              {checkins.length > 0 && (
                <span className="flex items-center gap-1 text-emerald-700">
                  <ArrowDownCircle className="w-3 h-3" /> נכנסים: {checkins.length}
                </span>
              )}
              {checkouts.length > 0 && (
                <span className="flex items-center gap-1 text-orange-600">
                  <ArrowUpCircle className="w-3 h-3" /> יוצאים: {checkouts.length}
                </span>
              )}
              {dayMeals.length > 0 && (
                <span className="flex items-center gap-1 text-amber-700">
                  <UtensilsCrossed className="w-3 h-3" /> ארוחות: {dayMeals.length}
                </span>
              )}
              {dayActivities.length > 0 && (
                <span className="flex items-center gap-1 text-purple-700">
                  <Activity className="w-3 h-3" /> פעילויות: {dayActivities.length}
                </span>
              )}
              {dayAlerts.length > 0 && (
                <span className="flex items-center gap-1 text-red-600">
                  <AlertTriangle className="w-3 h-3" /> התראות: {dayAlerts.length}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Scrollable group cards ── */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {allGroupsOnDay.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">אין קבוצות ביום זה</p>
          )}
          {allGroupsOnDay.map(group => {
            const isCheckin  = fmt(group.arrival_date) === dateStr;
            const isCheckout = fmt(group.departure_date) === dateStr;
            const hasAlerts  = (allAlerts || []).some(a => a.group_id === group.id && a.status === "OPEN");
            // Open by default for arrivals, departures, or groups with alerts
            const defaultOpen = isCheckin || isCheckout || hasAlerts;
            return (
              <GroupCard
                key={group.id}
                group={group}
                dateStr={dateStr}
                meals={allMeals}
                activities={allActivities}
                spaces={allSpaces}
                alerts={allAlerts}
                defaultOpen={defaultOpen}
              />
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl shrink-0 flex justify-end">
          <Button size="sm" variant="outline" onClick={onClose}>סגור</Button>
        </div>
      </div>
    </div>
  );
}