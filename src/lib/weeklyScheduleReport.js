import { ROW_TYPES, ROW_BY_TYPE, DAY_NAMES, addDays, fmtDM } from "@/lib/workScheduleConfig";

export const CLEANING_TYPES = new Set(["HOUSEKEEPING_MORNING", "HOUSEKEEPING_EVENING"]);
const NIGHT_TYPE = "NIGHT_ON_CALL";

const esc = (value = "") => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const isCleaning = (shift) => CLEANING_TYPES.has(shift.row_type);
const isWorkerShift = (shift) => !isCleaning(shift) && shift.row_type !== "PLANNED_ACTIVITY" && !(shift.row_type === "SPECIAL_TASKS" && !shift.worker_id) && (shift.worker_name || shift.worker_id);
const rowOrder = (shift) => Number(shift.row_order ?? ROW_BY_TYPE[shift.row_type]?.order ?? 99);

export const reportStatusLabel = (schedule) => schedule?.status === "PUBLISHED" ? "פורסם" : "טיוטה";
export const weekRangeLabel = (weekStart) => `${fmtDM(weekStart)}–${fmtDM(addDays(weekStart, 6))}`;
export const shiftTimeLabel = (shift) => shift.start_time && shift.end_time ? `${shift.start_time}–${shift.end_time}` : (shift.start_time || shift.end_time || "");
export const plannedShiftsForReport = (schedule, shifts) => shifts.filter((s) => s.work_schedule_id === schedule?.id && s.status === "PLANNED");

const shiftSort = (a, b) => a.date.localeCompare(b.date) || rowOrder(a) - rowOrder(b) || (a.start_time || "").localeCompare(b.start_time || "");
const dayMeta = (date) => ({ date, dayName: DAY_NAMES[new Date(date + "T12:00:00").getDay()], dateLabel: fmtDM(date) });
const shiftLabel = (shift) => shift.row_label || ROW_BY_TYPE[shift.row_type]?.label || shift.row_type;

export function groupShiftsByWorker(schedule, shifts) {
  const planned = plannedShiftsForReport(schedule, shifts).filter(isWorkerShift).sort(shiftSort);
  const sourceIds = new Set(planned.filter((s) => s.row_type === "OPERATIONS_EVENING").map((s) => s.id));
  const workers = new Map();

  planned.forEach((shift) => {
    const key = shift.worker_id || shift.worker_name;
    if (!workers.has(key)) workers.set(key, { key, name: shift.worker_name || "ללא שם", shifts: [] });
    workers.get(key).shifts.push({
      ...shift,
      label: shiftLabel(shift),
      time: shiftTimeLabel(shift),
      isNight: shift.row_type === NIGHT_TYPE,
      isLinkedNight: shift.row_type === NIGHT_TYPE && shift.linked_source_shift_id && sourceIds.has(shift.linked_source_shift_id),
    });
  });

  return Array.from(workers.values()).map((worker) => {
    const days = new Map();
    worker.shifts.forEach((shift) => {
      if (!days.has(shift.date)) days.set(shift.date, { ...dayMeta(shift.date), shifts: [] });
      days.get(shift.date).shifts.push(shift);
    });
    const dayList = Array.from(days.values()).map((day) => ({ ...day, shifts: day.shifts.sort(shiftSort) })).sort((a, b) => a.date.localeCompare(b.date));
    const totalShifts = worker.shifts.filter((s) => !s.isLinkedNight).length;
    return { ...worker, days: dayList, firstDate: dayList[0]?.date || "9999-99-99", totalShifts };
  }).sort((a, b) => a.firstDate.localeCompare(b.firstDate) || a.name.localeCompare(b.name, "he"));
}

export function groupCleaningContractorByDay(schedule, shifts, weekStart) {
  const planned = plannedShiftsForReport(schedule, shifts).filter(isCleaning);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const morning = planned.filter((s) => s.date === date && s.row_type === "HOUSEKEEPING_MORNING").reduce((sum, s) => sum + Number(s.worker_count || 0), 0);
    const evening = planned.filter((s) => s.date === date && s.row_type === "HOUSEKEEPING_EVENING").reduce((sum, s) => sum + Number(s.worker_count || 0), 0);
    return { ...dayMeta(date), morning, evening, hasCleaning: morning > 0 || evening > 0 };
  }).filter((day) => day.hasCleaning);
}

export function groupShiftsByDay(schedule, shifts, weekStart) {
  const planned = plannedShiftsForReport(schedule, shifts);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const sections = ROW_TYPES.map((row) => {
      const rowShifts = planned.filter((s) => s.date === date && s.row_type === row.type).sort(shiftSort);
      let lines = [];
      if (row.textOnly) lines = rowShifts.map((s) => s.notes).filter(Boolean);
      else if (row.countBased) {
        const total = rowShifts.reduce((sum, s) => sum + Number(s.worker_count || 0), 0);
        lines = total > 0 ? [`${total} מנקות`] : [];
      } else if (row.type === NIGHT_TYPE) {
        lines = rowShifts.map((s) => s.worker_name || "—");
      } else {
        lines = rowShifts.map((s) => [s.worker_name || "—", shiftTimeLabel(s), s.notes].filter(Boolean).join(" "));
      }
      return { type: row.type, label: row.label, order: row.order, lines };
    }).filter((section) => section.lines.length > 0).sort((a, b) => a.order - b.order);
    return { ...dayMeta(date), sections };
  });
}

const workerShiftText = (shift, compact = false) => {
  if (shift.isNight) return compact ? "כונן לילה" : "🌙 כונן לילה";
  return [shift.label, shift.time, shift.notes].filter(Boolean).join(compact ? " " : " · ");
};

export function generateWorkerPersonalMessage(worker, schedule, weekStart) {
  const lines = [`${worker.name} שלום,`, `אלה המשמרות שלך לשבוע ${weekRangeLabel(weekStart)}:`];
  if (schedule?.status !== "PUBLISHED") lines.push("שים לב: הסידור עדיין טיוטה");
  lines.push("");
  worker.days.forEach((day) => {
    lines.push(`${day.dayName} ${day.dateLabel}`);
    day.shifts.forEach((shift) => lines.push(workerShiftText(shift)));
    lines.push("");
  });
  lines.push("תודה");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const compactWorkerDayLines = (day) => {
  const nightShifts = day.shifts.filter((s) => s.isNight);
  const regularShifts = day.shifts.filter((s) => !s.isNight);
  if (regularShifts.length === 0) return [`${day.dayName} ${day.dateLabel} — כונן לילה`];
  let nightAttached = false;
  const lines = regularShifts.map((shift) => {
    const shouldAttachNight = nightShifts.length > 0 && !nightAttached && shift.row_type === "OPERATIONS_EVENING";
    if (shouldAttachNight) nightAttached = true;
    return `${day.dayName} ${day.dateLabel} — ${workerShiftText(shift, true)}${shouldAttachNight ? " + כונן לילה" : ""}`;
  });
  if (nightShifts.length > 0 && !nightAttached) lines[0] = `${lines[0]} + כונן לילה`;
  return lines;
};

export function generateWorkersOnlyText(schedule, shifts, weekStart) {
  return groupShiftsByWorker(schedule, shifts).map((worker) => {
    const lines = [worker.name];
    worker.days.forEach((day) => lines.push(...compactWorkerDayLines(day)));
    return lines.join("\n");
  }).join("\n\n");
}

export function generateWeeklyWhatsAppText(schedule, shifts, weekStart) {
  const workers = groupShiftsByWorker(schedule, shifts);
  const cleaning = groupCleaningContractorByDay(schedule, shifts, weekStart);
  const nightCount = workers.flatMap((w) => w.shifts).filter((s) => s.isNight).length;
  const blocks = [`סידור עבודה שבועי\n${weekRangeLabel(weekStart)}\n${reportStatusLabel(schedule)}\n${workers.length} עובדים · ${nightCount} כונני לילה`];
  blocks.push("--- לפי עובדים ---\n" + (generateWorkersOnlyText(schedule, shifts, weekStart) || "אין משמרות עובדים"));
  if (cleaning.length > 0) {
    blocks.push("--- ניקיון קבלן ---\n" + cleaning.map((day) => {
      const parts = [];
      if (day.morning) parts.push(`בוקר: ${day.morning} מנקות`);
      if (day.evening) parts.push(`ערב: ${day.evening} מנקות`);
      return `${day.dayName} ${day.dateLabel} — ${parts.join(", ")}`;
    }).join("\n"));
  }
  return blocks.join("\n\n").trim();
}

const sectionClass = (type) => {
  if (type === "OPERATIONS_MORNING") return "ops";
  if (type === "OPERATIONS_EVENING") return "evening";
  if (type === "NIGHT_ON_CALL") return "night";
  if (type === "MAINTENANCE") return "maintenance";
  if (type?.startsWith("HOUSEKEEPING")) return "cleaning";
  return "neutral";
};

export function generateWeeklySchedulePrintHtml(schedule, shifts, weekStart) {
  const workers = groupShiftsByWorker(schedule, shifts);
  const cleaning = groupCleaningContractorByDay(schedule, shifts, weekStart);
  const days = groupShiftsByDay(schedule, shifts, weekStart);
  const workerHtml = workers.map((worker) => `<section class="worker"><h3>${esc(worker.name)} <span>${worker.totalShifts} משמרות</span></h3>${worker.days.map((day) => `<div class="day"><b>${esc(day.dayName)} ${esc(day.dateLabel)}</b>${day.shifts.map((s) => `<div class="shift ${s.isNight ? "night-line" : ""}">${esc(workerShiftText(s))}</div>`).join("")}</div>`).join("")}</section>`).join("");
  const cleaningHtml = cleaning.length ? `<section><h2>ניקיון קבלן</h2>${cleaning.map((day) => `<div class="cleaning-row"><b>${esc(day.dayName)} ${esc(day.dateLabel)}</b>${day.morning ? `<span>בוקר: ${day.morning} מנקות</span>` : ""}${day.evening ? `<span>ערב: ${day.evening} מנקות</span>` : ""}</div>`).join("")}</section>` : "";
  const daysHtml = days.map((day) => day.sections.length ? `<section class="day-card"><h3>${esc(day.dayName)} ${esc(day.dateLabel)}</h3>${day.sections.map((section) => `<div class="section ${sectionClass(section.type)}"><h4>${esc(section.label)}</h4>${section.lines.map((line) => `<div>${esc(line)}</div>`).join("")}</div>`).join("")}</section>` : "").join("");
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8" /><title>דוח סידור עבודה שבועי</title><style>
    @page { size: A4 portrait; margin: 11mm; } body { margin:0; font-family: Arial, sans-serif; color:#0f172a; direction:rtl; font-size:12px; } header{border-bottom:2px solid #1d4ed8; padding-bottom:8px; margin-bottom:10px} h1{font-size:22px;margin:0 0 4px} h2{font-size:16px;margin:14px 0 8px;color:#1e3a8a} h3{font-size:14px;margin:0 0 6px} h3 span{font-size:11px;color:#64748b;font-weight:400} .meta{color:#475569}.workers{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.worker,.day-card{break-inside:avoid;border:1px solid #dbe3ef;border-radius:10px;padding:8px}.day{margin-top:6px}.shift{line-height:1.45}.night-line{color:#1e3a8a;font-weight:700}.cleaning-row{display:flex;gap:12px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:8px;padding:7px;margin-bottom:5px}.daily{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.section{border-right:4px solid #cbd5e1;padding:4px 7px;margin-top:6px;border-radius:6px;background:#f8fafc}.section h4{margin:0 0 3px;font-size:12px}.ops{border-color:#60a5fa;background:#eff6ff}.evening{border-color:#fb923c;background:#fff7ed}.night{border-color:#1e3a8a;background:#eff6ff}.maintenance{border-color:#38bdf8;background:#f0f9ff}.cleaning{border-color:#22c55e;background:#f0fdf4}.neutral{border-color:#cbd5e1;background:#f8fafc}
  </style></head><body><header><h1>דוח סידור עבודה שבועי</h1><div class="meta">${esc(weekRangeLabel(weekStart))} · סטטוס: ${esc(reportStatusLabel(schedule))}</div></header><h2>לפי עובדים</h2><main class="workers">${workerHtml || "אין משמרות עובדים"}</main>${cleaningHtml}<h2>לפי ימים</h2><main class="daily">${daysHtml}</main></body></html>`;
}