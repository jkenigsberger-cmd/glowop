/**
 * Called explicitly by admin ("סנכרן") when OperationalGroupProfile is accepted.
 * Creates groupSync rows for schedule and meals from GuestFormSubmission data.
 * Idempotent: updates existing groupSync rows, never touches manual rows.
 * Supports partial sync (no GuestFormSubmission) — syncs from Group + OperationalGroupProfile alone.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
    { key: 'vegetarian_count',      label: 'צמחוני' },
    { key: 'vegan_count',           label: 'טבעוני' },
    { key: 'glutenFree_count',      label: 'ללא גלוטן' },
    { key: 'lactoseFree_count',     label: 'ללא לקטוז' },
    { key: 'eggFree_count',         label: 'ללא ביצים' },
    { key: 'nutFree_count',         label: 'ללא אגוזים' },
    { key: 'mehadrinKosher_count',  label: 'מהדרין' },
    { key: 'lifeThreatening_count', label: 'אלרגיה מסכנת חיים' },
  ];
  const parts = labels
    .filter(l => Number(diets[l.key]) > 0)
    .map(l => `${l.label}: ${diets[l.key]}`);
  if (diets.diet_notes) parts.push(`הערות: ${diets.diet_notes}`);
  return parts.join(' | ');
}

Deno.serve(async (req) => {
  console.log('[prefillGroupScheduleAndMeals] function invoked');
  const base44 = createClientFromRequest(req);
  let step = 'init';

  try {
    step = 'parse_body';
    const { operational_group_profile_id } = await req.json();
    if (!operational_group_profile_id) {
      return Response.json({ success: false, error: 'operational_group_profile_id is required' }, { status: 400 });
    }
    console.log('[prefillGroupScheduleAndMeals] profile_id:', operational_group_profile_id);

    // Load the profile
    step = 'load_profile';
    const profiles = await base44.asServiceRole.entities.OperationalGroupProfile.filter({
      id: operational_group_profile_id,
    });
    const profile = profiles[0];
    if (!profile) return Response.json({ success: false, error: 'Profile not found' }, { status: 404 });

    const group_id = profile.group_id;
    console.log('[prefillGroupScheduleAndMeals] group_id:', group_id);

    // Try to load GuestFormSubmission — NOT required
    step = 'load_submission';
    let submission = null;
    if (profile.guest_form_submission_id) {
      const submissions = await base44.asServiceRole.entities.GuestFormSubmission.filter({
        id: profile.guest_form_submission_id,
      });
      submission = submissions[0] || null;
    }
    // Also try by group_id if not found via profile link
    if (!submission) {
      const byGroup = await base44.asServiceRole.entities.GuestFormSubmission.filter({ group_id });
      // Prefer REVIEWED, then SUBMITTED, then any
      submission = byGroup.find(s => s.status === 'REVIEWED')
        || byGroup.find(s => s.status === 'SUBMITTED')
        || byGroup[0]
        || null;
    }
    console.log('[prefillGroupScheduleAndMeals] submission found:', !!submission);

    // Load existing groupSync rows for upsert
    step = 'load_existing';
    const [existingSchedule, existingGroupSyncMeals, allGroupMeals] = await Promise.all([
      base44.asServiceRole.entities.GroupScheduleItem.filter({
        operational_group_profile_id,
        source: 'groupSync',
      }),
      base44.asServiceRole.entities.MealReservation.filter({
        operational_group_profile_id,
        source: 'groupSync',
      }),
      // Load ALL active meals for this group to detect manual conflicts
      base44.asServiceRole.entities.MealReservation.filter({
        group_id,
      }),
    ]);

    const scheduleByKey = {};
    existingSchedule.forEach(item => {
      const key = `${item.date}|${item.start_time}|${item.activity_name}`;
      scheduleByKey[key] = item;
    });

    // groupSync meals — safe to update
    const groupSyncMealByKey = {};
    existingGroupSyncMeals.forEach(item => {
      const key = `${item.date}|${item.meal_type}`;
      groupSyncMealByKey[key] = item;
    });

    // ALL active meals (any source) — used for duplicate/conflict detection
    const allActiveMealByKey = {};
    allGroupMeals.forEach(item => {
      if (item.status !== 'CANCELLED') {
        const key = `${item.date}|${item.meal_type}`;
        allActiveMealByKey[key] = item;
      }
    });

    let scheduleCreated = 0, scheduleUpdated = 0;
    let mealsCreated = 0, mealsUpdated = 0;
    const warnings = [];

    if (!submission) {
      warnings.push('NO_GUEST_FORM_SUBMISSION');
      console.log('[prefillGroupScheduleAndMeals] no submission — partial sync only');
      return Response.json({
        success: true,
        partial: true,
        warnings,
        message: 'סנכרון חלקי בוצע — שאלון לקוח עדיין חסר',
        schedule: { created: 0, updated: 0 },
        meals: { created: 0, updated: 0 },
      });
    }

    // ── Schedule rows ───────────────────────────────────────────────────────
    step = 'sync_schedule';
    let scheduleRows = [];
    if (submission.schedule_notes) {
      try { scheduleRows = JSON.parse(submission.schedule_notes); } catch {}
    }

    // SAFETY: talk suggestions are intake-only — never create GroupScheduleItem from them
    const normalScheduleRows = scheduleRows.filter(r => !r.is_talk_suggestion);

    for (const row of normalScheduleRows) {
      if (!row.date || !row.start_time || !row.activity) continue;
      const start_time = row.start_time || '09:00';
      const end_time   = row.end_time   || addMinutes(start_time, 60);
      const key = `${row.date}|${start_time}|${row.activity}`;

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

    // ── Meal rows ───────────────────────────────────────────────────────────
    step = 'sync_meals';
    let mealRows = [];
    if (submission.meal_plan) {
      try { mealRows = JSON.parse(submission.meal_plan); } catch {}
    }

    let specialDiets = {};
    if (submission.special_diets) {
      try { specialDiets = JSON.parse(submission.special_diets); } catch {}
    }

    const dietSummaryText = buildDietSummary(specialDiets);
    const dietSummaryJson = JSON.stringify(specialDiets);

    const arrivalLunchNote   = submission.arrival_lunch   ? 'צהריים ביום הגעה'  : null;
    const departureLunchNote = submission.departure_lunch ? 'צהריים ביום עזיבה' : null;
    const extraNotes = [arrivalLunchNote, departureLunchNote, submission.general_notes]
      .filter(Boolean).join(' | ');

    const mealConflicts = [];

    for (const row of mealRows) {
      if (!row.date || !row.meal_type) continue;
      const mealTypeMap = { BREAKFAST: 'BREAKFAST', LUNCH: 'LUNCH', DINNER: 'DINNER' };
      const meal_type = mealTypeMap[row.meal_type] || 'OTHER';

      const defaults = MEAL_DEFAULTS[meal_type] || MEAL_DEFAULTS.OTHER;
      const key = `${row.date}|${meal_type}`;

      const existingGroupSync = groupSyncMealByKey[key];
      const existingAny       = allActiveMealByKey[key];

      // Case 1: manual meal already exists for this date/type — do NOT overwrite, create conflict alert
      if (existingAny && !existingGroupSync) {
        console.log(`[prefillGroupScheduleAndMeals] CONFLICT: manual meal exists for ${key}, skipping`);
        mealConflicts.push({ date: row.date, meal_type, existing_source: existingAny.source });
        warnings.push(`MEAL_CONFLICT:${key}`);
        continue;
      }

      const payload = {
        group_id,
        operational_group_profile_id,
        date: row.date,
        meal_type,
        start_time: defaults.start_time,
        end_time:   defaults.end_time,
        pax: profile.total_pax || submission.total_pax || 0,
        special_diets_summary: dietSummaryJson,
        sandwich_option: row.sandwich_instead || false,
        notes: [dietSummaryText, extraNotes].filter(Boolean).join('\n') || null,
        source: 'groupSync',
        status: 'ACTIVE',
      };

      // Case 2: existing groupSync meal — safe to update
      if (existingGroupSync) {
        await base44.asServiceRole.entities.MealReservation.update(existingGroupSync.id, payload);
        mealsUpdated++;
      } else {
        // Case 3: no existing meal — safe to create
        await base44.asServiceRole.entities.MealReservation.create(payload);
        mealsCreated++;
      }
    }

    // Create a single KITCHEN conflict alert if any manual meals blocked sync
    if (mealConflicts.length > 0) {
      try {
        const conflictList = mealConflicts
          .map(c => `${c.date} — ${c.meal_type}`)
          .join(', ');
        await base44.asServiceRole.entities.OperationalReviewAlert.create({
          group_id,
          module:   'KITCHEN',
          severity: 'WARNING',
          source:   'MEAL_CONFLICT',
          title:    'ארוחות קיימות — סנכרון לא הושלם',
          message:  `ארוחה קיימת כבר בתאריכים הבאים. יש לבדוק לפני סנכרון: ${conflictList}`,
          status:   'OPEN',
          new_value_json: JSON.stringify({ conflicts: mealConflicts, submission_id: profile.guest_form_submission_id }),
        });
      } catch (alertErr) {
        console.warn('[prefillGroupScheduleAndMeals] failed to create meal conflict alert:', alertErr?.message);
      }
    }

    console.log(`[prefillGroupScheduleAndMeals] done: schedule +${scheduleCreated} ~${scheduleUpdated}, meals +${mealsCreated} ~${mealsUpdated}`);

    return Response.json({
      success: true,
      partial: false,
      warnings,
      meal_conflicts: mealConflicts,
      schedule: { created: scheduleCreated, updated: scheduleUpdated },
      meals: { created: mealsCreated, updated: mealsUpdated },
    });

  } catch (error) {
    console.error(`[prefillGroupScheduleAndMeals] FAILED at step="${step}"`, error?.message);
    return Response.json({
      success: false,
      error: 'סנכרון הנתונים נכשל',
      debug: { step, message: error?.message || String(error) },
    }, { status: 500 });
  }
});