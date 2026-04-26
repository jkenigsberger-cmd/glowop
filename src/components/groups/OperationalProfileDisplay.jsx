import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ShieldCheck } from "lucide-react";

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

export default function OperationalProfileDisplay({ groupId }) {
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["operationalProfile", groupId],
    queryFn: () => base44.entities.OperationalGroupProfile.filter({ group_id: groupId }),
    enabled: !!groupId,
  });

  if (isLoading) return null;

  const profile = profiles[0]; // latest / only accepted profile
  if (!profile) return null;

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

          {/* General notes */}
          {profile.general_notes && (
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-1">📝 הערות כלליות</p>
              <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">{profile.general_notes}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}