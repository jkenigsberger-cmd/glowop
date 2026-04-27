/**
 * Called explicitly by admin ("סנכרן מהשאלון") when OperationalGroupProfile is accepted.
 * Creates groupSync rows for schedule and meals from GuestFormSubmission data.
 * Idempotent: updates existing groupSync rows, never touches manual rows.
 * Does NOT auto-cancel rows that no longer exist in GuestForm — that would overwrite admin work.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const MEAL_DURATION = { BREAKFAST: 60, LUNCH: 90, DINNER: 90, OTHER: 60 };

function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

Deno.serve(async (req) => {
  try {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { operational_group_profile_id } = await req.json();
  if (!operational_group_profile_id) {
    return Response.json({ error: 'operational_group_profile_id is required' }, { status: 400 });
  }

  // Load the profile
  const profiles = await base44.asServiceRole.entities.OperationalGroupProfile.filter({
    id: operational_group_profile_id,
  });
  const profile = profiles[0];
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 });

  const group_id = profile.group_id;

  // Load associated GuestFormSubmission
  const submissions = await base44.asServiceRole.entities.GuestFormSubmission.filter({
    id: profile.guest_form_submission_id,
  });
  const submission = submissions[0];
  if (!submission) return Response.json({ error: 'GuestFormSubmission not found' }, { status: 404 });

  // Load existing groupSync rows for this profile (to enable upsert)
  const existingSchedule = await base44.asServiceRole.entities.GroupScheduleItem.filter({
    operational_group_profile_id,
    source: 'groupSync',
  });
  const existingMeals = await base44.asServiceRole.entities.MealReservation.filter({
    operational_group_profile_id,
    source: 'groupSync',
  });

  // Build lookup maps keyed by a stable key
  const scheduleByKey = {};
  existingSchedule.forEach(item => {
    const key = `${item.date}|${item.start_time}|${item.activity_name}`;
    scheduleByKey[key] = item;
  });

  const mealByKey = {};
  existingMeals.forEach(item => {
    const key = `${item.date}|${item.meal_type}`;
    mealByKey[key] = item;
  });

  let scheduleCreated = 0, scheduleUpdated = 0;
  let mealsCreated = 0, mealsUpdated = 0;

  // ── Schedule rows ─────────────────────────────────────────────────────────
  let scheduleRows = [];
  if (submission.schedule_notes) {
    try { scheduleRows = JSON.parse(submission.schedule_notes); } catch {}
  }

  for (const row of scheduleRows) {
    if (!row.date || !row.start_time || !row.activity) continue;
    const start_time = row.start_time || '09:00';
    const end_time   = row.end_time   || addMinutes(start_time, 60);
    const key = `${row.date}|${start_time}|${row.activity}`;

    const payload = {
      group_id,
      operational_group_profile_id,
      date: row.date,
      start_time,
      end_time,
      activity_name: row.activity,
      requested_location: row.location || 'אחר',
      activity_space_id: null,
      activity_space_code: null,
      pax: row.pax ? Number(row.pax) : null,
      notes: row.notes || null,
      source: 'groupSync',
      status: 'ACTIVE',
    };

    if (scheduleByKey[key]) {
      await base44.asServiceRole.entities.GroupScheduleItem.update(scheduleByKey[key].id, payload);
      scheduleUpdated++;
    } else {
      await base44.asServiceRole.entities.GroupScheduleItem.create(payload);
      scheduleCreated++;
    }
  }

  // ── Meal rows ──────────────────────────────────────────────────────────────
  let mealRows = [];
  if (submission.meal_plan) {
    try { mealRows = JSON.parse(submission.meal_plan); } catch {}
  }

  // Parse special diets once for summary
  let specialDiets = {};
  if (submission.special_diets) {
    try { specialDiets = JSON.parse(submission.special_diets); } catch {}
  }
  const dietSummary = JSON.stringify(specialDiets);

  for (const row of mealRows) {
    if (!row.date || !row.meal_type) continue;
    const mealTypeMap = { BREAKFAST: 'BREAKFAST', LUNCH: 'LUNCH', DINNER: 'DINNER' };
    const meal_type = mealTypeMap[row.meal_type] || 'OTHER';
    const start_time = row.start_time || '08:00';
    const duration = MEAL_DURATION[meal_type] || 60;
    const end_time = addMinutes(start_time, duration);
    const key = `${row.date}|${meal_type}`;

    const payload = {
      group_id,
      operational_group_profile_id,
      date: row.date,
      meal_type,
      start_time,
      end_time,
      pax: profile.total_pax || submission.total_pax || 0,
      special_diets_summary: dietSummary,
      sandwich_option: row.sandwich_instead || false,
      notes: null,
      source: 'groupSync',
      status: 'ACTIVE',
    };

    if (mealByKey[key]) {
      await base44.asServiceRole.entities.MealReservation.update(mealByKey[key].id, payload);
      mealsUpdated++;
    } else {
      await base44.asServiceRole.entities.MealReservation.create(payload);
      mealsCreated++;
    }
  }

  return Response.json({
    success: true,
    schedule: { created: scheduleCreated, updated: scheduleUpdated },
    meals: { created: mealsCreated, updated: mealsUpdated },
  });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});