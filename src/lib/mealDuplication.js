// Helpers for manual meal duplication across a group's stay dates.

const DOW_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

// Build inclusive list of YYYY-MM-DD dates between arrival and departure.
export function buildStayDates(arrivalDate, departureDate) {
  if (!arrivalDate || !departureDate) return [];
  if (departureDate < arrivalDate) return [];
  const dates = [];
  const [ay, am, ad] = arrivalDate.split("-").map(Number);
  const cursor = new Date(Date.UTC(ay, am - 1, ad));
  const end = departureDate;
  // Safety cap to avoid runaway loops on malformed data
  for (let i = 0; i < 400; i++) {
    const iso = cursor.toISOString().slice(0, 10);
    dates.push(iso);
    if (iso >= end) break;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

// Hebrew day-of-week label for a YYYY-MM-DD date.
export function dayOfWeekHe(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return DOW_HE[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

// Format YYYY-MM-DD -> DD/MM/YYYY
export function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Fields copied verbatim from the source meal into each duplicate.
export function buildDuplicatePayload(sourceMeal, targetDate) {
  return {
    group_id: sourceMeal.group_id,
    operational_group_profile_id: sourceMeal.operational_group_profile_id,
    meal_type: sourceMeal.meal_type,
    start_time: sourceMeal.start_time,
    end_time: sourceMeal.end_time,
    pax: sourceMeal.pax,
    special_diets_summary: sourceMeal.special_diets_summary,
    sandwich_option: !!sourceMeal.sandwich_option,
    notes: sourceMeal.notes || "",
    date: targetDate,
    source: "manual",
    status: "ACTIVE",
  };
}