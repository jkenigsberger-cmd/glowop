import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, eachDayOfInterval, isWithinInterval } from "date-fns";
import { he } from "date-fns/locale";

// ── helpers ────────────────────────────────────────────────────────────────
function safeJson(str, fallback) {
  try { const r = JSON.parse(str); return r ?? fallback; } catch { return fallback; }
}

function cleanOperationalNote(note) {
  if (!note) return "";
  return String(note)
    .replace(/__vip_req_\d+__/g, "")
    .trim();
}

function fmtDate(dateStr) {
  try {
    return format(parseISO(dateStr), "EEEE, d בMMMM yyyy", { locale: he });
  } catch {
    return dateStr;
  }
}

const MEAL_LABELS = { BREAKFAST: "ארוחת בוקר", LUNCH: "ארוחת צהריים", DINNER: "ארוחת ערב", OTHER: "אחר" };
const GENDER_LABELS = { BOYS: "בנים", GIRLS: "בנות", MEN: "גברים", WOMEN: "נשים", MIXED: "מעורב" };
const ALLOC_TYPE_LABELS = { STUDENT: "חניכים", STAFF: "צוות" };
const GROUP_TYPE_LABELS = { LODGING: "לינה", DAY_USE: "פעילות יום" };

const DIET_LABELS = [
  { key: "vegetarian_count",     label: "צמחונים",              critical: false },
  { key: "vegan_count",          label: "טבעונים",               critical: false },
  { key: "glutenFree_count",     label: "ללא גלוטן",             critical: false },
  { key: "lactoseFree_count",    label: "ללא לקטוז",             critical: false },
  { key: "eggFree_count",        label: "ללא ביצים",             critical: false },
  { key: "nutFree_count",        label: "ללא אגוזים",            critical: false },
  { key: "mehadrinKosher_count", label: "מהדרין / כשרות מיוחדת", critical: false },
  { key: "lifeThreatening_count",label: "אלרגיות מסכנות חיים",  critical: true  },
];

// ── sub-components ─────────────────────────────────────────────────────────

function getPax(allocation) {
  if (allocation.allocated_pax != null) return allocation.allocated_pax;
  if (allocation.pax != null) return allocation.pax;
  if (allocation.beds_reserved != null) return allocation.beds_reserved;
  return null;
}

function TentCard({ allocation, tent }) {
  const tentCode = tent?.code || "—";
  const isVip = tent?.tent_type === "VIP";
  const pax = getPax(allocation);

  return (
    <div className={`tent-card ${isVip ? "tent-card-vip" : ""}`}>
      <div className={`tent-header ${isVip ? "vip" : ""}`}>
        {isVip ? "VIP " : "אוהל "}{tentCode}
      </div>
      <div className="tent-body">
        <div className="tent-pax">{pax != null ? pax : "—"}</div>
        <div className="tent-pax-label">אנשים</div>
      </div>
    </div>
  );
}

function CoffeeCard({ req }) {
  return (
    <div className="coffee-card">
      <div className="coffee-date">{req.date?.split("-").reverse().join("/")}</div>
      <div className="coffee-time" dir="ltr">{req.start_time}–{req.end_time}</div>
      <div className="coffee-type">סוג: {req.coffee_corner_type || "פינת קפה רגילה"}</div>
      {req.location_name_snapshot && <div className="coffee-location">📍 {req.location_name_snapshot}</div>}
      <div className="coffee-pax">👥 כמות: {req.pax}</div>
      {req.notes && <div className="coffee-notes">{req.notes}</div>}
    </div>
  );
}

function MealCard({ meal, profileDiets }) {
  // Use current profile diet as source of truth; fall back to meal snapshot for legacy data
  const diets = profileDiets || safeJson(meal.special_diets_summary, {});
  const hasDiets = DIET_LABELS.some(d => Number(diets[d.key]) > 0) || diets.diet_notes;
  const lifeThreat = Number(diets.lifeThreatening_count) || 0;

  return (
    <div className="meal-card">
      <div className="meal-header">
        <span className="meal-type">{MEAL_LABELS[meal.meal_type] || meal.meal_type}</span>
        <span className="meal-time" dir="ltr">{meal.start_time}–{meal.end_time}</span>
      </div>
      <div className="meal-pax">👥 {meal.pax} משתתפים</div>
      {meal.sandwich_option && (
        <div style={{ display: "inline-block", background: "#fef3c7", border: "1px solid #f59e0b", color: "#92400e", fontWeight: "700", borderRadius: "6px", padding: "2px 8px", fontSize: "12px", margin: "4px 0" }}>
          🥪 כריכים במקום ארוחה רגילה
        </div>
      )}
      {lifeThreat > 0 && (
        <div className="allergy-critical">⚠ אלרגיות מסכנות חיים: {lifeThreat}</div>
      )}
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
      {meal.notes && <div className="meal-notes">{meal.notes}</div>}
    </div>
  );
}

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

function ActivityCard({ item, space }) {
  const equipment = activityEquipmentText(item);

  // Parse shared activity snapshot
  const isShared = !!(item.is_shared_activity || item.shared_activity_id);
  let otherGroups = [];
  let totalPax = 0;
  if (isShared) {
    try {
      const ids   = item.shared_activity_group_ids   ? JSON.parse(item.shared_activity_group_ids)   : [];
      const names = item.shared_activity_group_names ? JSON.parse(item.shared_activity_group_names) : [];
      otherGroups = ids
        .map((id, i) => ({ id, name: names[i] || id }))
        .filter(g => g.id !== item.group_id);
    } catch {}
  }

  return (
    <div className="activity-card">
      <div className="activity-time" dir="ltr">{item.start_time}–{item.end_time}</div>
      <div className="activity-name">{item.activity_name}</div>
      {space && <div className="activity-location">📍 {space.name}</div>}
      {!space && item.requested_location && (
        <div className="activity-location">📍 {item.requested_location}</div>
      )}
      {item.pax > 0 && <div className="activity-pax">👥 {item.pax} משתתפים</div>}
      <div className="activity-equipment">
        🔧 ציוד: {equipment || "אין ציוד מיוחד"}
      </div>
      {item.notes && <div className="activity-notes">{item.notes}</div>}
      {isShared && (
        <div className="activity-shared">
          <span className="shared-label">🔗 פעילות משותפת</span>
          {item.pax > 0 && (
            <span className="shared-line">קבוצה זו: <strong>{item.pax}</strong></span>
          )}
          {otherGroups.length > 0 && (
            <span className="shared-line">
              משותף עם: {otherGroups.map(g => g.name).join(", ")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── main ───────────────────────────────────────────────────────────────────
export default function OperationalSummaryPrint() {
  const { id } = useParams();

  const { data: groupArr = [] } = useQuery({
    queryKey: ["group", id],
    queryFn: () => base44.entities.Group.filter({ id }),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["operationalProfile", id],
    queryFn: () => base44.entities.OperationalGroupProfile.filter({ group_id: id }),
    enabled: !!id,
  });

  const { data: mealReservations = [] } = useQuery({
    queryKey: ["mealReservations", id],
    queryFn: () => base44.entities.MealReservation.filter({ group_id: id }),
    enabled: !!id,
  });

  const { data: scheduleItems = [] } = useQuery({
    queryKey: ["groupScheduleItems", id],
    queryFn: () => base44.entities.GroupScheduleItem.filter({ group_id: id }),
    enabled: !!id,
  });

  const { data: sleepingAllocations = [] } = useQuery({
    queryKey: ["sleepingAllocations", id],
    queryFn: () => base44.entities.SleepingAllocation.filter({ group_id: id }),
    enabled: !!id,
  });

  const { data: allTents = [] } = useQuery({
    queryKey: ["tents"],
    queryFn: () => base44.entities.Tent.list(),
  });

  const { data: allNeighborhoods = [] } = useQuery({
    queryKey: ["neighborhoods"],
    queryFn: () => base44.entities.Neighborhood.list("sort_order"),
  });

  const { data: allActivitySpaces = [] } = useQuery({
    queryKey: ["activitySpaces"],
    queryFn: () => base44.entities.ActivitySpace.list(),
  });

  const { data: coffeeRequests = [] } = useQuery({
    queryKey: ["coffeeCornerRequests", id],
    queryFn: () => base44.entities.CoffeeCornerRequest.filter({ group_id: id, status: "ACTIVE" }),
    enabled: !!id,
  });

  const group = groupArr[0];
  const profile = profiles[0];

  if (!group) {
    return (
      <div style={{ padding: 40, fontFamily: "Arial", direction: "rtl" }}>
        <p>טוען נתוני קבוצה...</p>
      </div>
    );
  }

  // lookup maps
  const tentById = Object.fromEntries(allTents.map(t => [t.id, t]));
  const neighborhoodById = Object.fromEntries(allNeighborhoods.map(n => [n.id, n]));
  const spaceById = Object.fromEntries(allActivitySpaces.map(s => [s.id, s]));

  // global diets from profile
  const globalDiets = profile ? safeJson(profile.special_diets, {}) : {};
  const hasLifeThreat = Number(globalDiets.lifeThreatening_count) > 0;
  const hasDiets = DIET_LABELS.some(d => Number(globalDiets[d.key]) > 0) || globalDiets.diet_notes;

  // date range
  const startDate = group.arrival_date;
  const endDate = group.departure_date || group.arrival_date;
  let days = [];
  try {
    days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });
  } catch {
    days = [];
  }

  // confirmed allocations only
  const confirmedAllocations = sleepingAllocations.filter(a => a.status === "CONFIRMED");
  const activeMeals = mealReservations.filter(m => m.status === "ACTIVE");
  const activeActivities = scheduleItems.filter(s => s.status === "ACTIVE");
  const hasConfirmedSleeping = confirmedAllocations.length > 0;

  const generatedAt = format(new Date(), "dd/MM/yyyy HH:mm");

  // group sleeping allocations by neighborhood per day
  function getAllocsForDay(dateStr) {
    return confirmedAllocations.filter(a => {
      const arrivalOk = a.arrival_date <= dateStr;
      const departureOk = a.departure_date > dateStr;
      return arrivalOk && departureOk;
    });
  }

  function getMealsForDay(dateStr) {
    return [...activeMeals.filter(m => m.date === dateStr)]
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  }

  function getActivitiesForDay(dateStr) {
    return [...activeActivities.filter(s => s.date === dateStr)]
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  }

  function getCoffeeForDay(dateStr) {
    return [...coffeeRequests.filter(r => r.date === dateStr)]
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  }

  // group allocs by neighborhood, sorted by neighborhood sort_order then tent code
  function groupAllocsByNeighborhood(allocs) {
    const map = {};
    allocs.forEach(a => {
      const nid = a.neighborhood_id || "unknown";
      if (!map[nid]) map[nid] = [];
      map[nid].push(a);
    });
    // Sort tents within each neighborhood naturally by tent code
    Object.values(map).forEach(arr => {
      arr.sort((a, b) => {
        const ca = tentById[a.tent_id]?.code || "";
        const cb = tentById[b.tent_id]?.code || "";
        return ca.localeCompare(cb, "he", { numeric: true });
      });
    });
    return map;
  }

  // Sort neighborhoods by sort_order
  function sortedNeighborhoodEntries(map) {
    return Object.entries(map).sort(([nidA], [nidB]) => {
      const sA = neighborhoodById[nidA]?.sort_order ?? 999;
      const sB = neighborhoodById[nidB]?.sort_order ?? 999;
      return sA - sB;
    });
  }

  // All confirmed student allocations for the name-assignment page
  const studentAllocations = confirmedAllocations
    .filter(a => a.allocation_type === "STUDENT")
    .sort((a, b) => {
      const sA = neighborhoodById[a.neighborhood_id]?.sort_order ?? 999;
      const sB = neighborhoodById[b.neighborhood_id]?.sort_order ?? 999;
      if (sA !== sB) return sA - sB;
      const ca = tentById[a.tent_id]?.code || "";
      const cb = tentById[b.tent_id]?.code || "";
      return ca.localeCompare(cb, "he", { numeric: true });
    });

  return (
    <>
      {/* Inline styles for print */}
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

        body, html {
          direction: rtl;
          font-family: 'SimplerPro', 'Arial Hebrew', Arial, sans-serif;
          font-size: 13px;
          background: #f8f9fa;
          color: #1e293b;
        }

        .print-page {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 24px 28px;
        }

        /* ── Header ─────────────────────────────────────────────────── */
        .doc-header {
          border-bottom: 3px solid #1e40af;
          padding-bottom: 16px;
          margin-bottom: 20px;
        }
        .doc-title {
          font-size: 22px;
          font-weight: 700;
          color: #1e40af;
          margin-bottom: 6px;
          font-family: 'Kav16', 'Arial Hebrew', Arial, sans-serif;
        }
        .doc-group-name {
          font-size: 18px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 4px;
          font-family: 'Kav16', 'Arial Hebrew', Arial, sans-serif;
        }
        .doc-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 8px;
          font-size: 12px;
          color: #64748b;
        }
        .doc-meta span { display: flex; align-items: center; gap: 4px; }
        .doc-generated {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 6px;
        }

        /* ── Global Allergy Warning ──────────────────────────────────── */
        .global-allergy-warning {
          background: #fef2f2;
          border: 2px solid #dc2626;
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 16px;
          font-weight: 700;
          font-size: 14px;
          color: #dc2626;
        }

        /* ── Diet Summary ────────────────────────────────────────────── */
        .diet-section {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 20px;
        }
        .diet-section-title {
          font-size: 13px;
          font-weight: 700;
          color: #475569;
          margin-bottom: 8px;
        }
        .diet-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .diet-chip {
          background: #e2e8f0;
          border-radius: 20px;
          padding: 3px 10px;
          font-size: 12px;
          color: #334155;
        }
        .diet-chip-critical {
          background: #fef2f2;
          border: 1px solid #dc2626;
          color: #dc2626;
          font-weight: 700;
        }

        /* ── Day Section ─────────────────────────────────────────────── */
        .day-section {
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        .day-header {
          background: #1e40af;
          color: white;
          padding: 8px 14px;
          border-radius: 8px 8px 0 0;
          font-size: 14px;
          font-weight: 700;
          border-bottom: 2px solid #1d4ed8;
        }
        .day-body {
          border: 1px solid #e2e8f0;
          border-top: none;
          border-radius: 0 0 8px 8px;
          overflow: hidden;
        }

        /* ── Sub-section ─────────────────────────────────────────────── */
        .sub-section {
          padding: 12px 14px;
          border-bottom: 1px solid #e2e8f0;
        }
        .sub-section:last-child { border-bottom: none; }
        .sub-title {
          font-size: 12px;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 8px;
        }

        /* ── Neighborhood ────────────────────────────────────────────── */
        .neighborhood-block {
          margin-bottom: 12px;
        }
        .neighborhood-label {
          font-size: 12px;
          font-weight: 700;
          color: #334155;
          margin-bottom: 6px;
          padding: 3px 8px;
          background: #f1f5f9;
          border-radius: 4px;
          display: inline-block;
        }
        .tents-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .no-sleeping {
          font-size: 12px;
          color: #94a3b8;
          font-style: italic;
          padding: 6px 0;
        }

        /* ── Tent Card ───────────────────────────────────────────────── */
        .tent-card {
          border: 1px solid #94a3b8;
          border-radius: 8px;
          overflow: hidden;
          width: 90px;
          page-break-inside: avoid;
          text-align: center;
        }
        .tent-card-vip {
          border-color: #a78bfa;
        }
        .tent-header {
          background: #334155;
          color: white;
          text-align: center;
          padding: 4px 6px;
          font-size: 11px;
          font-weight: 700;
        }
        .tent-header.vip {
          background: #7c3aed;
        }
        .tent-body {
          padding: 6px 4px 5px;
          background: white;
        }
        .tent-pax {
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;
        }
        .tent-pax-label {
          font-size: 10px;
          color: #94a3b8;
        }

        /* ── Coffee Card ─────────────────────────────────────────────── */
        .coffee-card {
          background: #fffbeb;
          border: 1px solid #fde68a;
          border-right: 4px solid #d97706;
          border-radius: 0 8px 8px 0;
          padding: 8px 12px;
          margin-bottom: 6px;
          page-break-inside: avoid;
        }
        .coffee-date {
          font-size: 12px;
          font-weight: 700;
          color: #92400e;
          margin-bottom: 2px;
        }
        .coffee-time {
          font-size: 12px;
          color: #78350f;
          font-weight: 600;
          direction: ltr;
          display: inline-block;
          margin-bottom: 2px;
        }
        .coffee-type {
          font-size: 12px;
          color: #92400e;
          font-weight: 600;
        }
        .coffee-location {
          font-size: 12px;
          color: #475569;
        }
        .coffee-pax {
          font-size: 12px;
          color: #475569;
        }
        .coffee-notes {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 3px;
        }

        /* ── Name Assignment Page ────────────────────────────────────── */
        .name-assignment-page {
          page-break-before: always;
          margin-top: 32px;
        }
        .name-page-title {
          font-size: 18px;
          font-weight: 700;
          color: #1e40af;
          border-bottom: 2px solid #1e40af;
          padding-bottom: 8px;
          margin-bottom: 6px;
        }
        .name-page-subtitle {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 16px;
        }
        .name-cards-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .name-card {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          overflow: hidden;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .name-card-header {
          background: #334155;
          color: white;
          padding: 5px 10px;
          font-size: 12px;
          font-weight: 700;
          display: flex;
          justify-content: space-between;
        }
        .name-card-subcount {
          font-size: 11px;
          font-weight: 400;
          opacity: 0.8;
        }
        .name-card-body {
          padding: 6px 10px 8px;
          background: white;
        }
        .name-line {
          display: flex;
          align-items: center;
          gap: 6px;
          border-bottom: 1px solid #e2e8f0;
          padding: 4px 0;
          font-size: 12px;
          color: #64748b;
          min-height: 22px;
        }
        .name-line:last-child { border-bottom: none; }
        .name-line-num {
          min-width: 18px;
          font-size: 11px;
          color: #94a3b8;
          text-align: left;
        }
        .name-line-blank {
          flex: 1;
          border-bottom: 1px solid #cbd5e1;
          margin-bottom: 1px;
        }

        /* ── Meal Card ───────────────────────────────────────────────── */
        .meal-card {
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 8px;
          page-break-inside: avoid;
        }
        .meal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        .meal-type {
          font-weight: 700;
          font-size: 14px;
          color: #15803d;
        }
        .meal-time {
          font-size: 12px;
          color: #4ade80;
          font-weight: 600;
          direction: ltr;
        }
        .meal-pax {
          font-size: 12px;
          color: #166534;
          margin-bottom: 4px;
        }
        .allergy-critical {
          background: #dc2626;
          color: white;
          font-weight: 700;
          font-size: 12px;
          border-radius: 4px;
          padding: 3px 8px;
          margin: 4px 0;
          display: inline-block;
        }
        .diet-row {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 4px;
        }
        .diet-badge {
          background: white;
          border: 1px solid #86efac;
          border-radius: 12px;
          padding: 1px 8px;
          font-size: 11px;
          color: #166534;
        }
        .meal-notes {
          font-size: 11px;
          color: #4ade80;
          margin-top: 4px;
        }

        /* ── Activity Card ───────────────────────────────────────────── */
        .activity-card {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-right: 4px solid #1e40af;
          border-radius: 0 8px 8px 0;
          padding: 8px 12px;
          margin-bottom: 6px;
          page-break-inside: avoid;
        }
        .activity-time {
          font-size: 12px;
          font-weight: 700;
          color: #1e40af;
          direction: ltr;
          display: inline-block;
          margin-bottom: 2px;
        }
        .activity-name {
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 3px;
        }
        .activity-location {
          font-size: 12px;
          color: #475569;
        }
        .activity-pax {
          font-size: 12px;
          color: #64748b;
          margin-top: 2px;
        }
        .activity-equipment {
          font-size: 11px;
          color: #1d4ed8;
          font-weight: 600;
          margin-top: 3px;
        }
        .activity-notes {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 3px;
        }
        .activity-shared {
          margin-top: 5px;
          padding: 4px 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .shared-label {
          font-size: 11px;
          font-weight: 700;
          color: #475569;
        }
        .shared-line {
          font-size: 11px;
          color: #64748b;
        }

        /* ── Print Controls ──────────────────────────────────────────── */
        .print-controls {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }
        .btn-print {
          background: #1e40af;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 9px 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }
        .btn-print:hover { background: #1d4ed8; }
        .btn-back {
          background: white;
          color: #1e40af;
          border: 2px solid #1e40af;
          border-radius: 8px;
          padding: 9px 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
        }
        .btn-back:hover { background: #eff6ff; }

        /* ── Print Media ─────────────────────────────────────────────── */
        @media print {
          body { background: white; font-size: 12px; }
          .print-controls { display: none !important; }
          .print-page { padding: 10px 14px; }
          .day-section { page-break-inside: avoid; }
          .tent-card, .meal-card, .activity-card, .coffee-card { page-break-inside: avoid; }
          .name-card { break-inside: avoid; page-break-inside: avoid; }
          .name-assignment-page { page-break-before: always; }
          @page { size: A4; margin: 15mm 12mm; }
        }

        @media (max-width: 600px) {
          .print-page { padding: 14px 12px; }
          .print-controls { flex-direction: column; }
          .btn-print, .btn-back { width: 100%; justify-content: center; padding: 12px 16px; font-size: 15px; }
          .tents-row { gap: 6px; }
          .tent-card { width: 80px; }
          .doc-title { font-size: 18px; }
          .doc-group-name { font-size: 15px; }
          .day-header { font-size: 13px; }
          .sub-section { padding: 10px 10px; }
          .meal-card { padding: 8px 10px; }
          .activity-card { padding: 8px 10px; }
          .doc-meta { gap: 8px; font-size: 11px; }
          .name-cards-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="print-page" dir="rtl">

        {/* Print controls */}
        <div className="print-controls">
          <button className="btn-print" onClick={() => window.print()}>
            🖨 הדפס / שמור כ-PDF
          </button>
          <Link to={`/groups/${id}`} className="btn-back">
            ← חזרה לקבוצה
          </Link>
        </div>

        {/* Header */}
        <div className="doc-header">
          <div className="doc-title">סיכום תפעולי לקבוצה — {group.group_name}</div>
          <div className="doc-group-name">{group.group_name}</div>
          <div className="doc-meta">
            <span>📅 {fmtDate(startDate)}{endDate !== startDate ? ` — ${fmtDate(endDate)}` : ""}</span>
            <span>🏕️ {GROUP_TYPE_LABELS[group.group_type] || group.group_type}</span>
            {group.total_pax > 0 && <span>👥 סה"כ {group.total_pax} משתתפים</span>}
            {group.participant_count > 0 && <span>🎒 חניכים: {group.participant_count}</span>}
            {group.staff_count > 0 && <span>👤 צוות: {group.staff_count}</span>}
            {group.boys_count > 0 && <span>👦 בנים: {group.boys_count}</span>}
            {group.girls_count > 0 && <span>👧 בנות: {group.girls_count}</span>}
            {group.contact_name && <span>📞 {group.contact_name}{group.contact_phone ? ` · ${group.contact_phone}` : ""}</span>}
          </div>
          <div className="doc-generated">הופק: {generatedAt}</div>
        </div>

        {/* Global Life-threatening allergy banner */}
        {hasLifeThreat && (
          <div className="global-allergy-warning">
            ⚠ אלרגיות מסכנות חיים: {Number(globalDiets.lifeThreatening_count)} — נדרש תיאום עם צוות מטבח!
          </div>
        )}

        {/* Global dietary summary */}
        {hasDiets && (
          <div className="diet-section">
            <div className="diet-section-title">🥗 צרכים תזונתיים ואלרגיות — סיכום כללי</div>
            <div className="diet-grid">
              {DIET_LABELS.map(({ key, label, critical }) => {
                const count = Number(globalDiets[key]) || 0;
                if (!count) return null;
                return (
                  <span key={key} className={`diet-chip ${critical ? "diet-chip-critical" : ""}`}>
                    {critical && "⚠ "}{label}: {count}
                  </span>
                );
              })}
              {globalDiets.diet_notes && (
                <span className="diet-chip">הערות: {globalDiets.diet_notes}</span>
              )}
            </div>
          </div>
        )}

        {/* Daily sections */}
        {days.map(day => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayLabel = fmtDate(dateStr);
          const allocsForDay = getAllocsForDay(dateStr);
          const mealsForDay = getMealsForDay(dateStr);
          const activitiesForDay = getActivitiesForDay(dateStr);

          const hasAnything = allocsForDay.length > 0 || mealsForDay.length > 0 || activitiesForDay.length > 0;
          if (!hasAnything && days.length > 1) {
            // still show the day but with a message
          }

          const allocsByNeighborhood = groupAllocsByNeighborhood(allocsForDay);
          const coffeeForDay = getCoffeeForDay(dateStr);

          return (
            <div key={dateStr} className="day-section">
              <div className="day-header">{dayLabel}</div>
              <div className="day-body">

                {/* Sleeping */}
                {group.group_type === "LODGING" && (
                  <div className="sub-section">
                    <div className="sub-title">🛏 לינה</div>
                    {allocsForDay.length === 0 ? (
                      <div className="no-sleeping">שיבוץ לינה טרם אושר</div>
                    ) : (
                      sortedNeighborhoodEntries(allocsByNeighborhood).map(([nid, allocs]) => {
                        const neighborhood = neighborhoodById[nid];
                        const isVipNeighborhood = neighborhood?.is_vip;
                        return (
                          <div key={nid} className="neighborhood-block">
                            <div className="neighborhood-label">
                              {isVipNeighborhood ? "אוהלי VIP" : (neighborhood?.name || "שכונה")}
                            </div>
                            <div className="tents-row">
                              {allocs.map(a => (
                                <TentCard
                                  key={a.id}
                                  allocation={a}
                                  tent={tentById[a.tent_id]}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Meals */}
                {mealsForDay.filter(m => m.meal_type !== "COFFEE_CORNER").length > 0 && (
                  <div className="sub-section">
                    <div className="sub-title">🍽 ארוחות</div>
                    {mealsForDay.filter(m => m.meal_type !== "COFFEE_CORNER").map(m => (
                      <MealCard key={m.id} meal={m} profileDiets={globalDiets && Object.keys(globalDiets).length > 0 ? globalDiets : null} />
                    ))}
                  </div>
                )}

                {/* Coffee Corner */}
                {coffeeForDay.length > 0 && (
                  <div className="sub-section">
                    <div className="sub-title">☕ פינת קפה</div>
                    {coffeeForDay.map(req => (
                      <CoffeeCard key={req.id} req={req} />
                    ))}
                  </div>
                )}

                {/* Activities */}
                {activitiesForDay.length > 0 && (
                  <div className="sub-section">
                    <div className="sub-title">⚡ פעילויות</div>
                    {activitiesForDay.map(item => (
                      <ActivityCard
                        key={item.id}
                        item={item}
                        space={item.activity_space_id ? spaceById[item.activity_space_id] : null}
                      />
                    ))}
                  </div>
                )}

                {/* Empty day fallback */}
                {allocsForDay.length === 0 && mealsForDay.filter(m => m.meal_type !== "COFFEE_CORNER").length === 0 && coffeeForDay.length === 0 && activitiesForDay.length === 0 && (
                  <div className="sub-section">
                    <div style={{ fontSize: 12, color: "#94a3b8", fontStyle: "italic" }}>אין פעילויות מתוכננות ליום זה</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* ── Student Name Assignment Page ───────────────────────────────── */}
        {studentAllocations.length > 0 && (
          <div className="name-assignment-page">
            <div className="name-page-title">טופס חלוקת חניכים לאוהלים</div>
            <div className="name-page-subtitle">
              ניתן להדפיס ולמלא את שמות החניכים לפי האוהלים שהוקצו לקבוצה.
            </div>
            <div className="name-cards-grid">
              {studentAllocations.map(a => {
                const tent = tentById[a.tent_id];
                const neighborhood = neighborhoodById[a.neighborhood_id];
                const tentCode = tent?.code || "—";
                const pax = getPax(a);
                const lineCount = pax != null ? Math.max(1, pax) : 1;
                return (
                  <div key={a.id} className="name-card">
                    <div className="name-card-header">
                      <span>{neighborhood?.name || "שכונה"} | אוהל {tentCode}</span>
                      {pax != null && <span className="name-card-subcount">{pax} חניכים</span>}
                    </div>
                    <div className="name-card-body">
                      {Array.from({ length: lineCount }).map((_, i) => (
                        <div key={i} className="name-line">
                          <span className="name-line-num">{i + 1}.</span>
                          <span className="name-line-blank" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </>
  );
}