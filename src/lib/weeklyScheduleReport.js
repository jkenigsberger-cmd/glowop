import { ROW_TYPES, DAY_NAMES, addDays, fmtDM } from "@/lib/workScheduleConfig";

const esc = (value = "") => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const reportStatusLabel = (schedule) => schedule?.status === "PUBLISHED" ? "פורסם" : "טיוטה — לא פורסם";
export const weekRangeLabel = (weekStart) => `${fmtDM(weekStart)}–${fmtDM(addDays(weekStart, 6))}`;

const timeRange = (start, end) => {
  if (start && end) return `${start}–${end}`;
  return start || end || "";
};

const namedShiftLine = (shift) => [
  shift.worker_name || "—",
  timeRange(shift.start_time, shift.end_time),
  shift.notes || "",
].filter(Boolean).join(" ");

const sectionLines = (row, rowShifts) => {
  if (row.textOnly) return rowShifts.map((s) => s.notes).filter(Boolean);
  if (row.countBased) {
    const total = rowShifts.reduce((sum, s) => sum + Number(s.worker_count || 0), 0);
    return total > 0 ? [`${total} מנקות`] : [];
  }
  return rowShifts.map(namedShiftLine).filter(Boolean);
};

export function buildWeeklyScheduleReportData(schedule, shifts, weekStart) {
  const planned = shifts.filter((s) => s.work_schedule_id === schedule?.id && s.status === "PLANNED");
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const sections = ROW_TYPES.map((row) => {
      const rowShifts = planned
        .filter((s) => s.date === date && s.row_type === row.type)
        .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
      return { type: row.type, label: row.label, order: row.order, lines: sectionLines(row, rowShifts) };
    }).filter((section) => section.lines.length > 0)
      .sort((a, b) => a.order - b.order);
    return { date, dayName: DAY_NAMES[i], dateLabel: fmtDM(date), sections };
  });
  return { title: "דוח סידור עבודה שבועי", whatsappTitle: "סידור עבודה שבועי", range: weekRangeLabel(weekStart), status: reportStatusLabel(schedule), days };
}

export function generateWeeklyScheduleText(schedule, shifts, weekStart) {
  const data = buildWeeklyScheduleReportData(schedule, shifts, weekStart);
  const blocks = [`${data.whatsappTitle}\n${data.range}\n${data.status}`];
  data.days.forEach((day) => {
    const lines = [`${day.dayName} ${day.dateLabel}`];
    if (day.sections.length === 0) lines.push("אין משמרות מתוכננות");
    day.sections.forEach((section) => lines.push(`${section.label}:`, ...section.lines, ""));
    blocks.push(lines.join("\n").trim());
  });
  return blocks.join("\n\n--------------------\n\n");
}

export function generateWeeklySchedulePrintHtml(schedule, shifts, weekStart) {
  const data = buildWeeklyScheduleReportData(schedule, shifts, weekStart);
  const daysHtml = data.days.map((day) => `
    <section class="day-card">
      <h2>${esc(day.dayName)} <span>${esc(day.dateLabel)}</span></h2>
      ${day.sections.length === 0 ? `<p class="empty">אין משמרות מתוכננות</p>` : day.sections.map((section) => `
        <div class="section"><h3>${esc(section.label)}</h3>${section.lines.map((line) => `<div class="line">${esc(line)}</div>`).join("")}</div>
      `).join("")}
    </section>
  `).join("");
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8" />
    <title>${esc(data.title)}</title><style>
      @page { size: A4 portrait; margin: 12mm; }
      body { margin: 0; font-family: Arial, sans-serif; color: #0f172a; direction: rtl; }
      header { border-bottom: 2px solid #1d4ed8; padding-bottom: 10px; margin-bottom: 12px; }
      h1 { margin: 0 0 4px; font-size: 22px; } .meta { color: #475569; font-size: 13px; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .day-card { break-inside: avoid; border: 1px solid #dbe3ef; border-radius: 10px; padding: 9px; }
      h2 { margin: 0 0 6px; font-size: 15px; color: #1e3a8a; } h2 span { font-weight: normal; color: #64748b; }
      .section { margin-top: 7px; } h3 { margin: 0 0 3px; font-size: 12px; color: #334155; }
      .line, .empty { font-size: 12px; line-height: 1.45; white-space: pre-wrap; } .empty { color: #94a3b8; }
    </style></head><body><header><h1>${esc(data.title)}</h1><div class="meta">${esc(data.range)} · ${esc(data.status)}</div></header><main class="grid">${daysHtml}</main></body></html>`;
}