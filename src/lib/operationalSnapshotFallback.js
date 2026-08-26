import { base44 } from "@/api/base44Client";

export const SNAPSHOT_CHECK_EVENT = "operational-snapshot-check-complete";

export function dateInJerusalem(reference = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function previousDate(value) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function yesterdayInJerusalem() {
  return previousDate(dateInJerusalem());
}

export function snapshotCheckKey(date = dateInJerusalem()) {
  return `operational-snapshot-check:${date}`;
}

export async function finalizeYesterdaySnapshot() {
  const response = await base44.functions.invoke("finalizeOperationalDaySnapshot", {});
  return response.data;
}