// Shared labels + defaults for the סיכום שהייה (post-stay) module

export const INCIDENT_CATEGORY_LABELS = {
  DAMAGE: "נזק",
  SMOKING: "עישון",
  EXTRA_CLEANING: "ניקיון חריג",
  MISSING_ITEM: "פריט חסר",
  RULE_VIOLATION: "הפרת נהלים",
  OTHER: "אחר",
};

export const INCIDENT_SEVERITY_LABELS = {
  LOW: "נמוכה",
  MEDIUM: "בינונית",
  HIGH: "גבוהה",
};

export const INCIDENT_LOCATION_TYPE_LABELS = {
  TENT: "אוהל",
  BATHROOM: "שירותים",
  SHOWER: "מקלחת",
  COMMON_SPACE: "מרחב משותף",
  DINING_ROOM: "חדר אוכל",
  OTHER: "אחר",
};

export const REPORT_STATUS_LABELS = {
  DRAFT: "טיוטה",
  READY: "מוכן לשליחה",
  SENT: "נשלח",
  CANCELLED: "בוטל",
};

export const REPORT_STATUS_STYLES = {
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
  READY: "bg-amber-50 text-amber-700 border-amber-200",
  SENT: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-600 border-red-200",
};

export const DEFAULT_THANK_YOU =
  "תודה שבחרתם לקחת חלק בחוויה שלנו.\nשמחנו לארח אתכם, ואנחנו מקווים לראות אתכם שוב בקרוב.";

export const DEFAULT_RETURN_INVITATION =
  "נשמח לראות אתכם שוב בקרוב לחוויה נוספת בבית הדור הבא.";

export function parsePhotoUrls(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

const HE_DATE = (d) => (d ? String(d).split("-").reverse().join("/") : "");

// Build a clean WhatsApp/email-friendly Hebrew message from the report + visible incidents
export function buildCopyMessage({ group, report, participantCount, activityNames, visibleIncidents }) {
  const contact = report?.recipient_name || group?.contact_name || "";
  const lines = [];
  lines.push(`שלום ${contact || ""}`.trim() + ",");
  lines.push("");
  lines.push("תודה רבה שבחרתם להתארח אצלנו ולקחת חלק בחוויה של בית הדור הבא.");
  lines.push(
    `שמחנו לארח את קבוצת ${group?.group_name || ""} בתאריכים ${HE_DATE(group?.arrival_date)}${
      group?.departure_date ? `–${HE_DATE(group?.departure_date)}` : ""
    }.`
  );
  lines.push("");
  lines.push("מצורף סיכום קצר של השהייה:");
  lines.push(`* מספר משתתפים: ${participantCount || 0}`);
  if (activityNames && activityNames.length) {
    lines.push(`* פעילויות: ${activityNames.join(", ")}`);
  }
  lines.push("");
  lines.push(report?.return_invitation_text || DEFAULT_RETURN_INVITATION);
  if (visibleIncidents && visibleIncidents.length) {
    lines.push("");
    lines.push("בנוסף, מצורף תיעוד של מספר נושאים שעלו בבדיקת הסיום.");
  }
  lines.push("");
  lines.push("בברכה,");
  lines.push("צוות בית הדור הבא");
  return lines.join("\n");
}