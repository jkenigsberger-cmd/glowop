import { isGroupOperationallyEnabled } from './groupOperationalIsolation.js';
import { isArrivalDate, isDepartureDate, occupiesSleepingNight } from './groupStayPeriods.js';

const EXCLUDED = new Set(['CANCELLED', 'COMPLETED', 'ARCHIVED']);
const addDays = (value, days) => {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const sortRecords = (items) => [...items].sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
const compact = (items, fields) => sortRecords(items).map((item) => Object.fromEntries(fields.filter((field) => item[field] !== undefined).map((field) => [field, item[field]])));

function periodsIndex(periods) {
  const index = {};
  for (const period of periods) (index[period.group_id] ||= []).push(period);
  for (const values of Object.values(index)) values.sort((a, b) => a.start_date.localeCompare(b.start_date) || a.end_date.localeCompare(b.end_date));
  return index;
}

function onDashboardDate(group, date, periods) {
  if (group.stay_mode === 'MULTI_PERIOD') return occupiesSleepingNight(date, periods);
  if (group.group_type === 'DAY_USE') return group.arrival_date === date;
  const departure = group.departure_date?.trim() || null;
  if (!departure) return group.arrival_date === date;
  return group.arrival_date <= date && departure > date;
}

function arrivesOn(group, date, periods) {
  return group.stay_mode === 'MULTI_PERIOD' ? isArrivalDate(date, periods) : group.arrival_date === date;
}

function departsOn(group, date, periods) {
  return group.stay_mode === 'MULTI_PERIOD' ? isDepartureDate(date, periods) : group.departure_date === date;
}

function sleepsOn(group, date, periods) {
  if (group.group_type !== 'LODGING') return false;
  if (group.stay_mode === 'MULTI_PERIOD') return occupiesSleepingNight(date, periods);
  const departure = group.departure_date?.trim() || null;
  return !!departure && group.arrival_date <= date && departure > date;
}

function blockVisible(block, date, endDate) {
  if (block.status !== 'ACTIVE' || !block.start_date || block.start_date > endDate) return false;
  return block.is_open_ended === true || (!!block.end_date && block.end_date >= date);
}

export async function buildOperationalDaySnapshot(base44, date) {
  const [allGroups, periods, profiles, meals, coffee, activities, standaloneActivities, standaloneAssignments, allocations, facilities, tents, activitySpaces, activitySpaceBlocks, neighborhoods] = await Promise.all([
    base44.asServiceRole.entities.Group.list('-arrival_date', 300),
    base44.asServiceRole.entities.GroupStayPeriod.filter({ status: 'ACTIVE' }),
    base44.asServiceRole.entities.OperationalGroupProfile.list('-accepted_at', 300),
    base44.asServiceRole.entities.MealReservation.filter({ status: 'ACTIVE' }),
    base44.asServiceRole.entities.CoffeeCornerRequest.filter({ status: 'ACTIVE' }),
    base44.asServiceRole.entities.GroupScheduleItem.filter({ status: 'ACTIVE' }),
    base44.asServiceRole.entities.StandaloneActivityReservation.filter({ status: 'ACTIVE' }),
    base44.asServiceRole.entities.StandaloneActivitySpaceAssignment.list('-created_date', 500),
    base44.asServiceRole.entities.SleepingAllocation.filter({ status: 'CONFIRMED' }),
    base44.asServiceRole.entities.Facility.list(),
    base44.asServiceRole.entities.Tent.list(),
    base44.asServiceRole.entities.ActivitySpace.list(),
    base44.asServiceRole.entities.ActivitySpaceBlock.filter({ status: 'ACTIVE' }),
    base44.asServiceRole.entities.Neighborhood.list('sort_order', 50),
  ]);

  const groups = allGroups.filter(isGroupOperationallyEnabled);
  const groupById = Object.fromEntries(groups.map((group) => [group.id, group]));
  const profileByGroupId = Object.fromEntries(profiles.map((profile) => [profile.group_id, profile]));
  const periodsByGroupId = periodsIndex(periods);
  const operationalAllocations = allocations.filter((allocation) => groupById[allocation.group_id]);
  const allocatedGroupIds = new Set(operationalAllocations.map((allocation) => allocation.group_id));
  const nextDate = addDays(date, 1);

  const activeGroups = groups.filter((group) => !EXCLUDED.has(group.status) && onDashboardDate(group, date, periodsByGroupId[group.id] || []));
  const lodgingGroups = activeGroups.filter((group) => group.group_type === 'LODGING');
  const dayUseGroups = activeGroups.filter((group) => group.group_type === 'DAY_USE');
  const arrivingToday = groups.filter((group) => !EXCLUDED.has(group.status) && arrivesOn(group, date, periodsByGroupId[group.id] || []));
  const sleepingTonight = groups.filter((group) => !EXCLUDED.has(group.status) && sleepsOn(group, date, periodsByGroupId[group.id] || []));
  const departingToday = groups.filter((group) => !EXCLUDED.has(group.status) && group.group_type === 'LODGING' && departsOn(group, date, periodsByGroupId[group.id] || []));
  const mealsForDate = meals.filter((meal) => groupById[meal.group_id] && meal.date === date);
  const coffeeForDate = coffee.filter((request) => groupById[request.group_id] && request.date === date);
  const groupActivitiesForDate = activities.filter((activity) => groupById[activity.group_id] && activity.date === date);
  const standaloneForDate = standaloneActivities.filter((activity) => activity.event_date === date);
  const dateAllocations = operationalAllocations.filter((allocation) => {
    const group = groupById[allocation.group_id];
    if (!(allocation.arrival_date <= date && allocation.departure_date > date)) return false;
    return group.stay_mode !== 'MULTI_PERIOD' || occupiesSleepingNight(date, periodsByGroupId[group.id] || []);
  });

  const brokenFacilities = facilities.filter((facility) => facility.working_status !== 'WORKING');
  const brokenTents = tents.filter((tent) => tent.working_status !== 'WORKING');
  const pendingHousekeepingProfiles = profiles.filter((profile) => groupById[profile.group_id] && profile.sleeping_requirements_completed && !allocatedGroupIds.has(profile.group_id));
  const arrivingLodging = arrivingToday.filter((group) => group.group_type === 'LODGING');
  const arrivingNoSleeping = arrivingLodging.map((group) => profileByGroupId[group.id]).filter((profile) => profile && !profile.sleeping_requirements_completed).map((profile) => ({ id: profile.group_id, label: groupById[profile.group_id]?.group_name || profile.group_id }));
  const arrivingNextLodging = groups.filter((group) => group.arrival_date === nextDate && group.group_type === 'LODGING');
  const arrivingNextNoSleeping = arrivingNextLodging.map((group) => profileByGroupId[group.id]).filter((profile) => profile && !profile.sleeping_requirements_completed).map((profile) => ({ id: profile.group_id, label: groupById[profile.group_id]?.group_name || profile.group_id }));
  const arrivingSoonIds = new Set(groups.filter((group) => group.arrival_date === date || group.arrival_date === nextDate).map((group) => group.id));
  const arrivingSoonPendingAllocation = profiles.filter((profile) => profile.sleeping_requirements_completed && !allocatedGroupIds.has(profile.group_id) && arrivingSoonIds.has(profile.group_id)).map((profile) => ({ id: profile.group_id, label: groupById[profile.group_id]?.group_name || profile.group_id }));
  const brokenItems = [
    ...brokenFacilities.map((facility) => ({ id: facility.id, label: `מתקן: ${facility.label} (${facility.working_status})` })),
    ...brokenTents.map((tent) => ({ id: tent.id, label: `אוהל: ${tent.code} (${tent.working_status})` })),
  ];

  const alertEnd = addDays(date, 14);
  const upcomingBlocks = activitySpaceBlocks.filter((block) => blockVisible(block, date, alertEnd));
  const upcomingBlockedSpaceIds = new Set(upcomingBlocks.map((block) => block.activity_space_id));
  const alertActivities = activities.filter((activity) => groupById[activity.group_id] && activity.date >= date && activity.date <= alertEnd && upcomingBlockedSpaceIds.has(activity.activity_space_id));
  const totalPaxOnSite = activeGroups.reduce((sum, group) => sum + (profileByGroupId[group.id]?.total_pax ?? group.total_pax ?? 0), 0);
  const snapshotGroupIds = new Set([
    ...activeGroups, ...arrivingToday, ...sleepingTonight, ...departingToday, ...arrivingNextLodging,
    ...mealsForDate.map((item) => groupById[item.group_id]).filter(Boolean),
    ...coffeeForDate.map((item) => groupById[item.group_id]).filter(Boolean),
    ...groupActivitiesForDate.map((item) => groupById[item.group_id]).filter(Boolean),
    ...alertActivities.map((item) => groupById[item.group_id]).filter(Boolean),
    ...dateAllocations.map((item) => groupById[item.group_id]).filter(Boolean),
  ].map((group) => group.id));
  const snapshotGroups = groups.filter((group) => snapshotGroupIds.has(group.id));
  const standaloneIds = new Set(standaloneForDate.map((item) => item.id));

  return {
    snapshot_version: 1,
    date,
    data: {
      groups: compact(snapshotGroups, ['id','group_name','group_type','stay_mode','arrival_date','departure_date','arrival_time','departure_time','total_pax','status','internal_notes','operationally_active','quote_preparation_flow']),
      group_stay_periods: compact(periods.filter((period) => snapshotGroupIds.has(period.group_id)), ['id','group_id','start_date','end_date','arrival_time','departure_time','status']),
      profiles: compact(profiles.filter((profile) => snapshotGroupIds.has(profile.group_id)), ['id','group_id','total_pax','participant_count','staff_count','boys_count','girls_count','special_diets','meal_plan','general_notes','sleeping_requirements_completed']),
      meals: compact(mealsForDate, ['id','group_id','operational_group_profile_id','date','meal_type','start_time','end_time','pax','special_diets_summary','sandwich_option','notes','source','status']),
      coffee_requests: compact(coffeeForDate, ['id','group_id','operational_group_profile_id','date','start_time','end_time','pax','coffee_corner_type','location_id','location_name_snapshot','notes','source','status']),
      activities: compact(groupActivitiesForDate, ['id','group_id','operational_group_profile_id','date','start_time','end_time','activity_name','requested_location','activity_space_id','activity_space_code','pax','notes','status']),
      standalone_activities: compact(standaloneForDate, ['id','title','activity_type','description','event_date','start_time','end_time','expected_pax','general_notes','status']),
      standalone_assignments: compact(standaloneAssignments.filter((assignment) => standaloneIds.has(assignment.reservation_id)), ['id','reservation_id','activity_space_id']),
      allocations: compact(dateAllocations, ['id','group_id','tent_id','neighborhood_id','arrival_date','departure_date','allocated_pax','allocation_type','gender_group','status']),
      facilities: compact(facilities, ['id','facility_area_id','code','label','unit_number','facility_type','gender','is_accessible','working_status','notes']),
      tents: compact(tents, ['id','neighborhood_id','code','tent_number','sub_label','tent_type','capacity','working_status']),
      activity_spaces: compact(activitySpaces, ['id','code','name','space_type','capacity','is_bookable','working_status']),
      activity_space_blocks: compact(upcomingBlocks, ['id','activity_space_id','activity_space_name','start_date','end_date','start_time','end_time','is_open_ended','reason_type','reason_notes','status']),
      alert_activities: compact(alertActivities, ['date','start_time','end_time','activity_space_id']),
      neighborhoods: compact(neighborhoods, ['id','code','name','sort_order','is_vip']),
    },
    derived: {
      group_ids: {
        active: activeGroups.map((group) => group.id).sort(),
        lodging: lodgingGroups.map((group) => group.id).sort(),
        day_use: dayUseGroups.map((group) => group.id).sort(),
        arriving: arrivingToday.map((group) => group.id).sort(),
        sleeping: sleepingTonight.map((group) => group.id).sort(),
        departing: departingToday.map((group) => group.id).sort(),
      },
      summary_cards: {
        activeGroups: lodgingGroups.length,
        arrivingToday: arrivingLodging.length,
        sleepingTonight: sleepingTonight.length,
        departingToday: departingToday.length,
        dayUseGroups: dayUseGroups.length,
        totalPaxOnSite,
        mealsToday: mealsForDate.length,
        activitiesToday: groupActivitiesForDate.length + standaloneForDate.length,
        pendingHousekeeping: pendingHousekeepingProfiles.length,
        maintenanceIssues: brokenFacilities.length + brokenTents.length,
      },
      warnings: { arrivingNoSleeping, arrivingNextNoSleeping, arrivingSoonPendingAllocation, brokenItems },
      space_block_alert: { block_ids: upcomingBlocks.map((block) => block.id).sort(), activity_ids: alertActivities.map((activity) => activity.id).sort() },
      occupancy: { allocation_ids: dateAllocations.map((allocation) => allocation.id).sort(), total_allocated_pax: dateAllocations.reduce((sum, allocation) => sum + (allocation.allocated_pax || 0), 0) },
    },
  };
}