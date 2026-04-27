import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Checks site availability for a given date range, pax, group_type.
 * Returns capacity info and any warnings.
 *
 * Payload:
 *   arrival_date:    string (YYYY-MM-DD)
 *   departure_date:  string (YYYY-MM-DD, optional for DAY_USE)
 *   total_pax:       number
 *   group_type:      "LODGING" | "DAY_USE"
 *   includes_meals:  boolean
 *   exclude_quote_id: string (optional — exclude this quote's own hold from calc)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { arrival_date, departure_date, total_pax, group_type, includes_meals, exclude_quote_id } = body;

    if (!arrival_date || !total_pax || !group_type) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Load SiteSettings (first/only record)
    const settingsArr = await base44.asServiceRole.entities.SiteSettings.list();
    const settings = settingsArr[0] || {};
    const maxSleeping = Number(settings.max_sleeping_pax) || 0;
    const maxDayUse   = Number(settings.max_day_use_pax)  || 0;
    const maxMeal     = Number(settings.max_meal_pax)     || 0;

    // Load all ACTIVE OperationalHolds
    const allHolds = await base44.asServiceRole.entities.OperationalHold.filter({ status: "ACTIVE" });

    // Filter holds that overlap with the requested date range
    const reqArrival   = new Date(arrival_date);
    const reqDeparture = departure_date ? new Date(departure_date) : new Date(arrival_date);

    const overlapping = allHolds.filter(h => {
      if (exclude_quote_id && h.quote_id === exclude_quote_id) return false;
      const hArr = new Date(h.arrival_date);
      const hDep = h.departure_date ? new Date(h.departure_date) : new Date(h.arrival_date);
      // Overlaps if not (hDep < reqArr || hArr > reqDep)
      return !(hDep < reqArrival || hArr > reqDeparture);
    });

    // Sum pax by type
    const heldSleepingPax = overlapping
      .filter(h => h.group_type === "LODGING")
      .reduce((s, h) => s + (Number(h.total_pax) || 0), 0);

    const heldDayUsePax = overlapping
      .filter(h => h.group_type === "DAY_USE")
      .reduce((s, h) => s + (Number(h.total_pax) || 0), 0);

    const heldMealPax = overlapping
      .filter(h => h.includes_meals)
      .reduce((s, h) => s + (Number(h.total_pax) || 0), 0);

    const requestedPax = Number(total_pax) || 0;
    const warnings = [];
    const capacityInfo = {};

    // ── Sleeping capacity ──────────────────────────────────────────────────────
    if (group_type === "LODGING") {
      if (maxSleeping > 0) {
        const totalAfter = heldSleepingPax + requestedPax;
        capacityInfo.sleeping = { max: maxSleeping, held: heldSleepingPax, requested: requestedPax, totalAfter };

        if (totalAfter > maxSleeping) {
          warnings.push({
            type: "SLEEPING_CAPACITY",
            severity: "WARNING",
            message: `קיבולת לינה תעלה על ${maxSleeping} (${totalAfter}/${maxSleeping})`,
            held: heldSleepingPax,
            requested: requestedPax,
            max: maxSleeping
          });
        } else if (totalAfter >= maxSleeping * 0.85) {
          // Near-full warning: 85% or more of max capacity
          const pct = Math.round((totalAfter / maxSleeping) * 100);
          warnings.push({
            type: "SLEEPING_CAPACITY_NEAR_FULL",
            severity: "NEAR_FULL",
            message: `האתר קרוב לתפוסה מלאה בתאריכים אלו: ${totalAfter}/${maxSleeping} (${pct}%)`,
            held: heldSleepingPax,
            requested: requestedPax,
            max: maxSleeping,
            percentage: pct
          });
        }
      } else {
        capacityInfo.sleeping = { max: 0, held: heldSleepingPax, requested: requestedPax, unconfigured: true };
      }
    }

    // ── Day-use capacity ───────────────────────────────────────────────────────
    if (group_type === "DAY_USE") {
      if (maxDayUse > 0) {
        const totalAfter = heldDayUsePax + requestedPax;
        capacityInfo.day_use = { max: maxDayUse, held: heldDayUsePax, requested: requestedPax, totalAfter };
        if (totalAfter > maxDayUse) {
          warnings.push({
            type: "DAY_USE_CAPACITY",
            severity: "WARNING",
            message: `קיבולת יום כיף תעלה על ${maxDayUse} (${totalAfter}/${maxDayUse})`,
            held: heldDayUsePax,
            requested: requestedPax,
            max: maxDayUse
          });
        }
      } else {
        capacityInfo.day_use = { max: 0, held: heldDayUsePax, requested: requestedPax, unconfigured: true };
      }
    }

    // ── Meal capacity ──────────────────────────────────────────────────────────
    if (includes_meals) {
      if (maxMeal > 0) {
        const totalAfter = heldMealPax + requestedPax;
        capacityInfo.meals = { max: maxMeal, held: heldMealPax, requested: requestedPax, totalAfter };
        if (totalAfter > maxMeal) {
          warnings.push({
            type: "MEAL_CAPACITY",
            severity: "WARNING",
            message: `קיבולת ארוחות תעלה על ${maxMeal} (${totalAfter}/${maxMeal})`,
            held: heldMealPax,
            requested: requestedPax,
            max: maxMeal
          });
        }
      } else {
        capacityInfo.meals = { max: 0, held: heldMealPax, requested: requestedPax, unconfigured: true };
      }
    }

    return Response.json({
      warnings,
      capacityInfo,
      overlappingHoldsCount: overlapping.length,
      settings: { maxSleeping, maxDayUse, maxMeal }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});