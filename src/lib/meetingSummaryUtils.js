// Helpers for the Meeting Summaries (סיכומי פגישות) module.
// Pure functions only — no operational side effects.

// Operational-area suggestions used as quick tag chips + filter options.
export const OPERATIONAL_AREAS = [
  "ניקיון",
  "מטבח",
  "תחזוקה",
  "לינה",
  "פינות קפה",
  "נגישות",
  "צ׳ק אין / צ׳ק אאוט",
  "Google Calendar",
];

export const STATUS_LABELS = {
  DRAFT: "טיוטה",
  SAVED: "שמור",
  ARCHIVED: "בארכיון",
};

export const VISIBILITY_LABELS = {
  PRIVATE_OPERATIONS: "תפעול בלבד",
  INTERNAL_VISIBLE: "צוות פנימי",
};

// Parse a JSON-array string field safely into an array of strings.
export function parseTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    // Fall back: treat commas as separators
    return String(value)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

// Build the concatenated search_text from the record fields.
export function buildSearchText(form) {
  const tags = parseTags(form.topics_tags).join(" ");
  return [
    form.title,
    form.meeting_date,
    form.relevant_week_start,
    form.participants_text,
    form.meeting_summary_text,
    form.original_transcript_optional,
    tags,
    form.mentioned_people_text,
    form.mentioned_groups_text,
    form.mentioned_locations_text,
    form.internal_notes,
  ]
    .filter(Boolean)
    .join(" \n ")
    .toLowerCase();
}

// Roles allowed to create/edit meeting summaries.
export const MEETING_WRITE_ROLES = ["SUPER_ADMIN", "ADMIN", "OPERATIONS"];
// Roles allowed to see PRIVATE_OPERATIONS summaries.
export const MEETING_PRIVATE_VIEW_ROLES = ["SUPER_ADMIN", "ADMIN", "OPERATIONS"];

export function canWriteMeetings(role) {
  return MEETING_WRITE_ROLES.includes(role);
}

export function canViewPrivateMeetings(role) {
  return MEETING_PRIVATE_VIEW_ROLES.includes(role);
}