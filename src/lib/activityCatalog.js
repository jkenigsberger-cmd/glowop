export const ACTIVITY_CATALOG = [
  // Workshops
  { name: "ענייני פנים | ענייני חוץ", type: "workshop", audience: "תלמידים", category: "חברה ישראלית", lecturer: "" },
  { name: "יוצרים תקווה", type: "workshop", audience: "תלמידים", category: "חברה ישראלית", lecturer: "" },
  { name: "שירארץ", type: "workshop", audience: "תלמידים", category: "חברה ישראלית", lecturer: "" },
  { name: "מי שרוצה מצליח?", type: "workshop", audience: "תלמידים", category: "חברה ישראלית", lecturer: "" },
  { name: "סדנת סטיקרים", type: "workshop", audience: "תלמידים", category: "חינוך פוליטי", lecturer: "" },
  { name: "הקול שלי במרחב", type: "workshop", audience: "תלמידים", category: "חינוך פוליטי", lecturer: "" },
  { name: "סדנת נרטיבים", type: "workshop", audience: "תלמידים", category: "חינוך פוליטי", lecturer: "" },
  { name: "סדנת אומץ", type: "workshop", audience: "כולם", category: "פדגוגיה של מורכבות", lecturer: "" },
  { name: "סדנת חלימה — Dragon Dreaming", type: "workshop", audience: "מבוגרים", category: "חלומות ערים", lecturer: "" },
  { name: "מעגל הזהב — למה, איך ומה", type: "workshop", audience: "תלמידים", category: "חלומות ערים", lecturer: "" },
  { name: "קפסולת זמן", type: "workshop", audience: "תלמידים", category: "חלומות ערים", lecturer: "" },
  { name: "סדנת עיבוד", type: "workshop", audience: "מבוגרים", category: "חלומות ערים", lecturer: "" },
  // Lectures
  { name: "פדגוגיה של תקווה", type: "lecture", audience: "כולם", category: "חברה ישראלית", lecturer: "שירלי רימון ברכה" },
  { name: "לצאת מדעתנו", type: "lecture", audience: "כולם", category: "חברה ישראלית", lecturer: "מירב לשם גונן" },
  { name: "חינוך כמעשה נרטיבי", type: "lecture", audience: "כולם", category: "חינוך פוליטי", lecturer: "שירלי רימון ברכה" },
  { name: "פדגוגיה של חוויה", type: "lecture", audience: "כולם", category: "חלומות ערים", lecturer: "עדי פאר" },
  { name: "בניית אקוסיסטם חינוכי", type: "lecture", audience: "כולם", category: "חלומות ערים", lecturer: "רותי אנזל" },
  { name: "מסע של שינוי — הובלת שינוי ארגוני", type: "lecture", audience: "כולם", category: "חלומות ערים", lecturer: "שירלי רימון ברכה" },
  { name: "POV: מבוגר אחראי", type: "lecture", audience: "מבוגרים", category: "חלומות ערים", lecturer: "" },
  { name: "יהודית ודמוקרטית — הגם וגם כדרך חיים", type: "lecture", audience: "כולם", category: "שניים אוחזין", lecturer: "שירלי רימון ברכה" },
];

export function catalogItemLabel(item) {
  const typeLabel = item.type === "lecture" ? "הרצאה" : "סדנה";
  return `[${typeLabel}] ${item.name}${item.lecturer ? ` — ${item.lecturer}` : ""}`;
}