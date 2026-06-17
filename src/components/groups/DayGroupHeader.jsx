import { format, parseISO } from "date-fns";
import { he } from "date-fns/locale";

/**
 * Day separator header for group lists.
 * Shows: day of week + date (e.g., "ראשון · 16/06")
 */
export default function DayGroupHeader({ dateStr }) {
  if (!dateStr) return null;
  let label;
  try {
    const d = parseISO(dateStr);
    const dayName = format(d, "EEEE", { locale: he });
    const datePart = format(d, "dd/MM");
    label = `${dayName} · ${datePart}`;
  } catch {
    label = dateStr;
  }

  return (
    <div className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 px-4 py-1.5">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
    </div>
  );
}

/**
 * Groups items by arrival_date, returning [{date, items}].
 */
export function groupByDay(items, dateKey = "arrival_date") {
  const map = {};
  items.forEach(item => {
    const d = item[dateKey] || "_unknown";
    if (!map[d]) map[d] = [];
    map[d].push(item);
  });
  const entries = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([date, groupItems]) => ({ date, items: groupItems }));
}