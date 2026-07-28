import { isPreparationGroupOperational } from './quotePreparationConfig.js';

export const ACTIVITY_BUFFER_MINUTES = 15;

export function timeToMinutes(value) {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  return hours * 60 + minutes;
}

function overlapsWithBuffer(startA, endA, startB, endB) {
  return startA < endB + ACTIVITY_BUFFER_MINUTES && startB < endA + ACTIVITY_BUFFER_MINUTES;
}

function blockOverlaps(block, date, startTime, endTime) {
  const start = new Date(`${date}T${startTime}:00+03:00`).getTime() - ACTIVITY_BUFFER_MINUTES * 60000;
  const end = new Date(`${date}T${endTime}:00+03:00`).getTime() + ACTIVITY_BUFFER_MINUTES * 60000;
  const blockStart = new Date(`${block.start_date}T${block.start_time}:00+03:00`).getTime();
  if (block.is_open_ended) return end > blockStart;
  const blockEnd = new Date(`${block.end_date}T${block.end_time}:00+03:00`).getTime();
  return start < blockEnd && blockStart < end;
}

async function operationalGroupItems(base44, items) {
  const ids = [...new Set(items.map((item) => item.group_id).filter(Boolean))];
  const groups = [];
  for (const id of ids) {
    try { groups.push(await base44.asServiceRole.entities.Group.get(id)); } catch { /* ignore deleted group */ }
  }
  const operationalIds = new Set(groups.filter(isPreparationGroupOperational).map((group) => group.id));
  return items.filter((item) => operationalIds.has(item.group_id));
}

export async function checkActivitySpaceConflict(base44, input) {
  const { spaceId, date, startTime, endTime, excludeGroupItemId, excludeSharedActivityId, excludeStandaloneReservationId } = input;
  let space = null;
  try { space = await base44.asServiceRole.entities.ActivitySpace.get(spaceId); } catch { /* handled below */ }
  if (!space || space.is_bookable === false || (space.working_status && space.working_status !== 'WORKING')) {
    return { error: 'SPACE_UNAVAILABLE', space_id: spaceId, space_name: space?.name || '', message: 'המרחב שנבחר אינו פעיל או אינו זמין להזמנה' };
  }

  const [blocks, rawGroupItems, standaloneReservations, assignments] = await Promise.all([
    base44.asServiceRole.entities.ActivitySpaceBlock.filter({ activity_space_id: spaceId, status: 'ACTIVE' }),
    base44.asServiceRole.entities.GroupScheduleItem.filter({ activity_space_id: spaceId, date, status: 'ACTIVE' }),
    base44.asServiceRole.entities.StandaloneActivityReservation.filter({ event_date: date, status: 'ACTIVE' }),
    base44.asServiceRole.entities.StandaloneActivitySpaceAssignment.filter({ activity_space_id: spaceId }),
  ]);

  const block = blocks.find((item) => blockOverlaps(item, date, startTime, endTime));
  if (block) return { error: 'SPACE_CONFLICT', space_id: spaceId, space_name: space.name, conflicting_source_type: 'ACTIVITY_SPACE_BLOCK', conflicting_source_id: block.id, conflicting_title: block.reason_notes || 'חסימת מרחב', start_time: block.start_time, end_time: block.is_open_ended ? null : block.end_time, message: 'המרחב כבר תפוס בשעה שנבחרה' };

  const groupItems = await operationalGroupItems(base44, rawGroupItems);
  const groupConflict = groupItems.find((item) => {
    if (excludeGroupItemId && item.id === excludeGroupItemId) return false;
    if (excludeSharedActivityId && item.shared_activity_id === excludeSharedActivityId) return false;
    return overlapsWithBuffer(timeToMinutes(startTime), timeToMinutes(endTime), timeToMinutes(item.start_time), timeToMinutes(item.end_time));
  });
  if (groupConflict) return { error: 'SPACE_CONFLICT', space_id: spaceId, space_name: space.name, conflicting_source_type: 'GROUP_SCHEDULE_ITEM', conflicting_source_id: groupConflict.id, conflicting_title: groupConflict.activity_name, start_time: groupConflict.start_time, end_time: groupConflict.end_time, message: 'המרחב כבר תפוס בשעה שנבחרה' };

  const assignmentReservationIds = new Set(assignments.map((item) => item.reservation_id));
  const standaloneConflict = standaloneReservations.find((item) =>
    assignmentReservationIds.has(item.id) && item.id !== excludeStandaloneReservationId &&
    overlapsWithBuffer(timeToMinutes(startTime), timeToMinutes(endTime), timeToMinutes(item.start_time), timeToMinutes(item.end_time))
  );
  if (standaloneConflict) return { error: 'SPACE_CONFLICT', space_id: spaceId, space_name: space.name, conflicting_source_type: 'STANDALONE_ACTIVITY', conflicting_source_id: standaloneConflict.id, conflicting_title: standaloneConflict.title, start_time: standaloneConflict.start_time, end_time: standaloneConflict.end_time, message: 'המרחב כבר תפוס בשעה שנבחרה' };
  return null;
}