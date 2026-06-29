/**
 * mergeSharedActivities — logistics display helper.
 *
 * Groups an array of enriched schedule items (with groupName, spaceName, equipment, etc.)
 * by shared_activity_id for logistics/common-space reports.
 *
 * Rules:
 * - Items with the same shared_activity_id are merged into one logical row.
 * - Items without shared_activity_id remain individual rows.
 * - Only ACTIVE items are included (callers should pre-filter, but we guard here too).
 * - If linked items have inconsistent date/time/space, we flag mismatched: true.
 *
 * Returns an array of "merged rows" ready for display.
 * Each row has:
 *   id, activity_name, date, start_time, end_time,
 *   activity_space_id, spaceName,
 *   isShared, shared_activity_id,
 *   linkedGroups: [{ groupId, groupName, pax }],
 *   totalPax,
 *   missingPax: bool,
 *   mismatched: bool,
 *   equipment (merged),
 *   chairs_count (summed),
 *   notes (merged unique),
 *   // logistics booleans (ORed)
 *   needs_projector, needs_screen, needs_microphone,
 *   needs_sound, needs_whiteboard, needs_chair_circle,
 *   // passthrough for non-shared
 *   groupName, pax,
 */

import { equipmentTextSummary } from "@/components/schedule/LogisticsFields";

function orBool(items, field) {
  return items.some(i => !!i[field]);
}

function sumField(items, field) {
  return items.reduce((acc, i) => acc + (Number(i[field]) || 0), 0);
}

function mergeNotes(items) {
  const unique = [...new Set(items.map(i => i.notes || "").filter(Boolean))];
  return unique.join(" | ") || null;
}

function buildEquipment(merged) {
  // Re-derive equipment text from the merged booleans
  return equipmentTextSummary(merged);
}

export function mergeSharedActivities(items) {
  const groups = new Map(); // shared_activity_id -> [items]
  const singles = [];      // items without shared_activity_id

  for (const item of items) {
    if (item.status === "CANCELLED") continue;
    if (item.shared_activity_id && item.is_shared_activity) {
      if (!groups.has(item.shared_activity_id)) groups.set(item.shared_activity_id, []);
      groups.get(item.shared_activity_id).push(item);
    } else {
      singles.push(item);
    }
  }

  const merged = [];

  // Non-shared items — pass through unchanged
  for (const item of singles) {
    merged.push({
      ...item,
      isShared: false,
      linkedGroups: [{ groupId: item.group_id, groupName: item.groupName, pax: item.pax || 0 }],
      totalPax: item.pax || 0,
      missingPax: !item.pax,
      mismatched: false,
    });
  }

  // Shared groups — one merged row per shared_activity_id
  for (const [sharedId, sharedItems] of groups.entries()) {
    // If only one active item remains, treat as normal
    if (sharedItems.length === 1) {
      const item = sharedItems[0];
      merged.push({
        ...item,
        isShared: false,
        linkedGroups: [{ groupId: item.group_id, groupName: item.groupName, pax: item.pax || 0 }],
        totalPax: item.pax || 0,
        missingPax: !item.pax,
        mismatched: false,
      });
      continue;
    }

    const ref = sharedItems[0];

    // Check consistency — all linked items should have same date/time/space
    const mismatched = sharedItems.some(i =>
      i.date !== ref.date ||
      i.start_time !== ref.start_time ||
      i.end_time !== ref.end_time ||
      i.activity_space_id !== ref.activity_space_id
    );

    const linkedGroups = sharedItems.map(i => ({
      groupId: i.group_id,
      groupName: i.groupName,
      pax: i.pax || 0,
    }));

    const missingPax = sharedItems.some(i => !i.pax);
    const totalPax = sumField(sharedItems, "pax");

    const chairs = sharedItems.some(i => i.chairs_count) 
      ? sumField(sharedItems, "chairs_count")
      : totalPax;

    const mergedItem = {
      // Use ref item as base (id, date, time, space, activity_name)
      ...ref,
      // Override shared-specific fields
      id: sharedId, // stable key for rendering
      shared_activity_id: sharedId,
      isShared: true,
      linkedGroups,
      totalPax,
      missingPax,
      mismatched,
      // Merged logistics booleans (OR)
      needs_projector:    orBool(sharedItems, "needs_projector"),
      needs_screen:       orBool(sharedItems, "needs_screen"),
      needs_microphone:   orBool(sharedItems, "needs_microphone"),
      needs_sound:        orBool(sharedItems, "needs_sound"),
      needs_whiteboard:   orBool(sharedItems, "needs_whiteboard"),
      needs_chair_circle: orBool(sharedItems, "needs_chair_circle"),
      chairs_count: chairs,
      notes: mergeNotes(sharedItems),
      pax: totalPax,
      groupName: linkedGroups.map(g => g.groupName).join(", "),
    };

    mergedItem.equipment = buildEquipment(mergedItem);

    merged.push(mergedItem);
  }

  return merged;
}