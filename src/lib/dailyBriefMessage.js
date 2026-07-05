// Deterministic WhatsApp message builder for the Daily Staff Brief.
// NO AI. Pure string formatting from auto_summary_json + manual fields.
// Manual notes are inserted as the manager wrote them (only trimmed / bulleted).

import { format } from "date-fns";
import { he } from "date-fns/locale";

function displayDate(dateStr) {
  try {
    return format(new Date(dateStr + "T00:00:00"), "EEEE, d בMMMM yyyy", { locale: he });
  } catch (_e) {
    return dateStr;
  }
}

// Split a free-text manual block into clean bullet lines
function bulletize(text) {
  if (!text) return [];
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => (l.startsWith("-") || l.startsWith("•") ? l.replace(/^[-•]\s*/, "") : l))
    .map((l) => `- ${l}`);
}

function timeRange(start, end) {
  if (start && end) return `${start}–${end}`;
  if (start) return start;
  if (end) return end;
  return "";
}

function dietLines(diets) {
  if (!diets || typeof diets !== "object") return [];
  const MAP = {
    vegetarian_count: "צמחונים",
    vegan_count: "טבעונים",
    glutenFree_count: "ללא גלוטן",
    lifeThreatening_count: "אלרגיה מסכנת חיים",
    nutFree_count: "ללא אגוזים",
    eggFree_count: "ללא ביצים",
    lactoseFree_count: "ללא לקטוז",
  };
  const out = [];
  for (const key of Object.keys(MAP)) {
    const v = diets[key];
    if (v && Number(v) > 0) out.push(`${MAP[key]}: ${v}`);
  }
  return out;
}

/**
 * Build the WhatsApp-ready message string.
 * @param {object} summary parsed auto_summary_json (may be null)
 * @param {object} manual manual_* fields
 * @param {string} dateStr YYYY-MM-DD
 */
export function buildDailyBriefMessage(summary, manual, dateStr) {
  const lines = [];
  const push = (s = "") => lines.push(s);

  push(`משימות להיום — ${displayDate(dateStr)}`);

  // ── דגשים ידניים ──────────────────────────────────────────────────────
  const general = bulletize(manual.manual_general_notes);
  if (general.length) {
    push("");
    push("*דגשים ידניים:*");
    general.forEach(push);
  }

  // ── מידע מהמערכת ──────────────────────────────────────────────────────
  if (summary) {
    push("");
    push("*מידע מהמערכת:*");

    // Groups
    const g = summary.groups || {};
    const groupLines = [];
    (g.arrivals || []).forEach((a) => {
      groupLines.push(`נכנסת: ${a.name}${a.arrival_time ? ` (${a.arrival_time})` : ""}${a.pax ? ` — ${a.pax} משתתפים` : ""}`);
    });
    (g.departures || []).forEach((d) => {
      groupLines.push(`יוצאת: ${d.name}${d.departure_time ? ` (${d.departure_time})` : ""}`);
    });
    (g.day_use || []).forEach((d) => {
      groupLines.push(`באי יום: ${d.name}${timeRange(d.arrival_time, d.departure_time) ? ` (${timeRange(d.arrival_time, d.departure_time)})` : ""}${d.pax ? ` — ${d.pax}` : ""}`);
    });
    (g.sleeping || []).forEach((s) => {
      groupLines.push(`לנים: ${s.name}${s.pax ? ` — ${s.pax}` : ""}`);
    });
    if (groupLines.length) {
      push("");
      push("קבוצות היום:");
      groupLines.forEach((l) => push(`- ${l}`));
    }

    // Meals — ALWAYS shown if they exist
    if ((summary.meals || []).length) {
      push("");
      push("ארוחות:");
      summary.meals.forEach((m) => {
        const tr = timeRange(m.start_time, m.end_time);
        push(`- ${m.label}${tr ? ` — ${tr}` : ""}${m.pax != null ? ` — ${m.pax} משתתפים` : ""} (${m.group})`);
        dietLines(m.diets).forEach((d) => push(`  • ${d}`));
      });
    }

    // Coffee corner
    if ((summary.coffee_corner || []).length) {
      push("");
      push("פינות קפה:");
      summary.coffee_corner.forEach((c) => {
        const tr = timeRange(c.start_time, c.end_time);
        const parts = [c.group];
        if (tr) parts.push(tr);
        if (c.location) parts.push(c.location);
        if (c.pax != null) parts.push(`${c.pax} א׳`);
        push(`- ${parts.join(" — ")}${c.type ? ` (${c.type})` : ""}`);
      });
    }

    // Prisa
    if ((summary.prisa || []).length) {
      push("");
      push("פריסה:");
      summary.prisa.forEach((p) => {
        const parts = [p.group];
        if (p.slot) parts.push(p.slot);
        if (p.quantity != null) parts.push(`כמות ${p.quantity}`);
        if (p.type) parts.push(p.type);
        push(`- ${parts.join(" — ")}`);
      });
    }

    // Activity spaces needing attention
    if ((summary.activity_spaces || []).length) {
      push("");
      push("מרחבי פעילות שדורשים תשומת לב:");
      summary.activity_spaces.forEach((s) => {
        const tr = timeRange(s.first_use, s.last_use);
        push(`- ${s.space_name}${tr ? ` — ${tr}` : ""} (${s.activity_count} פעילויות)`);
        if (s.groups && s.groups.length) push(`  • קבוצות: ${s.groups.join(", ")}`);
        if (s.equipment && s.equipment.length) push(`  • ציוד: ${s.equipment.join(", ")}`);
        (s.recommendations || []).forEach((r) => push(`  • ${r}`));
      });
    }

    // Open maintenance
    if ((summary.maintenance || []).length) {
      push("");
      push("תחזוקה פתוחה:");
      summary.maintenance.forEach((m) => {
        const parts = [];
        if (m.location) parts.push(m.location);
        if (m.title) parts.push(m.title);
        if (m.priority) parts.push(`(${m.priority})`);
        push(`- ${parts.join(" — ")}`);
      });
    }
  }

  // ── משימות ידניות ─────────────────────────────────────────────────────
  const manualSections = [
    { label: "לוגיסטיקה", value: manual.manual_logistics_tasks },
    { label: "משק בית", value: manual.manual_housekeeping_tasks },
    { label: "תחזוקה", value: manual.manual_maintenance_tasks },
    { label: "תורנים / מדריכים", value: manual.manual_duty_students_notes },
  ];
  const mealsManual = bulletize(manual.manual_meals_notes);
  const spacesManual = bulletize(manual.manual_activity_spaces_notes);

  const anyManualTasks =
    manualSections.some((s) => bulletize(s.value).length) || mealsManual.length || spacesManual.length;

  if (anyManualTasks) {
    push("");
    push("*משימות ידניות:*");

    if (mealsManual.length) {
      push("");
      push("ארוחות / חדר אוכל:");
      mealsManual.forEach(push);
    }
    if (spacesManual.length) {
      push("");
      push("מרחבי פעילות:");
      spacesManual.forEach(push);
    }
    manualSections.forEach((s) => {
      const b = bulletize(s.value);
      if (b.length) {
        push("");
        push(`${s.label}:`);
        b.forEach(push);
      }
    });
  }

  // ── הערות ─────────────────────────────────────────────────────────────
  const finalNotes = bulletize(manual.manual_final_notes);
  if (finalNotes.length) {
    push("");
    push("*הערות:*");
    finalNotes.forEach(push);
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}