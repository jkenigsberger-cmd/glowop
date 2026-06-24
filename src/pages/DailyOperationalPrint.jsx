import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, parseISO } from "date-fns";
import { he } from "date-fns/locale";
import { Link, useSearchParams } from "react-router-dom";

// ── helpers ────────────────────────────────────────────────────────────────
function safeJson(str, fallback) {
  try { const r = JSON.parse(str); return r ?? fallback; } catch { return fallback; }
}

function fmtDate(dateStr) {
  try { return format(parseISO(dateStr), "EEEE, d בMMMM yyyy", { locale: he }); } catch { return dateStr; }
}

const MEAL_LABELS = { BREAKFAST: "ארוחת בוקר", LUNCH: "ארוחת צהריים", DINNER: "ארוחת ערב", OTHER: "אחר" };
const GROUP_TYPE_LABELS = { LODGING: "לינה", DAY_USE: "יום כיף" };

const LOGISTICS_KEYS = [
  { key: "needs_projector",    label: "מקרן" },
  { key: "needs_screen",       label: "מסך" },
  { key: "needs_microphone",   label: "מיקרופון" },
  { key: "needs_sound",        label: "מערכת סאונד" },
  { key: "needs_whiteboard",   label: "לוח" },
  { key: "needs_chair_circle", label: "מעגל כיסאות" },
];

function activityEquipmentText(item) {
  const parts = LOGISTICS_KEYS.filter(k => item[k.key]).map(k => k.label);
  if (item.chairs_count > 0) parts.push(`כיסאות: ${item.chairs_count}`);
  if (item.logistics_other) parts.push(item.logistics_other);
  return parts.length > 0 ? parts.join(", ") : null;
}

const DIET_LABELS = [
  { key: "vegetarian_count",      label: "צמחונים",                   critical: false },
  { key: "vegan_count",           label: "טבעונים",                   critical: false },
  { key: "glutenFree_count",      label: "ללא גלוטן",                 critical: false },
  { key: "lactoseFree_count",     label: "ללא לקטוז",                 critical: false },
  { key: "eggFree_count",         label: "ללא ביצים",                 critical: false },
  { key: "nutFree_count",         label: "ללא אגוזים",                critical: false },
  { key: "mehadrinKosher_count",  label: "מהדרין / כשרות מיוחדת",    critical: false },
  { key: "lifeThreatening_count", label: "אלרגיות מסכנות חיים",       critical: true  },
];

// ── main ───────────────────────────────────────────────────────────────────
export default function DailyOperationalPrint() {
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const { data: groups = [] } = useQuery({
    queryKey: ["groups-daily-print"],
    queryFn: () => base44.entities.Group.list("-arrival_date", 300),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-daily-print"],
    queryFn: () => base44.entities.OperationalGroupProfile.list("-accepted_at", 300),
  });

  const { data: meals = [] } = useQuery({
    queryKey: ["meals-daily-print", dateParam],
    queryFn: () => base44.entities.MealReservation.filter({ date: dateParam, status: "ACTIVE" }),
    enabled: !!dateParam,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["activities-daily-print", dateParam],
    queryFn: () => base44.entities.GroupScheduleItem.filter({ date: dateParam, status: "ACTIVE" }),
    enabled: !!dateParam,
  });

  const { data: coffeeRequests = [] } = useQuery({
    queryKey: ["coffee-daily-print", dateParam],
    queryFn: () => base44.entities.CoffeeCornerRequest.filter({ date: dateParam, status: "ACTIVE" }),
    enabled: !!dateParam,
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ["allocs-daily-print"],
    queryFn: () => base44.entities.SleepingAllocation.filter({ status: "CONFIRMED" }),
  });

  const { data: tents = [] } = useQuery({
    queryKey: ["tents-daily-print"],
    queryFn: () => base44.entities.Tent.list(),
  });

  const { data: neighborhoods = [] } = useQuery({
    queryKey: ["neighborhoods-daily-print"],
    queryFn: () => base44.entities.Neighborhood.list("sort_order", 50),
  });

  const { data: activitySpaces = [] } = useQuery({
    queryKey: ["activitySpaces-daily-print"],
    queryFn: () => base44.entities.ActivitySpace.list(),
  });

  // maps
  const profileByGroupId = Object.fromEntries(profiles.map(p => [p.group_id, p]));
  const spaceById = Object.fromEntries(activitySpaces.map(s => [s.id, s]));
  const tentById = Object.fromEntries(tents.map(t => [t.id, t]));
  const neighborhoodById = Object.fromEntries(neighborhoods.map(n => [n.id, n]));

  const EXCLUDED = new Set(["CANCELLED", "COMPLETED", "ARCHIVED"]);

  // ★ Day-use groups must not appear as check-in/check-out — they appear only as באי יום
  const arrivingToday   = groups.filter(g => !EXCLUDED.has(g.status) && g.group_type === "LODGING" && g.arrival_date === dateParam);
  const departingToday  = groups.filter(g => !EXCLUDED.has(g.status) && g.group_type === "LODGING" && g.departure_date === dateParam);
  const dayUseToday     = groups.filter(g => !EXCLUDED.has(g.status) && g.group_type === "DAY_USE" && g.arrival_date === dateParam);
  const sleepingTonight = groups.filter(g => {
    if (EXCLUDED.has(g.status)) return false;
    if (g.group_type !== "LODGING") return false;
    const dep = g.departure_date?.trim() || null;
    return dep && g.arrival_date <= dateParam && dep > dateParam;
  });

  // Sleeping allocations active tonight
  const allocsTonight = allocations.filter(a => a.arrival_date <= dateParam && a.departure_date > dateParam);
  const allocGroupIds = new Set(allocsTonight.map(a => a.group_id));

  // Collect all-groups critical allergies
  const criticalAllergyGroups = sleepingTonight.filter(g => {
    const p = profileByGroupId[g.id];
    const d = safeJson(p?.special_diets, {});
    return Number(d.lifeThreatening_count) > 0;
  });

  const sortedMeals = [...meals]
    .filter(m => m.meal_type !== "COFFEE_CORNER")
    .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  const sortedActivities = [...activities].sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  const sortedCoffee = [...coffeeRequests].sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));

  const generatedAt = format(new Date(), "dd/MM/yyyy HH:mm");

  return (
    <>
      <style>{`
        @font-face {
          font-family: 'Kav16';
          src: url('https://raw.githubusercontent.com/jkenigsberger-cmd/fonts-/refs/heads/main/Kav16-Semibold.otf') format('opentype');
          font-weight: 600;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'SimplerPro';
          src: url('https://raw.githubusercontent.com/jkenigsberger-cmd/fonts-/refs/heads/main/SimplerPro_HL-Regular.otf') format('opentype');
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'SimplerPro';
          src: url('https://raw.githubusercontent.com/jkenigsberger-cmd/fonts-/refs/heads/main/SimplerPro_HL-Bold.otf') format('opentype');
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body, html { direction: rtl; font-family: 'SimplerPro', 'Arial Hebrew', Arial, sans-serif; font-size: 13px; background: #f8f9fa; color: #1e293b; }
        .print-page { max-width: 800px; margin: 0 auto; background: white; padding: 24px 28px; }
        .doc-header { border-bottom: 3px solid #1e40af; padding-bottom: 16px; margin-bottom: 20px; }
        .doc-title { font-size: 22px; font-weight: 700; color: #1e40af; margin-bottom: 4px; font-family: 'Kav16', 'Arial Hebrew', Arial, sans-serif; }
        .doc-date { font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
        .doc-generated { font-size: 11px; color: #94a3b8; margin-top: 6px; }
        .section { margin-bottom: 20px; page-break-inside: avoid; }
        .section-header { background: #1e40af; color: white; padding: 7px 14px; border-radius: 8px 8px 0 0; font-size: 13px; font-weight: 700; }
        .section-body { border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; padding: 12px 14px; space-y: 8px; }
        .group-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; margin-bottom: 6px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
        .group-row:last-child { border-bottom: none; margin-bottom: 0; }
        .group-name { font-weight: 700; font-size: 14px; color: #1e293b; }
        .group-meta { font-size: 12px; color: #64748b; }
        .meal-card { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; }
        .meal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .meal-type { font-weight: 700; font-size: 14px; color: #15803d; }
        .meal-time { font-size: 12px; color: #166534; direction: ltr; }
        .meal-pax { font-size: 12px; color: #166534; margin-bottom: 3px; }
        .sandwich-badge { display: inline-block; background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; font-weight: 700; border-radius: 6px; padding: 2px 8px; font-size: 12px; margin: 3px 0; }
        .diet-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
        .diet-badge { background: white; border: 1px solid #86efac; border-radius: 12px; padding: 1px 8px; font-size: 11px; color: #166534; }
        .diet-notes { font-size: 11px; color: #166534; margin-top: 3px; }
        .allergy-critical { background: #dc2626; color: white; font-weight: 700; font-size: 12px; border-radius: 4px; padding: 3px 8px; margin: 4px 0; display: inline-block; }
        .activity-card { background: #f8fafc; border: 1px solid #cbd5e1; border-right: 4px solid #1e40af; border-radius: 0 8px 8px 0; padding: 8px 12px; margin-bottom: 6px; }
        .activity-time { font-size: 12px; font-weight: 700; color: #1e40af; direction: ltr; display: inline-block; margin-bottom: 2px; }
        .activity-name { font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 3px; }
        .activity-meta { font-size: 12px; color: #475569; }
        .activity-equipment { font-size: 11px; color: #1d4ed8; font-weight: 600; margin-top: 3px; }
        .global-allergy-warning { background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-weight: 700; font-size: 14px; color: #dc2626; }
        .print-controls { display: flex; gap: 12px; margin-bottom: 20px; }
        .btn-print { background: #1e40af; color: white; border: none; border-radius: 8px; padding: 9px 20px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .btn-back { background: white; color: #1e40af; border: 2px solid #1e40af; border-radius: 8px; padding: 9px 20px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; text-decoration: none; display: inline-flex; align-items: center; }
        .empty-note { font-size: 12px; color: #94a3b8; font-style: italic; padding: 6px 0; }
        /* ── Check-in tents section ──────────────────────────────── */
        .checkin-group-card { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 10px; padding: 14px 16px; margin-bottom: 12px; }
        .checkin-group-card:last-child { margin-bottom: 0; }
        .checkin-group-header { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #ccfbf1; }
        .checkin-group-name { font-weight: 700; font-size: 15px; color: #0f766e; }
        .checkin-group-meta { font-size: 12px; color: #115e59; white-space: nowrap; }
        .checkin-group-meta-sep { color: #5eead4; font-weight: 700; margin: 0 2px; }
        .checkin-nhood-block { margin-bottom: 8px; }
        .checkin-nhood-block:last-child { margin-bottom: 0; }
        .checkin-nhood-title { font-size: 12px; font-weight: 600; color: #0d9488; margin-bottom: 4px; padding-right: 2px; }
        .checkin-tent-grid { display: flex; flex-wrap: wrap; gap: 6px; }
        .checkin-tent-card { background: white; border: 1px solid #ccfbf1; border-radius: 8px; padding: 5px 10px; text-align: center; min-width: 44px; }
        .checkin-tent-code { font-size: 12px; font-weight: 700; color: #0f766e; line-height: 1.3; }
        .checkin-tent-pax { font-size: 13px; font-weight: 800; color: #115e59; line-height: 1.3; }
        .checkin-tent-vip { display: inline-block; background: #fef3c7; color: #92400e; font-size: 9px; font-weight: 700; border-radius: 4px; padding: 1px 4px; margin-top: 1px; }
        .checkin-no-allocs { color: #dc2626; font-size: 11px; font-weight: 700; }
        @media print { .print-controls { display: none !important; } .print-page { padding: 10px 14px; } @page { size: A4; margin: 15mm 12mm; } }
        @media (max-width: 600px) { .print-page { padding: 14px 12px; } .print-controls { flex-direction: column; } .btn-print, .btn-back { width: 100%; justify-content: center; } }
      `}</style>

      <div className="print-page" dir="rtl">

        <div className="print-controls">
          <button className="btn-print" onClick={() => window.print()}>🖨 הדפס / שמור כ-PDF</button>
          <Link to="/dashboard" className="btn-back">← חזרה לבית</Link>
        </div>

        <div className="doc-header">
          <div className="doc-title">סיכום יומי תפעולי</div>
          <div className="doc-date">{fmtDate(dateParam)}</div>
          <div className="doc-generated">הופק: {generatedAt}</div>
        </div>

        {/* Global allergy warning */}
        {criticalAllergyGroups.length > 0 && (
          <div className="global-allergy-warning">
            ⚠ אלרגיות מסכנות חיים באתר היום — יש לתאם עם מטבח!
            {criticalAllergyGroups.map(g => {
              const d = safeJson(profileByGroupId[g.id]?.special_diets, {});
              return (
                <div key={g.id} style={{ fontWeight: "normal", fontSize: "13px", marginTop: "4px" }}>
                  {g.group_name}: {d.lifeThreatening_count} נפגעים פוטנציאליים
                  {d.diet_notes && ` — ${d.diet_notes}`}
                </div>
              );
            })}
          </div>
        )}

        {/* Arriving */}
        <div className="section">
          <div className="section-header">🚌 מגיעים היום ({arrivingToday.length})</div>
          <div className="section-body">
            {arrivingToday.length === 0 ? <div className="empty-note">אין קבוצות מגיעות</div> :
              arrivingToday.map(g => {
                const p = profileByGroupId[g.id];
                return (
                  <div key={g.id} className="group-row">
                    <span className="group-name">{g.group_name}</span>
                    <span className="group-meta">{GROUP_TYPE_LABELS[g.group_type]}</span>
                    {(g.total_pax || p?.total_pax) && <span className="group-meta">👥 {p?.total_pax ?? g.total_pax}</span>}
                    {g.contact_phone && <span className="group-meta">📞 {g.contact_phone}</span>}
                    {!allocGroupIds.has(g.id) && g.group_type === "LODGING" && (
                      <span style={{ color: "#dc2626", fontSize: "11px", fontWeight: "700" }}>⚠ שיבוץ לינה לא אושר</span>
                    )}
                  </div>
                );
              })
            }
          </div>
        </div>

        {/* Check-in tents — tents that must be ready for arriving lodging groups */}
        <div className="section">
          <div className="section-header" style={{ background: "#0d9488" }}>🏕 אוהלים לצ׳ק-אין היום ({arrivingToday.length})</div>
          <div className="section-body">
            {arrivingToday.length === 0 ? <div className="empty-note">אין אוהלים למסירה היום</div> :
              arrivingToday.map(g => {
                const groupAllocs = allocations.filter(a => a.group_id === g.id && a.status === "CONFIRMED" && a.arrival_date <= dateParam && a.departure_date > dateParam);
                const p = profileByGroupId[g.id];
                // Group allocations by neighborhood
                const byNeighborhood = {};
                groupAllocs.forEach(a => {
                  const tent = tentById[a.tent_id];
                  const nid = tent?.neighborhood_id || "_unknown";
                  if (!byNeighborhood[nid]) byNeighborhood[nid] = [];
                  byNeighborhood[nid].push({ ...a, tentCode: tent?.code || "?", tentType: tent?.tent_type || "STANDARD", tentCapacity: tent?.tent_type === "VIP" ? 4 : (tent?.capacity || 8) });
                });

                if (groupAllocs.length === 0) {
                  return (
                    <div key={g.id} className="checkin-group-card" style={{ borderColor: "#fecaca", background: "#fef2f2" }}>
                      <div className="checkin-group-header" style={{ borderColor: "#fecaca" }}>
                        <span className="checkin-group-name" style={{ color: "#991b1b" }}>{g.group_name}</span>
                        {g.arrival_time && <span className="checkin-group-meta" style={{ color: "#b91c1c" }}>צ׳ק-אין {g.arrival_time}</span>}
                        <span className="checkin-group-meta" style={{ color: "#b91c1c" }}>👥 {p?.total_pax ?? g.total_pax}</span>
                      </div>
                      <span className="checkin-no-allocs">⚠ אין שיבוץ לינה מאושר</span>
                    </div>
                  );
                }

                return (
                  <div key={g.id} className="checkin-group-card">
                    <div className="checkin-group-header">
                      <span className="checkin-group-name">{g.group_name}</span>
                      {g.arrival_time && (
                        <>
                          <span className="checkin-group-meta-sep">·</span>
                          <span className="checkin-group-meta">צ׳ק-אין {g.arrival_time}</span>
                        </>
                      )}
                      <span className="checkin-group-meta-sep">·</span>
                      <span className="checkin-group-meta">👥 {p?.total_pax ?? g.total_pax}</span>
                    </div>
                    {Object.entries(byNeighborhood).map(([nid, items]) => {
                      const nhood = neighborhoodById[nid];
                      return (
                        <div key={nid} className="checkin-nhood-block">
                          <div className="checkin-nhood-title">
                            {nhood?.name || "שכונה"}
                          </div>
                          <div className="checkin-tent-grid">
                            {items.map(a => (
                              <div key={a.id} className="checkin-tent-card">
                                <div className="checkin-tent-code">{a.tentCode}</div>
                                <div className="checkin-tent-pax">{a.allocated_pax}/{a.tentCapacity}</div>
                                {a.tentType === "VIP" && <span className="checkin-tent-vip">VIP</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            }
          </div>
        </div>

        {/* Sleeping tonight */}
        <div className="section">
          <div className="section-header">🛏 לנים הלילה ({sleepingTonight.length})</div>
          <div className="section-body">
            {sleepingTonight.length === 0 ? <div className="empty-note">אין קבוצות לנות</div> :
              sleepingTonight.map(g => {
                const p = profileByGroupId[g.id];
                const d = safeJson(p?.special_diets, {});
                const lifeCount = Number(d.lifeThreatening_count) || 0;
                return (
                  <div key={g.id} className="group-row">
                    <span className="group-name">{g.group_name}</span>
                    {(g.total_pax || p?.total_pax) && <span className="group-meta">👥 {p?.total_pax ?? g.total_pax}</span>}
                    <span className="group-meta">הגעה: {g.arrival_date} · עזיבה: {g.departure_date}</span>
                    {lifeCount > 0 && <span className="allergy-critical">⚠ אלרגיה מסכנת חיים: {lifeCount}</span>}
                  </div>
                );
              })
            }
          </div>
        </div>

        {/* Departing */}
        <div className="section">
          <div className="section-header">🏁 עוזבים היום ({departingToday.length})</div>
          <div className="section-body">
            {departingToday.length === 0 ? <div className="empty-note">אין קבוצות עוזבות</div> :
              departingToday.map(g => (
                <div key={g.id} className="group-row">
                  <span className="group-name">{g.group_name}</span>
                  {g.contact_phone && <span className="group-meta">📞 {g.contact_phone}</span>}
                </div>
              ))
            }
          </div>
        </div>

        {/* Day-use groups */}
        <div className="section">
          <div className="section-header" style={{ background: "#b45309" }}>☀️ באי יום ({dayUseToday.length})</div>
          <div className="section-body">
            {dayUseToday.length === 0 ? <div className="empty-note">אין באי יום</div> :
              dayUseToday.map(g => {
                const p = profileByGroupId[g.id];
                return (
                  <div key={g.id} className="group-row">
                    <span className="group-name">{g.group_name}</span>
                    <span className="group-meta">☀️ באי יום</span>
                    {(p?.total_pax ?? g.total_pax) && <span className="group-meta">👥 {p?.total_pax ?? g.total_pax}</span>}
                    {g.arrival_time && g.departure_time && (
                      <span className="group-meta" dir="ltr">🕐 {g.arrival_time}–{g.departure_time}</span>
                    )}
                    {g.contact_phone && <span className="group-meta">📞 {g.contact_phone}</span>}
                  </div>
                );
              })
            }
          </div>
        </div>

        {/* Meals */}
        <div className="section">
          <div className="section-header">🍽 ארוחות היום ({sortedMeals.length})</div>
          <div className="section-body">
            {sortedMeals.length === 0 ? <div className="empty-note">אין ארוחות מתוכננות</div> :
              sortedMeals.map(m => {
                const g = groups.find(x => x.id === m.group_id);
                const diets = safeJson(m.special_diets_summary, {});
                const lifeCount = Number(diets.lifeThreatening_count) || 0;
                const hasDiets = DIET_LABELS.some(d => Number(diets[d.key]) > 0) || diets.diet_notes;
                return (
                  <div key={m.id} className="meal-card">
                    <div className="meal-header">
                      <span className="meal-type">{MEAL_LABELS[m.meal_type] || m.meal_type}</span>
                      {m.start_time && <span className="meal-time" dir="ltr">{m.start_time}–{m.end_time}</span>}
                    </div>
                    {g && <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "3px" }}>{g.group_name}</div>}
                    <div className="meal-pax">👥 {m.pax} משתתפים</div>
                    {m.sandwich_option && (
                      <div className="sandwich-badge">🥪 כריכים במקום ארוחה רגילה</div>
                    )}
                    {lifeCount > 0 && <div className="allergy-critical">⚠ אלרגיות מסכנות חיים: {lifeCount}</div>}
                    {hasDiets && (
                      <div className="diet-row">
                        {DIET_LABELS.filter(d => d.key !== "lifeThreatening_count").map(({ key, label }) => {
                          const count = Number(diets[key]) || 0;
                          if (!count) return null;
                          return <span key={key} className="diet-badge">{label}: {count}</span>;
                        })}
                        {diets.diet_notes && <span className="diet-badge">📝 {diets.diet_notes}</span>}
                      </div>
                    )}
                    {m.notes && <div style={{ fontSize: "11px", color: "#166534", marginTop: "4px" }}>💬 {m.notes}</div>}
                  </div>
                );
              })
            }
          </div>
        </div>

        {/* Coffee Corner */}
        <div className="section">
          <div className="section-header" style={{ background: "#92400e" }}>☕ פינת קפה ({sortedCoffee.length})</div>
          <div className="section-body">
            {sortedCoffee.length === 0 ? <div className="empty-note">אין פינות קפה מתוכננות</div> :
              sortedCoffee.map(req => {
                const g = groups.find(x => x.id === req.group_id);
                return (
                  <div key={req.id} style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRight: "4px solid #92400e", borderRadius: "0 8px 8px 0", padding: "8px 12px", marginBottom: "6px" }}>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: "#92400e", direction: "ltr", display: "inline-block", marginBottom: "2px" }}>
                      {req.start_time}–{req.end_time}
                    </div>
                    {g && <div style={{ fontSize: "14px", fontWeight: "700", color: "#1e293b", marginBottom: "3px" }}>{g.group_name}</div>}
                    <div style={{ fontSize: "12px", color: "#92400e", fontWeight: "600" }}>סוג: {req.coffee_corner_type || "פינת קפה רגילה"}</div>
                    {req.location_name_snapshot && <div style={{ fontSize: "12px", color: "#475569" }}>📍 {req.location_name_snapshot}</div>}
                    <div style={{ fontSize: "12px", color: "#475569" }}>👥 {req.pax} אנשים</div>
                    {req.notes && <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "3px" }}>💬 {req.notes}</div>}
                  </div>
                );
              })
            }
          </div>
        </div>

        {/* Activities */}
        <div className="section">
          <div className="section-header">⚡ פעילויות היום ({sortedActivities.length})</div>
          <div className="section-body">
            {sortedActivities.length === 0 ? <div className="empty-note">אין פעילויות מתוכננות</div> :
              sortedActivities.map(item => {
                const g = groups.find(x => x.id === item.group_id);
                const space = item.activity_space_id ? spaceById[item.activity_space_id] : null;
                return (
                  <div key={item.id} className="activity-card">
                    <div className="activity-time" dir="ltr">{item.start_time}–{item.end_time}</div>
                    <div className="activity-name">{item.activity_name}</div>
                    {g && <div className="activity-meta">🏕 {g.group_name}</div>}
                    {space && <div className="activity-meta">📍 {space.name}</div>}
                    {!space && item.requested_location && <div className="activity-meta">📍 {item.requested_location}</div>}
                    {item.pax > 0 && <div className="activity-meta">👥 {item.pax} משתתפים</div>}
                    <div className="activity-equipment">🔧 ציוד: {activityEquipmentText(item) || "אין ציוד מיוחד"}</div>
                    {item.notes && <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "3px" }}>{item.notes}</div>}
                  </div>
                );
              })
            }
          </div>
        </div>

      </div>
    </>
  );
}