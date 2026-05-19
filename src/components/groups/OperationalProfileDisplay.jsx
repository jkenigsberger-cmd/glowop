import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ShieldCheck, CalendarDays, UtensilsCrossed, BedDouble } from "lucide-react";

function safeJson(str, fallback) {
  try { const r = JSON.parse(str); return r ?? fallback; } catch { return fallback; }
}

const DIET_LABELS = [
  { key: "vegetarian_count",      label: "צמחוני",               emoji: "🥗" },
  { key: "vegan_count",           label: "טבעוני",               emoji: "🌱" },
  { key: "glutenFree_count",      label: "ללא גלוטן",             emoji: "🌾" },
  { key: "mehadrinKosher_count",  label: "מהדרין",               emoji: "✡️" },
  { key: "lifeThreatening_count", label: "אלרגיה מסכנת חיים",    emoji: "⚠️" },
  { key: "nutFree_count",         label: "ללא אגוזים",           emoji: "🥜" },
  { key: "eggFree_count",         label: "ללא ביצים",            emoji: "🥚" },
  { key: "lactoseFree_count",     label: "ללא לקטוז",            emoji: "🥛" },
];

function Row({ label, value }) {
  if (value == null || value === "" || value === false) return null;
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{String(value)}</span>
    </div>
  );
}

const MEAL_LABELS = { BREAKFAST: "ארוחת בוקר", LUNCH: "ארוחת צהריים", DINNER: "ארוחת ערב", OTHER: "אחר" };
const GENDER_LABELS = { BOYS: "בנים", GIRLS: "בנות", MEN: "גברים", WOMEN: "נשים" };
const ALLOC_TYPE_LABELS = { STUDENT: "חניכים", STAFF: "צוות/VIP" };

export default function OperationalProfileDisplay({ groupId }) {
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["operationalProfile", groupId],
    queryFn: () => base44.entities.OperationalGroupProfile.filter({ group_id: groupId }),
    enabled: !!groupId,
  });

  const { data: mealReservations = [] } = useQuery({
    queryKey: ["mealReservations", groupId],
    queryFn: () => base44.entities.MealReservation.filter({ group_id: groupId }),
    enabled: !!groupId,
  });

  const { data: scheduleItems = [] } = useQuery({
    queryKey: ["groupScheduleItems", groupId],
    queryFn: () => base44.entities.GroupScheduleItem.filter({ group_id: groupId }),
    enabled: !!groupId,
  });

  const { data: sleepingAllocations = [] } = useQuery({
    queryKey: ["sleepingAllocations", groupId],
    queryFn: () => base44.entities.SleepingAllocation.filter({ group_id: groupId }),
    enabled: !!groupId,
  });

  if (isLoading) return null;

  const profile = profiles[0];
  if (!profile) return null;

  // Live operational records
  const activeMeals = mealReservations.filter(m => m.status === "ACTIVE");
  const activeActivities = scheduleItems.filter(s => s.status === "ACTIVE");
  const activeAllocations = sleepingAllocations.filter(a => a.status !== "CANCELLED");
  const hasLiveData = activeMeals.length > 0 || activeActivities.length > 0 || activeAllocations.length > 0;

  const diets = safeJson(profile.special_diets, {});
  const meals = safeJson(profile.meal_plan, []);
  const lodging = safeJson(profile.tent_distribution_notes, {});
  const scheduleReqs = safeJson(profile.schedule_requests, []);
  const hasDiets = DIET_LABELS.some(d => Number(diets[d.key]) > 0) || diets.diet_notes;
  const hasMeals = Array.isArray(meals) && meals.length > 0;
  const hasSchedule = Array.isArray(scheduleReqs) && scheduleReqs.filter(r => r.activity).length > 0;

  const acceptedAt = profile.accepted_at
    ? (() => { try { return format(parseISO(profile.accepted_at), "dd/MM/yyyy HH:mm"); } catch { return profile.accepted_at; } })()
    : null;

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <h2 className="font-semibold text-slate-800">פרופיל תפעולי מאושר</h2>
        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-2 py-0.5">מאושר</span>
      </div>

      <div className="bg-white border border-emerald-200 rounded-xl overflow-hidden">
        {/* Header bar */}
        <div className="bg-emerald-50 px-4 py-2.5 flex items-center justify-between border-b border-emerald-200">
          <p className="text-xs font-medium text-emerald-700">פרופיל זה הוא האמת התפעולית של הקבוצה</p>
          {acceptedAt && (
            <p className="text-xs text-emerald-500">
              אושר ע"י {profile.accepted_by || "אדמין"} · {acceptedAt}
            </p>
          )}
        </div>

        <div className="px-4 py-4 space-y-5">

          {/* Headcounts */}
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2">👥 משתתפים</p>
            <div className="bg-slate-50 rounded-lg px-3 py-2">
              <Row label='סה"כ'      value={profile.total_pax} />
              <Row label="חניכים"    value={profile.participant_count} />
              <Row label="בנים"      value={profile.boys_count} />
              <Row label="בנות"      value={profile.girls_count} />
              <Row label="צוות"      value={profile.staff_count} />
              <Row label="נהגים / גברים"  value={profile.drivers_men_count} />
              <Row label="נהגים / נשים"   value={profile.drivers_women_count} />
            </div>
          </div>

          {/* Meals */}
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2">🍽️ ארוחות</p>
            <div className="bg-slate-50 rounded-lg px-3 py-2 space-y-1 text-sm">
              <Row label="קבוצה עם לינה"         value={profile.is_sleeping_group ? "כן" : "לא"} />
              <Row label="ארוחת צהריים בהגעה"    value={profile.arrival_lunch ? "כן" : null} />
              <Row label="ארוחת צהריים בעזיבה"   value={profile.departure_lunch ? "כן" : null} />
              {hasMeals && (
                <p className="text-xs text-slate-400 mt-1">{meals.length} ארוחות בתפריט</p>
              )}
            </div>
          </div>

          {/* Diets */}
          {hasDiets && (
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2">🥗 תזונה מיוחדת</p>
              <div className="grid grid-cols-2 gap-1.5">
                {DIET_LABELS.map(({ key, label, emoji }) => {
                  const count = Number(diets[key]) || 0;
                  if (!count) return null;
                  return (
                    <div key={key} className={`flex justify-between px-3 py-1.5 rounded-lg text-xs border ${
                      key === "lifeThreatening_count"
                        ? "bg-red-50 border-red-200 text-red-700 font-semibold"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}>
                      <span>{emoji} {label}</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  );
                })}
                {diets.diet_notes && (
                  <div className="col-span-2 text-xs text-slate-500 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
                    {diets.diet_notes}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Lodging notes */}
          {(lodging.student_sleeping_notes || lodging.staff_sleeping_notes || lodging.drivers_lodging_notes) && (
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2">🏕️ הערות לינה</p>
              <div className="space-y-1.5 text-xs text-slate-600">
                {lodging.student_sleeping_notes && <p><strong>חניכים:</strong> {lodging.student_sleeping_notes}</p>}
                {lodging.staff_sleeping_notes    && <p><strong>צוות:</strong> {lodging.staff_sleeping_notes}</p>}
                {lodging.drivers_lodging_notes   && <p><strong>נהגים:</strong> {lodging.drivers_lodging_notes}</p>}
              </div>
            </div>
          )}

          {/* Schedule requests */}
          {hasSchedule && (
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-2">📅 בקשות לוח פעילויות (טרם מאושרות)</p>
              <div className="space-y-1.5">
                {scheduleReqs.filter(r => r.activity).map((r, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-700">
                    <span className="font-medium">{r.activity}</span>
                    {r.date && <span className="text-slate-400 mr-2">{r.date}</span>}
                    {r.start_time && <span className="text-slate-400">{r.start_time}{r.end_time ? `–${r.end_time}` : ""}</span>}
                    {r.location && <span className="text-slate-400 mr-2">📍{r.location}</span>}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">בקשות אלו טעונות אישור מנהלי לפני שיהפכו לפריטי לוח</p>
            </div>
          )}

          {/* Schedule requests from client */}
          {(() => {
            const scheduleReqs = safeJson(profile.schedule_requests, []);
            const items = Array.isArray(scheduleReqs) ? scheduleReqs.filter(r => r.activity || r.date) : [];
            return (
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2">📅 לוח זמנים מהלקוח</p>
                {items.length === 0 ? (
                  <p className="text-xs text-slate-400 italic px-1">לא נמסר לוח זמנים</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((r, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs space-y-1">
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-slate-500">
                          {r.date && <span className="font-medium text-slate-700">{(() => { try { return new Date(r.date).toLocaleDateString("he-IL"); } catch { return r.date; } })()}</span>}
                          {(r.start_time || r.end_time) && (
                            <span>{r.start_time || ""}{r.start_time && r.end_time ? " — " : ""}{r.end_time || ""}</span>
                          )}
                          {r.pax && <span>👥 {r.pax} משתתפים</span>}
                        </div>
                        {r.activity && <p className="font-semibold text-slate-800">{r.activity}</p>}
                        {r.location && <p className="text-slate-500">📍 מיקום מבוקש: {r.location}</p>}
                        {r.notes && <p className="text-slate-400">הערות: {r.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* General notes */}
          {profile.general_notes && (
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-1">📝 הערות כלליות</p>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">{profile.general_notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Live Operational Records ───────────────────────────────────────── */}
      {hasLiveData && (
        <div className="bg-white border border-blue-200 rounded-xl overflow-hidden mt-4">
          <div className="bg-blue-50 px-4 py-2.5 border-b border-blue-200 flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-700">נתונים תפעוליים שנוספו ידנית</span>
          </div>
          <div className="px-4 py-4 space-y-5">

            {/* Active meals */}
            {activeMeals.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                  <UtensilsCrossed className="w-3.5 h-3.5" /> ארוחות מתוכננות ({activeMeals.length})
                </p>
                <div className="space-y-1">
                  {[...activeMeals].sort((a,b) => a.date.localeCompare(b.date) || (a.start_time||"").localeCompare(b.start_time||"")).map(m => (
                    <div key={m.id} className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                      <span className="font-medium text-slate-700">{MEAL_LABELS[m.meal_type] || m.meal_type}</span>
                      <span className="text-slate-500">{m.date} · {m.start_time}–{m.end_time}</span>
                      {m.pax > 0 && <span className="text-slate-400">👥 {m.pax}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active activities */}
            {activeActivities.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5" /> פעילויות מתוכננות ({activeActivities.length})
                </p>
                <div className="space-y-1">
                  {[...activeActivities].sort((a,b) => a.date.localeCompare(b.date) || (a.start_time||"").localeCompare(b.start_time||"")).map(s => (
                    <div key={s.id} className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                      <span className="font-medium text-slate-700">{s.activity_name}</span>
                      <span className="text-slate-500">{s.date} · {s.start_time}–{s.end_time}</span>
                      {s.pax > 0 && <span className="text-slate-400">👥 {s.pax}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sleeping allocations */}
            {activeAllocations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
                  <BedDouble className="w-3.5 h-3.5" /> שיבוצי לינה ({activeAllocations.length} אוהלים)
                </p>
                <div className="space-y-1">
                  {activeAllocations.map(a => (
                    <div key={a.id} className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                      <span className="font-medium text-slate-700">
                        {ALLOC_TYPE_LABELS[a.allocation_type] || a.allocation_type} · {GENDER_LABELS[a.gender_group] || a.gender_group}
                      </span>
                      <span className="text-slate-500">{a.arrival_date} → {a.departure_date}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${a.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {a.status === 'CONFIRMED' ? 'מאושר' : 'טיוטה'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </section>
  );
}