import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { he } from "date-fns/locale";

// ── constants ──────────────────────────────────────────────────────────────
const MEAL_ORDER  = { BREAKFAST: 0, LUNCH: 1, DINNER: 2, OTHER: 3 };
const MEAL_LABELS = { BREAKFAST: "ארוחת בוקר", LUNCH: "ארוחת צהריים", DINNER: "ארוחת ערב", OTHER: "אחר" };

const DIET_FIELDS = [
  { key: "vegetarian_count",      label: "צמחונים" },
  { key: "vegan_count",           label: "טבעונים" },
  { key: "glutenFree_count",      label: "ללא גלוטן" },
  { key: "lactoseFree_count",     label: "ללא לקטוז" },
  { key: "eggFree_count",         label: "ללא ביצים" },
  { key: "nutFree_count",         label: "ללא אגוזים" },
  { key: "mehadrinKosher_count",  label: "מהדרין / כשרות מיוחדת" },
];

// ── helpers ────────────────────────────────────────────────────────────────
function safeJson(raw, fallback = {}) {
  try {
    const r = typeof raw === "string" ? JSON.parse(raw) : raw;
    return r ?? fallback;
  } catch {
    return fallback;
  }
}

function fmtDate(dateStr) {
  try { return format(parseISO(dateStr), "EEEE, d בMMMM yyyy", { locale: he }); }
  catch { return dateStr; }
}

function fmtShort(dateStr) {
  try { return format(parseISO(dateStr), "dd/MM/yyyy"); }
  catch { return dateStr; }
}

/** Merge diet objects by summing each numeric key */
function mergeDiets(dietObjects) {
  const result = {};
  const notesList = [];
  for (const d of dietObjects) {
    if (!d) continue;
    [...DIET_FIELDS.map(f => f.key), "lifeThreatening_count"].forEach(k => {
      result[k] = (result[k] || 0) + (Number(d[k]) || 0);
    });
    if (d.diet_notes?.trim()) notesList.push(d.diet_notes.trim());
  }
  if (notesList.length) result.diet_notes = notesList.join(" | ");
  return result;
}

/** Get the effective diets object for a meal, matching Kitchen page logic */
function getMealDiets(meal, profileMap) {
  return (
    safeJson(meal.special_diets_summary, null) ||
    safeJson(profileMap[meal.group_id]?.special_diets, null) ||
    {}
  );
}

// ── main ────────────────────────────────────────────────────────────────────
export default function KitchenReport() {
  const [searchParams] = useSearchParams();
  const startDate = searchParams.get("from") || "";
  const endDate   = searchParams.get("to")   || startDate;

  // data
  const { data: allMeals = [], isLoading } = useQuery({
    queryKey: ["mealReservations_kitchenReport"],
    queryFn: () => base44.entities.MealReservation.filter({ status: "ACTIVE" }),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["groups_kitchenReport"],
    queryFn: () => base44.entities.Group.list(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_kitchenReport"],
    queryFn: () => base44.entities.OperationalGroupProfile.list(),
  });

  const groupMap = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups]);
  const profileMap = useMemo(() => Object.fromEntries(profiles.map(p => [p.group_id, p])), [profiles]);

  // Meals in date range (inclusive)
  const rangeMeals = useMemo(() => {
    if (!startDate) return [];
    return allMeals
      .filter(m => m.date >= startDate && m.date <= endDate)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        const typeCmp = (MEAL_ORDER[a.meal_type] ?? 99) - (MEAL_ORDER[b.meal_type] ?? 99);
        return typeCmp !== 0 ? typeCmp : (a.start_time || "").localeCompare(b.start_time || "");
      });
  }, [allMeals, startDate, endDate]);

  // ── aggregate totals ──────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const byType = { BREAKFAST: 0, LUNCH: 0, DINNER: 0, OTHER: 0 };
    let totalPax = 0, sandwichCount = 0, sandwichPax = 0;
    const allDietObjects = [];

    rangeMeals.forEach(m => {
      const pax = Number(m.pax) || 0;
      totalPax += pax;
      byType[m.meal_type || "OTHER"] = (byType[m.meal_type || "OTHER"] || 0) + pax;
      if (m.sandwich_option) { sandwichCount++; sandwichPax += pax; }
      allDietObjects.push(getMealDiets(m, profileMap));
    });

    const mergedDiets = mergeDiets(allDietObjects);
    const totalSpecialDiets = DIET_FIELDS.reduce((s, f) => s + (Number(mergedDiets[f.key]) || 0), 0);
    const lifeThreatening   = Number(mergedDiets.lifeThreatening_count) || 0;

    return { totalPax, byType, sandwichCount, sandwichPax, mergedDiets, totalSpecialDiets, lifeThreatening };
  }, [rangeMeals, profileMap]);

  // ── days in range ─────────────────────────────────────────────────────────
  const days = useMemo(() => {
    if (!startDate || !endDate) return [];
    try {
      return eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });
    } catch { return []; }
  }, [startDate, endDate]);

  const generatedAt = format(new Date(), "dd/MM/yyyy HH:mm");

  if (isLoading) {
    return (
      <div style={{ padding: 40, fontFamily: "Arial", direction: "rtl", textAlign: "center" }}>
        <p>טוען נתונים...</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body, html {
          direction: rtl;
          font-family: 'Heebo', 'Arial Hebrew', Arial, sans-serif;
          font-size: 13px;
          background: #f8f9fa;
          color: #1e293b;
        }

        .kr-page {
          max-width: 860px;
          margin: 0 auto;
          background: white;
          padding: 24px 28px;
        }

        /* ── Print controls ─────────────────────────────────────────── */
        .kr-controls {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }
        .kr-btn-print {
          background: #15803d;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 9px 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }
        .kr-btn-print:hover { background: #166534; }
        .kr-btn-back {
          background: white;
          color: #15803d;
          border: 2px solid #15803d;
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
        .kr-btn-back:hover { background: #f0fdf4; }

        /* ── Header ─────────────────────────────────────────────────── */
        .kr-header {
          border-bottom: 3px solid #15803d;
          padding-bottom: 16px;
          margin-bottom: 20px;
        }
        .kr-title {
          font-size: 22px;
          font-weight: 700;
          color: #15803d;
          margin-bottom: 4px;
        }
        .kr-subtitle {
          font-size: 14px;
          color: #475569;
          margin-bottom: 4px;
        }
        .kr-generated {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 6px;
        }

        /* ── Life-threatening banner ─────────────────────────────────── */
        .kr-life-threat {
          background: #fef2f2;
          border: 2px solid #dc2626;
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 20px;
          font-weight: 700;
          font-size: 15px;
          color: #dc2626;
        }

        /* ── Summary cards ───────────────────────────────────────────── */
        .kr-summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }
        .kr-card {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px 14px;
          background: #f8fafc;
          text-align: center;
        }
        .kr-card-value {
          font-size: 28px;
          font-weight: 700;
          color: #1e293b;
          line-height: 1.1;
        }
        .kr-card-label {
          font-size: 11px;
          color: #64748b;
          margin-top: 4px;
        }
        .kr-card-threat .kr-card-value { color: #dc2626; }
        .kr-card-threat { border-color: #fca5a5; background: #fef2f2; }
        .kr-card-sandwich .kr-card-value { color: #92400e; }
        .kr-card-sandwich { border-color: #fde68a; background: #fffbeb; }

        /* ── Section ─────────────────────────────────────────────────── */
        .kr-section {
          margin-bottom: 24px;
        }
        .kr-section-title {
          font-size: 14px;
          font-weight: 700;
          color: #1e293b;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 6px;
          margin-bottom: 12px;
        }

        /* ── Diet chips ──────────────────────────────────────────────── */
        .kr-diet-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .kr-diet-chip {
          background: #e2e8f0;
          border-radius: 20px;
          padding: 4px 12px;
          font-size: 12px;
          color: #334155;
          font-weight: 600;
        }
        .kr-diet-chip-critical {
          background: #fef2f2;
          border: 1px solid #dc2626;
          color: #dc2626;
          font-weight: 700;
        }
        .kr-diet-notes {
          margin-top: 8px;
          font-size: 12px;
          color: #475569;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 6px 10px;
        }

        /* ── Daily table ─────────────────────────────────────────────── */
        .kr-day-section {
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        .kr-day-header {
          background: #15803d;
          color: white;
          padding: 8px 14px;
          border-radius: 8px 8px 0 0;
          font-size: 14px;
          font-weight: 700;
        }
        .kr-day-body {
          border: 1px solid #e2e8f0;
          border-top: none;
          border-radius: 0 0 8px 8px;
          overflow: hidden;
        }
        .kr-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .kr-table th {
          background: #f1f5f9;
          padding: 7px 10px;
          font-weight: 700;
          text-align: right;
          border-bottom: 1px solid #e2e8f0;
          color: #475569;
        }
        .kr-table td {
          padding: 7px 10px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: top;
        }
        .kr-table tr:last-child td { border-bottom: none; }
        .kr-table tr:hover td { background: #f8fafc; }
        .kr-sandwich-badge {
          display: inline-block;
          background: #fef3c7;
          border: 1px solid #f59e0b;
          color: #92400e;
          font-weight: 700;
          border-radius: 4px;
          padding: 1px 6px;
          font-size: 11px;
        }
        .kr-threat-badge {
          display: inline-block;
          background: #dc2626;
          color: white;
          font-weight: 700;
          border-radius: 4px;
          padding: 1px 6px;
          font-size: 11px;
        }
        .kr-no-data {
          font-size: 12px;
          color: #94a3b8;
          font-style: italic;
          padding: 12px;
          text-align: center;
        }

        /* ── Verification table ──────────────────────────────────────── */
        .kr-verify-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }
        .kr-verify-table th {
          background: #f1f5f9;
          padding: 5px 8px;
          font-weight: 700;
          text-align: right;
          border-bottom: 1px solid #e2e8f0;
          color: #64748b;
        }
        .kr-verify-table td {
          padding: 5px 8px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: top;
        }
        .kr-verify-table tr:last-child td { border-bottom: none; }

        /* ── Print media ─────────────────────────────────────────────── */
        @media print {
          body { background: white; font-size: 12px; }
          .kr-controls { display: none !important; }
          .kr-page { padding: 10px 14px; max-width: 100%; }
          .kr-day-section { page-break-inside: avoid; }
          .kr-section { page-break-inside: avoid; }
          @page { size: A4; margin: 15mm 12mm; }
        }

        @media (max-width: 600px) {
          .kr-page { padding: 14px 12px; }
          .kr-controls { flex-direction: column; }
          .kr-btn-print, .kr-btn-back { width: 100%; justify-content: center; padding: 12px 16px; font-size: 15px; }
          .kr-summary-grid { grid-template-columns: repeat(2, 1fr); }
          .kr-title { font-size: 18px; }
        }
      `}</style>

      <div className="kr-page" dir="rtl">

        {/* Controls */}
        <div className="kr-controls">
          <button className="kr-btn-print" onClick={() => window.print()}>
            🖨 הדפס / שמור כ-PDF
          </button>
          <Link to="/kitchen" className="kr-btn-back">
            ← חזרה למטבח
          </Link>
        </div>

        {/* Header */}
        <div className="kr-header">
          <div className="kr-title">🍽 דוח הכנות מטבח</div>
          <div className="kr-subtitle">
            מתאריך <strong>{fmtShort(startDate)}</strong> עד תאריך <strong>{fmtShort(endDate)}</strong>
          </div>
          <div className="kr-generated">הופק: {generatedAt}</div>
        </div>

        {/* Empty state */}
        {rangeMeals.length === 0 ? (
          <div className="kr-no-data" style={{ padding: 40, fontSize: 15 }}>
            🗓 לא נמצאו ארוחות בטווח התאריכים שנבחר
          </div>
        ) : (
          <>
            {/* Life-threatening banner */}
            {totals.lifeThreatening > 0 && (
              <div className="kr-life-threat">
                ⚠ אלרגיות מסכנות חיים: {totals.lifeThreatening} — נדרש תיאום עם צוות מטבח!
              </div>
            )}

            {/* Section 1 — Summary cards */}
            <div className="kr-section">
              <div className="kr-section-title">📊 סיכום כללי לטווח</div>
              <div className="kr-summary-grid">
                <div className="kr-card">
                  <div className="kr-card-value">{rangeMeals.length}</div>
                  <div className="kr-card-label">סה״כ ארוחות</div>
                </div>
                <div className="kr-card">
                  <div className="kr-card-value">{totals.totalPax}</div>
                  <div className="kr-card-label">סה״כ מנות</div>
                </div>
                <div className="kr-card">
                  <div className="kr-card-value">{totals.byType.BREAKFAST || 0}</div>
                  <div className="kr-card-label">מנות בוקר</div>
                </div>
                <div className="kr-card">
                  <div className="kr-card-value">{totals.byType.LUNCH || 0}</div>
                  <div className="kr-card-label">מנות צהריים</div>
                </div>
                <div className="kr-card">
                  <div className="kr-card-value">{totals.byType.DINNER || 0}</div>
                  <div className="kr-card-label">מנות ערב</div>
                </div>
                {(totals.byType.OTHER || 0) > 0 && (
                  <div className="kr-card">
                    <div className="kr-card-value">{totals.byType.OTHER}</div>
                    <div className="kr-card-label">מנות אחר</div>
                  </div>
                )}
                <div className="kr-card kr-card-sandwich">
                  <div className="kr-card-value">{totals.sandwichPax}</div>
                  <div className="kr-card-label">🥪 כריכים (מנות)</div>
                </div>
                <div className="kr-card">
                  <div className="kr-card-value">{totals.totalSpecialDiets}</div>
                  <div className="kr-card-label">דיאטות מיוחדות</div>
                </div>
                <div className="kr-card kr-card-threat">
                  <div className="kr-card-value">{totals.lifeThreatening}</div>
                  <div className="kr-card-label">⚠ אלרגיות קריטיות</div>
                </div>
              </div>
            </div>

            {/* Section 2 — Diet totals */}
            {(totals.totalSpecialDiets > 0 || totals.mergedDiets.diet_notes) && (
              <div className="kr-section">
                <div className="kr-section-title">🥗 סיכום דיאטות מיוחדות — כלל הטווח</div>
                <div className="kr-diet-grid">
                  {DIET_FIELDS.map(f => {
                    const count = Number(totals.mergedDiets[f.key]) || 0;
                    if (!count) return null;
                    return (
                      <span key={f.key} className="kr-diet-chip">
                        {f.label}: {count}
                      </span>
                    );
                  })}
                  {totals.lifeThreatening > 0 && (
                    <span className="kr-diet-chip kr-diet-chip-critical">
                      ⚠ אלרגיות מסכנות חיים: {totals.lifeThreatening}
                    </span>
                  )}
                </div>
                {totals.mergedDiets.diet_notes && (
                  <div className="kr-diet-notes">📝 הערות דיאטה: {totals.mergedDiets.diet_notes}</div>
                )}
              </div>
            )}

            {/* Section 3 — sandwich callout if any */}
            {totals.sandwichCount > 0 && (
              <div className="kr-section">
                <div className="kr-section-title">🥪 כריכים במקום ארוחה רגילה</div>
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                  <strong>{totals.sandwichCount}</strong> ארוחות מסומנות ככריכים — סה״כ <strong>{totals.sandwichPax}</strong> מנות כריכים בטווח זה.
                </div>
              </div>
            )}

            {/* Section 4 — Daily breakdown */}
            <div className="kr-section">
              <div className="kr-section-title">📅 פירוט יומי</div>
              {days.map(day => {
                const dateStr = format(day, "yyyy-MM-dd");
                const dayLabel = fmtDate(dateStr);
                const dayMeals = rangeMeals.filter(m => m.date === dateStr);
                if (dayMeals.length === 0) return null;

                // aggregate for the day
                const dayByType = {};
                dayMeals.forEach(m => {
                  const t = m.meal_type || "OTHER";
                  if (!dayByType[t]) dayByType[t] = { pax: 0, sandwichPax: 0, diets: {}, lifeThreat: 0, notes: [] };
                  dayByType[t].pax += Number(m.pax) || 0;
                  if (m.sandwich_option) dayByType[t].sandwichPax += Number(m.pax) || 0;
                  const d = getMealDiets(m, profileMap);
                  const merged = mergeDiets([dayByType[t].diets, d]);
                  dayByType[t].diets = merged;
                  dayByType[t].lifeThreat = Number(merged.lifeThreatening_count) || 0;
                  if (m.notes?.trim()) dayByType[t].notes.push(m.notes.trim());
                });

                const sortedTypes = Object.keys(dayByType).sort(
                  (a, b) => (MEAL_ORDER[a] ?? 99) - (MEAL_ORDER[b] ?? 99)
                );

                return (
                  <div key={dateStr} className="kr-day-section">
                    <div className="kr-day-header">{dayLabel}</div>
                    <div className="kr-day-body">
                      <table className="kr-table">
                        <thead>
                          <tr>
                            <th>סוג ארוחה</th>
                            <th>סה״כ מנות</th>
                            <th>כריכים</th>
                            <th>דיאטות מיוחדות</th>
                            <th>אלרגיות קריטיות</th>
                            <th>הערות</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedTypes.map(type => {
                            const row = dayByType[type];
                            const specialCount = DIET_FIELDS.reduce((s, f) => s + (Number(row.diets[f.key]) || 0), 0);
                            return (
                              <tr key={type}>
                                <td style={{ fontWeight: 700 }}>
                                  {MEAL_LABELS[type] || type}
                                  {row.sandwichPax > 0 && (
                                    <div>
                                      <span className="kr-sandwich-badge">🥪 כריכים</span>
                                    </div>
                                  )}
                                </td>
                                <td style={{ fontWeight: 700, fontSize: 14 }}>{row.pax}</td>
                                <td>{row.sandwichPax > 0 ? <span className="kr-sandwich-badge">{row.sandwichPax}</span> : "—"}</td>
                                <td>
                                  {specialCount > 0 ? (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                      {DIET_FIELDS.map(f => {
                                        const c = Number(row.diets[f.key]) || 0;
                                        if (!c) return null;
                                        return (
                                          <span key={f.key} style={{ fontSize: 10, background: "#e2e8f0", borderRadius: 10, padding: "1px 6px", color: "#334155" }}>
                                            {f.label}: {c}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  ) : "—"}
                                </td>
                                <td>
                                  {row.lifeThreat > 0
                                    ? <span className="kr-threat-badge">⚠ {row.lifeThreat}</span>
                                    : "—"}
                                </td>
                                <td style={{ fontSize: 11, color: "#475569" }}>
                                  {row.notes.length > 0 ? row.notes.join(" | ") : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Section 5 — Verification breakdown */}
            <div className="kr-section">
              <div className="kr-section-title" style={{ color: "#64748b", fontSize: 12 }}>
                📋 פירוט לפי קבוצות לבדיקה
              </div>
              <table className="kr-verify-table">
                <thead>
                  <tr>
                    <th>תאריך</th>
                    <th>ארוחה</th>
                    <th>קבוצה</th>
                    <th>מנות</th>
                    <th>דיאטות</th>
                    <th>אלרגיות</th>
                    <th>כריכים</th>
                    <th>הערות</th>
                  </tr>
                </thead>
                <tbody>
                  {rangeMeals.map(m => {
                    const groupName = groupMap[m.group_id]?.group_name || "—";
                    const d = getMealDiets(m, profileMap);
                    const specialCount = DIET_FIELDS.reduce((s, f) => s + (Number(d[f.key]) || 0), 0);
                    const lifeThreat   = Number(d.lifeThreatening_count) || 0;
                    return (
                      <tr key={m.id}>
                        <td>{fmtShort(m.date)}</td>
                        <td>{MEAL_LABELS[m.meal_type] || m.meal_type}</td>
                        <td>{groupName}</td>
                        <td style={{ fontWeight: 600 }}>{m.pax || "—"}</td>
                        <td>{specialCount || "—"}</td>
                        <td>
                          {lifeThreat > 0
                            ? <span className="kr-threat-badge">⚠ {lifeThreat}</span>
                            : "—"}
                        </td>
                        <td>{m.sandwich_option ? <span className="kr-sandwich-badge">🥪</span> : "—"}</td>
                        <td style={{ color: "#64748b" }}>{m.notes || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}