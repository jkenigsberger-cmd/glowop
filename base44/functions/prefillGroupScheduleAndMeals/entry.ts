/**
 * Called explicitly by admin ("סנכרן מהשאלון") when OperationalGroupProfile is accepted.
 * Creates groupSync rows for schedule and meals from GuestFormSubmission data.
 * Idempotent: updates existing groupSync rows, never touches manual rows.
 * Does NOT auto-cancel rows that no longer exist in GuestForm — that would overwrite admin work.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Default meal times — used when client did not provide a specific time
const MEAL_DEFAULTS = {
  BREAKFAST: { start_time: '07:00', end_time: '09:00' },
  LUNCH:     { start_time: '12:30', end_time: '13:30' },
  DINNER:    { start_time: '18:30', end_time: '20:00' },
  OTHER:     { start_time: '12:00', end_time: '13:00' },
};

function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function buildDietSummary(diets) {
  if (!diets || typeof diets !== 'object') return '';
  const labels = [
    { key: 'vegetarian_count',     label: 'צמחוני' },
    { key: 'vegan_count',          label: 'טבעוני' },
    { key: 'glutenFree_count',     label: 'ללא גלוטן' },
    { key: 'lactoseFree_count',    label: 'ללא לקטוז' },
    { key: 'eggFree_count',        label: 'ללא ביצים' },
    { key: 'nutFree_count',        label: 'ללא אגוזים' },
    { key: 'mehadrinKosher_count', label: 'מהדרין' },
    { key: 'lifeThreatening_count',label: 'אלרגיה מסכנת חיים' },
  ];
  const parts = labels
    .filter(l => Number(diets[l.key]) > 0)
    .map(l => `${l.label}: ${diets[l.key]}`);
  if (diets.diet_notes) parts.push(`הערות: ${diets.diet_notes}`);
  return parts.join(' | ');
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

  // SAFETY: talk suggestions are intake-only — never create GroupScheduleItem from them.
  const normalScheduleRows = scheduleRows.filter(r => !r.is_talk_suggestion);

  for (const row of normalScheduleRows) {
    if (!row.date || !row.start_time || !row.activity) continue;
    const start_time = row.start_time || '09:00';
    const end_time   = row.end_time   || addMinutes(start_time, 60);
    const key = `${row.date}|${start_time}|${row.activity}`;

    // Build needs summary string to append to notes
    const NEEDS_LABELS = { microphone: 'מיקרופון', projector: 'מקרן', chairs: 'סידור כיסאות', tables: 'שולחנות', whiteboard: 'לוח כתיבה' };
    let needsNote = '';
    if (row.needs && typeof row.needs === 'object') {
      const parts = Object.entries(NEEDS_LABELS)
        .filter(([k]) => row.needs[k])
        .map(([, label]) => label);
      if (row.needs.other) parts.push(row.needs.other_text ? `אחר: ${row.needs.other_text}` : 'אחר');
      if (parts.length) needsNote = `צרכים לפעילות: ${parts.join(', ')}`;
    }
    const combinedNotes = [needsNote, row.notes].filter(Boolean).join('. ') || null;

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
      notes: combinedNotes,
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

  // Build human-readable diet summary for kitchen
  const dietSummaryText = buildDietSummary(specialDiets);
  // Also keep the raw JSON for structured display
  const dietSummaryJson = JSON.stringify(specialDiets);

  // Build extra notes: arrival/departure lunch flags + client meal notes
  const arrivalLunchNote  = submission.arrival_lunch   ? 'צהריים ביום הגעה' : null;
  const departureLunchNote = submission.departure_lunch ? 'צהריים ביום עזיבה' : null;
  const extraNotes = [arrivalLunchNote, departureLunchNote, submission.general_notes]
    .filter(Boolean).join(' | ');

  for (const row of mealRows) {
    if (!row.date || !row.meal_type) continue;
    const mealTypeMap = { BREAKFAST: 'BREAKFAST', LUNCH: 'LUNCH', DINNER: 'DINNER' };
    const meal_type = mealTypeMap[row.meal_type] || 'OTHER';

    // Always use default times — guest form does not collect meal times
    const defaults = MEAL_DEFAULTS[meal_type] || MEAL_DEFAULTS.OTHER;
    const start_time = defaults.start_time;
    const end_time   = defaults.end_time;
    const key = `${row.date}|${meal_type}`;

    const payload = {
      group_id,
      operational_group_profile_id,
      date: row.date,
      meal_type,
      start_time,
      end_time,
      pax: profile.total_pax || submission.total_pax || 0,
      special_diets_summary: dietSummaryJson,
      sandwich_option: row.sandwich_instead || false,
      notes: [dietSummaryText, extraNotes].filter(Boolean).join('\n') || null,
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