/**
 * groupDatesLabel
 * Formats a group's stay/activity dates for display in alert cards.
 * Returns a ready-to-render string, or null when there is no meaningful date to show.
 *
 * Rules:
 *  - DAY_USE or arrival == departure → "תאריך פעילות: DD/MM/YYYY"
 *  - LODGING with both dates          → "תאריכי שהייה: DD/MM/YYYY - DD/MM/YYYY"
 *  - only arrival_date                → "תאריך הגעה: DD/MM/YYYY"
 *  - no dates                         → null
 */
import { format } from "date-fns";

function fmt(d) {
  if (!d) return null;
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return null; }
}

export function groupDatesLabel(group) {
  if (!group) return null;
  const arrival = fmt(group.arrival_date);
  const departure = fmt(group.departure_date);

  if (!arrival) return null;

  const isDayUse = group.group_type === "DAY_USE" || group.arrival_date === group.departure_date;
  if (isDayUse) return `תאריך פעילות: ${arrival}`;

  if (departure) return `תאריכי שהייה: ${arrival} - ${departure}`;

  return `תאריך הגעה: ${arrival}`;
}