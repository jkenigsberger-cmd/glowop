/**
 * Returns the Hebrew display name for an activity space.
 * Never falls back to the internal code.
 */
export function getActivitySpaceDisplayName(space) {
  return space?.name || "מרחב פעילות ללא שם";
}

/**
 * Extracts a sort key from a space record.
 * Rooms with numbers sort by number (ascending).
 * "דק ודשא" and unnumbered spaces sort last.
 */
export function getActivitySpaceSortOrder(space) {
  const name = space?.name || "";
  // Try to extract the first number from the name, e.g. "חדר 9", "חדרים 2-3"
  const match = name.match(/(\d+)/);
  if (match) return parseInt(match[1], 10);
  return 9999; // outdoor / unnumbered → last
}

/**
 * Returns a sorted copy of an activity spaces array.
 */
export function sortActivitySpaces(spaces) {
  return [...spaces].sort((a, b) => getActivitySpaceSortOrder(a) - getActivitySpaceSortOrder(b));
}