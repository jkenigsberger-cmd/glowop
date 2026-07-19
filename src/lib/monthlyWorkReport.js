export const TEAM_LABELS = { OPERATIONS: "תפעול", HOUSEKEEPING: "משק בית", MAINTENANCE: "תחזוקה", KITCHEN: "מטבח", OTHER: "אחר" };
export const fmtReportDate = (value) => value ? value.split("-").reverse().join("/") : "—";
export const fmtHours = (value) => Number(value || 0).toLocaleString("he-IL", { maximumFractionDigits: 2 });
export const monthLabel = (value) => new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(new Date(`${value}-01T12:00:00`));