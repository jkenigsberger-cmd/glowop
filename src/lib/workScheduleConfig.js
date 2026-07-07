// סידור עבודה — fixed row types, colors and week helpers (Sunday → Saturday)

export const ROW_TYPES = [
  { type: "PLANNED_ACTIVITY",    label: "פעילות מתוכננת", order: 0, team: null,          textOnly: true,  cell: "bg-slate-50",     chip: "bg-white border-slate-300 text-slate-700" },
  { type: "OPERATIONS_MORNING",  label: "תפעול בוקר",     order: 1, team: "OPERATIONS",  textOnly: false, cell: "bg-blue-50/60",   chip: "bg-blue-100 border-blue-300 text-blue-900" },
  { type: "HOUSEKEEPING_MORNING",label: "ניקיון בוקר",    order: 2, team: "HOUSEKEEPING",textOnly: false, cell: "bg-green-50/60",  chip: "bg-green-100 border-green-300 text-green-900" },
  { type: "HOUSEKEEPING_MANAGER",label: "אחראי משק בית",  order: 3, team: "HOUSEKEEPING",textOnly: false, cell: "bg-emerald-50/60",chip: "bg-emerald-100 border-emerald-300 text-emerald-900" },
  { type: "MAINTENANCE",         label: "תחזוקה",          order: 4, team: "MAINTENANCE", textOnly: false, cell: "bg-sky-50/60",    chip: "bg-sky-100 border-sky-300 text-sky-900" },
  { type: "OPERATIONS_EVENING",  label: "תפעול ערב",      order: 5, team: "OPERATIONS",  textOnly: false, cell: "bg-orange-50/60", chip: "bg-orange-100 border-orange-300 text-orange-900" },
  { type: "HOUSEKEEPING_EVENING",label: "ניקיון ערב",     order: 6, team: "HOUSEKEEPING",textOnly: false, cell: "bg-green-50/60",  chip: "bg-green-100 border-green-300 text-green-900" },
  { type: "NIGHT_ON_CALL",       label: "כונן לילה",      order: 7, team: "OPERATIONS",  textOnly: false, cell: "bg-cyan-50/60",   chip: "bg-cyan-100 border-cyan-300 text-cyan-900" },
  { type: "SPECIAL_TASKS",       label: "משימות מיוחדות", order: 8, team: null,          textOnly: false, cell: "bg-slate-50",     chip: "bg-white border-slate-300 text-slate-700" },
];

export const ROW_BY_TYPE = Object.fromEntries(ROW_TYPES.map(r => [r.type, r]));

export const TEAM_FILTERS = [
  { id: "ALL",          label: "הכל" },
  { id: "OPERATIONS",   label: "תפעול" },
  { id: "HOUSEKEEPING", label: "משק בית" },
  { id: "MAINTENANCE",  label: "תחזוקה" },
];

export const WORKER_TEAMS = [
  { id: "OPERATIONS",   label: "תפעול" },
  { id: "HOUSEKEEPING", label: "משק בית" },
  { id: "MAINTENANCE",  label: "תחזוקה" },
  { id: "OTHER",        label: "אחר" },
];

export const DAY_NAMES = ["יום א׳", "יום ב׳", "יום ג׳", "יום ד׳", "יום ה׳", "יום ו׳", "שבת"];

const toDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Sunday of the week containing the given date
export function getWeekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return toDateStr(d);
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function getWeekDays(weekStart) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function fmtDM(dateStr) {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

// "07:00" → "7", "14:30" → "14:30"
const compactTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  return m === "00" ? String(Number(h)) : `${Number(h)}:${m}`;
};

export function fmtShiftTime(start, end) {
  if (!start && !end) return "";
  return `${compactTime(start)}–${compactTime(end)}`;
}

export function dayNameOf(dateStr) {
  return DAY_NAMES[new Date(dateStr + "T12:00:00").getDay()];
}