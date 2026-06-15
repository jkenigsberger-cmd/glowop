/**
 * submitGuestForm
 * Handles guest form submissions for both:
 *  - Quote-based groups: requires quote_id, validates APPROVED status
 *  - Direct groups:      quote_id is null/absent, validates group exists and is not cancelled
 *
 * After saving the submission, for DAY_USE groups this function also syncs
 * kitchen MealReservation records (meals + coffee corner).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── Kitchen sync helpers ─────────────────────────────────────────────────────

// Maps dayUseMeals keys → MealReservation meal_type enum values
const MEAL_KEY_TO_TYPE = {
  breakfast: 'BREAKFAST',
  lunch:     'LUNCH',
  dinner:    'DINNER',
};

// Default durations in minutes per meal type
const MEAL_DURATION = { BREAKFAST: 60, LUNCH: 90, DINNER: 90, COFFEE_CORNER: 60 };

function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Default start times for DAY_USE meals (no time provided by guest)
const DEFAULT_TIMES = {
  BREAKFAST:    '08:00',
  LUNCH:        '13:00',
  DINNER:       '18:00',
  COFFEE_CORNER:'10:00',
};

async function syncDayUseKitchen({ base44, group_id, profile_id, activity_date, total_pax, dayUseMeals, coffeeCorner }) {
  // Fetch existing kitchen records for this group created from the external form
  const existing = await base44.asServiceRole.entities.MealReservation.filter({ group_id });
  const fromForm = existing.filter(r => r.source === 'guestForm');

  // Helper: find existing record for a meal type
  const findExisting = (meal_type) => fromForm.find(r => r.meal_type === meal_type && r.status !== 'CANCELLED');

  // ── 1. Sync the three standard meals ────────────────────────────────────────
  for (const [key, meal_type] of Object.entries(MEAL_KEY_TO_TYPE)) {
    const selected = dayUseMeals?.[key] === 'כן';
    const existingRecord = findExisting(meal_type);

    if (selected) {
      const start_time = DEFAULT_TIMES[meal_type];
      const end_time   = addMinutes(start_time, MEAL_DURATION[meal_type]);
      if (existingRecord) {
        // Update pax (and date/times in case they changed)
        await base44.asServiceRole.entities.MealReservation.update(existingRecord.id, {
          pax:        total_pax,
          date:       activity_date,
          start_time,
          end_time,
          status:     'ACTIVE',
        });
      } else {
        // Create new record
        await base44.asServiceRole.entities.MealReservation.create({
          group_id,
          operational_group_profile_id: profile_id || '',
          date:       activity_date,
          meal_type,
          start_time,
          end_time,
          pax:        total_pax,
          source:     'guestForm',
          status:     'ACTIVE',
        });
      }
    } else {
      // Not selected — cancel any existing record from the form
      if (existingRecord) {
        await base44.asServiceRole.entities.MealReservation.update(existingRecord.id, { status: 'CANCELLED' });
      }
    }
  }

  // ── 2. Remove/cancel any sandwich records created by external form ───────────
  const sandwichRecords = fromForm.filter(r =>
    r.meal_type === 'SANDWICH' ||
    (r.notes && r.notes.includes('כריכים'))
  );
  for (const r of sandwichRecords) {
    if (r.status !== 'CANCELLED') {
      await base44.asServiceRole.entities.MealReservation.update(r.id, { status: 'CANCELLED' });
    }
  }

  // ── 3. Sync coffee corner ────────────────────────────────────────────────────
  const coffeeSelected = coffeeCorner?.answer === 'כן';
  const existingCoffee = findExisting('COFFEE_CORNER');

  if (coffeeSelected) {
    const start_time = DEFAULT_TIMES.COFFEE_CORNER;
    const end_time   = addMinutes(start_time, MEAL_DURATION.COFFEE_CORNER);
    if (existingCoffee) {
      await base44.asServiceRole.entities.MealReservation.update(existingCoffee.id, {
        pax:                total_pax,
        date:               activity_date,
        start_time,
        end_time,
        coffee_service_type: 'קפה ועוגיות',
        status:             'ACTIVE',
      });
    } else {
      await base44.asServiceRole.entities.MealReservation.create({
        group_id,
        operational_group_profile_id: profile_id || '',
        date:               activity_date,
        meal_type:          'COFFEE_CORNER',
        start_time,
        end_time,
        pax:                total_pax,
        coffee_service_type: 'קפה ועוגיות',
        source:             'guestForm',
        status:             'ACTIVE',
      });
    }
  } else {
    if (existingCoffee) {
      await base44.asServiceRole.entities.MealReservation.update(existingCoffee.id, { status: 'CANCELLED' });
    }
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { quote_id, group_id, ...fields } = body;

    if (!group_id) {
      return Response.json({ error: 'group_id is required' }, { status: 400 });
    }

    const isDirectGroup = !quote_id;

    if (!isDirectGroup) {
      // ── Quote-based path ────────────────────────────────────────────────────
      let quotes = [];
      try {
        quotes = await base44.asServiceRole.entities.Quote.filter({ id: quote_id });
      } catch {
        return Response.json({ error: 'הטופס לא נמצא — בדקו שהקישור תקין' }, { status: 404 });
      }
      const quote = quotes[0];

      if (!quote) {
        return Response.json({ error: 'הטופס לא נמצא — בדקו שהקישור תקין' }, { status: 404 });
      }

      if (String(quote.status || '').toUpperCase() !== 'APPROVED') {
        return Response.json({ error: 'הצעת המחיר אינה מאושרת — הטופס זמין רק לאחר אישור הצעה' }, { status: 403 });
      }

      // Prevent duplicate submissions (quote-based)
      const existing = await base44.asServiceRole.entities.GuestFormSubmission.filter({ quote_id });
      const locked = existing.find(s => ['SUBMITTED', 'REVIEWED'].includes(s.status));
      if (locked) {
        return Response.json({
          error: 'השאלון כבר נשלח ולא ניתן לערוך אותו. אם יש צורך בשינוי, יש לפנות לצוות בית הדור הבא.'
        }, { status: 409 });
      }
    } else {
      // ── Direct group path ───────────────────────────────────────────────────
      let groups = [];
      try {
        groups = await base44.asServiceRole.entities.Group.filter({ id: group_id });
      } catch {
        return Response.json({ error: 'הקבוצה לא נמצאה — בדקו שהקישור תקין' }, { status: 404 });
      }
      const group = groups[0];
      if (!group) {
        return Response.json({ error: 'הקבוצה לא נמצאה — בדקו שהקישור תקין' }, { status: 404 });
      }
      if (['CANCELLED', 'ARCHIVED'].includes(group.status)) {
        return Response.json({ error: 'הקישור אינו פעיל עוד — פנו לצוות בית הדור הבא' }, { status: 403 });
      }

      // Prevent duplicate submissions for direct groups (no quote_id)
      const existingByGroup = await base44.asServiceRole.entities.GuestFormSubmission.filter({ group_id });
      const lockedDirect = existingByGroup.find(s => ['SUBMITTED', 'REVIEWED'].includes(s.status) && !s.quote_id);
      if (lockedDirect) {
        return Response.json({
          error: 'השאלון כבר נשלח ולא ניתן לערוך אותו. אם יש צורך בשינוי, יש לפנות לצוות בית הדור הבא.'
        }, { status: 409 });
      }
    }

    const num = (v) => (v !== undefined && v !== null && v !== '' ? Number(v) : null);
    const now = new Date().toISOString();

    console.log('[submitGuestForm]', { group_id, isDirectGroup, quote_id: quote_id || null });

    const submissionData = {
      group_id,
      ...(isDirectGroup ? {} : { quote_id }),
      contact_name:            fields.contact_name              || '',
      contact_phone:           fields.contact_phone             || '',
      contact_email:           fields.contact_email             || '',
      client_org:              fields.client_org                || '',
      group_type_label:        fields.group_type_label          || '',
      estimated_arrival_time:  fields.estimated_arrival_time    || null,
      estimated_departure_time: fields.estimated_departure_time || null,
      total_pax:               num(fields.total_pax),
      staff_count:             num(fields.staff_count),
      participant_count:       num(fields.participant_count),
      boys_count:              num(fields.boys_count),
      girls_count:             num(fields.girls_count),
      staff_men_count:         num(fields.staff_men_count),
      staff_women_count:       num(fields.staff_women_count),
      drivers_men_count:       num(fields.drivers_men_count),
      drivers_women_count:     num(fields.drivers_women_count),
      is_sleeping_group:       !!fields.is_sleeping_group,
      arrival_lunch:           !!fields.arrival_lunch,
      departure_lunch:         !!fields.departure_lunch,
      special_diets:           fields.special_diets             || '{}',
      meal_plan:               fields.meal_plan                 || '[]',
      tent_distribution_notes: fields.tent_distribution_notes   || '{}',
      schedule_notes:          fields.schedule_notes            || '[]',
      general_notes:           fields.general_notes             || '',
      submitted_at: now,
      source:       'LINK',
      status:       'SUBMITTED',
    };

    console.log('[submitGuestForm] creating submission...');
    const submission = await base44.asServiceRole.entities.GuestFormSubmission.create(submissionData);

    // ── DAY_USE kitchen sync ─────────────────────────────────────────────────
    // Fetch group to check type and get activity date
    let groupForSync = null;
    try {
      const groups = await base44.asServiceRole.entities.Group.filter({ id: group_id });
      groupForSync = groups[0] || null;
    } catch { /* non-fatal */ }

    if (groupForSync?.group_type === 'DAY_USE') {
      const activity_date = groupForSync.arrival_date;
      const total_pax     = num(fields.total_pax) || 0;

      // Parse DAY_USE meal selections
      let dayUseMeals = {};
      try { dayUseMeals = JSON.parse(fields.meal_plan || '{}'); } catch { dayUseMeals = {}; }

      // Parse coffee corner
      let coffeeCorner = null;
      try { coffeeCorner = fields.day_use_coffee_corner ? JSON.parse(fields.day_use_coffee_corner) : null; } catch { coffeeCorner = null; }

      // Find operational group profile id (best-effort)
      let profile_id = '';
      try {
        const profiles = await base44.asServiceRole.entities.OperationalGroupProfile.filter({ group_id });
        profile_id = profiles[0]?.id || '';
      } catch { /* non-fatal */ }

      if (activity_date && total_pax > 0) {
        try {
          await syncDayUseKitchen({ base44, group_id, profile_id, activity_date, total_pax, dayUseMeals, coffeeCorner });
          console.log('[submitGuestForm] DAY_USE kitchen sync complete');
        } catch (syncErr) {
          console.warn('[submitGuestForm] kitchen sync failed (non-fatal):', syncErr?.message);
        }
      } else {
        console.warn('[submitGuestForm] skipping kitchen sync — missing activity_date or total_pax', { activity_date, total_pax });
      }
    }

    // ── Sync arrival/departure times to Group ────────────────────────────────
    // The guest form is the operational truth for times — always update the group
    const arrivalTime   = fields.estimated_arrival_time   || null;
    const departureTime = fields.estimated_departure_time || null;
    if (arrivalTime || departureTime) {
      try {
        const timeUpdate = {};
        if (arrivalTime)   timeUpdate.arrival_time   = arrivalTime;
        if (departureTime) timeUpdate.departure_time = departureTime;
        await base44.asServiceRole.entities.Group.update(group_id, timeUpdate);
        console.log('[submitGuestForm] synced arrival/departure times to Group:', timeUpdate);
      } catch (timeErr) {
        console.warn('[submitGuestForm] failed to sync times to Group (non-fatal):', timeErr?.message);
      }
    }

    // ── Create review alert so admin sees the new submission ─────────────────
    try {
      await base44.asServiceRole.entities.OperationalReviewAlert.create({
        group_id,
        module:   'GROUP',
        severity: 'WARNING',
        source:   'GUEST_FORM_SUBMITTED',
        title:    'נתונים חדשים התקבלו מהטופס החיצוני',
        message:  'התקבלו נתונים חדשים מהטופס החיצוני עבור הקבוצה. יש לבדוק את הנתונים לפני סנכרון.',
        status:   'OPEN',
        new_value_json: JSON.stringify({ submission_id: submission.id, submitted_at: now }),
      });
    } catch (alertErr) {
      console.warn('[submitGuestForm] failed to create review alert:', alertErr?.message);
    }

    return Response.json({ success: true, submission_id: submission.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});