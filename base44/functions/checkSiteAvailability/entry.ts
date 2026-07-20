import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { isPreparationGroupOperational } from '../../shared/quotePreparationConfig.js';

/**
 * Enhanced availability check:
 *  - Counts real lodging Groups (not just OperationalHold)
 *  - Per-night calculation
 *  - VIP tent availability
 *  - Student tent requirement
 *
 * Payload:
 *   arrival_date        string YYYY-MM-DD
 *   departure_date      string YYYY-MM-DD (optional for DAY_USE)
 *   total_pax           number
 *   participant_count   number (students, optional)
 *   staff_count         number (optional)
 *   boys_count          number (optional)
 *   girls_count         number (optional)
 *   group_type          "LODGING" | "DAY_USE"
 *   includes_meals      boolean
 *   exclude_quote_id    string (optional)
 *   exclude_group_id    string (optional)
 *   adult_lodging_lines string JSON (optional – to count required VIP tents from quote)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const {
      arrival_date, departure_date, total_pax, group_type,
      participant_count, staff_count, boys_count, girls_count,
      exclude_quote_id, exclude_group_id, adult_lodging_lines,
    } = body;

    if (!arrival_date || !total_pax || !group_type) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const STUDENT_TENT_CAP = 8;
    const NEAR_FULL_PCT = 0.85;

    // ── Load settings ──────────────────────────────────────────────────────────
    const [settingsArr, allTents] = await Promise.all([
      base44.asServiceRole.entities.SiteSettings.list(),
      base44.asServiceRole.entities.Tent.list(),
    ]);
    const settings = settingsArr[0] || {};
    const maxSleeping = Number(settings.max_sleeping_pax) || 0;
    const maxDayUse   = Number(settings.max_day_use_pax)  || 0;
    const maxMeal     = Number(settings.max_meal_pax)     || 0;

    // Count real tent inventory
    const totalVipTents     = allTents.filter(t => t.tent_type === "VIP"     && t.working_status === "WORKING").length || 10;
    const totalStudentTents = allTents.filter(t => t.tent_type === "STANDARD" && t.working_status === "WORKING").length || 0;

    const reqArrival   = new Date(arrival_date);
    const reqDeparture = departure_date ? new Date(departure_date) : new Date(arrival_date);

    // Build list of lodging nights (arrival inclusive, departure exclusive)
    const lodgingNights = [];
    if (group_type === "LODGING") {
      const cur = new Date(reqArrival);
      while (cur < reqDeparture) {
        lodgingNights.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
      // DAY_USE has no nights — lodgingNights stays empty
    }

    // ── Load all data in parallel ──────────────────────────────────────────────
    const [allGroups, allProfiles, allHolds, allAllocations] = await Promise.all([
      base44.asServiceRole.entities.Group.list("-arrival_date", 1000),
      base44.asServiceRole.entities.OperationalGroupProfile.list(),
      base44.asServiceRole.entities.OperationalHold.filter({ status: "ACTIVE" }),
      base44.asServiceRole.entities.SleepingAllocation.filter({ status: { $in: ["DRAFT", "CONFIRMED"] } }),
    ]);

    // Index profiles by group_id for fast lookup
    const groupById = Object.fromEntries(allGroups.map(g => [g.id, g]));
    const profileByGroupId = {};
    for (const p of allProfiles) profileByGroupId[p.group_id] = p;

    // Index allocations by group_id
    const allocationsByGroupId = {};
    for (const a of allAllocations) {
      if (!allocationsByGroupId[a.group_id]) allocationsByGroupId[a.group_id] = [];
      allocationsByGroupId[a.group_id].push(a);
    }

    // Set of group_ids already represented by a counted Group (to avoid Hold double-count)
    const countedGroupIds = new Set();

    // ── Helper: does a [arrStr, depStr) overlap a given night? ────────────────
    const nightOverlaps = (arrStr, depStr, night) => {
      const arr = new Date(arrStr);
      const dep = depStr ? new Date(depStr) : new Date(arrStr);
      const n   = new Date(night);
      return n >= arr && n < dep;
    };

    // ── Per-night structures ───────────────────────────────────────────────────
    const lodgingPerNight   = {}; // night -> { pax, groups: [] }
    const vipPerNight       = {}; // night -> { occupied }
    const studentPerNight   = {}; // night -> { occupied }
    for (const night of lodgingNights) {
      lodgingPerNight[night]  = { pax: 0, sources: [] };
      vipPerNight[night]      = { occupied: 0 };
      studentPerNight[night]  = { occupied: 0 };
    }

    // ── Count lodging Groups ───────────────────────────────────────────────────
    const activeStatuses = ["CONFIRMED", "COMPLETED"];
    for (const g of allGroups) {
      if (g.group_type !== "LODGING" || !isPreparationGroupOperational(g)) continue;
      if (!activeStatuses.includes(g.status)) continue;
      if (g.id === exclude_group_id) continue;
      if (!g.arrival_date) continue;

      for (const night of lodgingNights) {
        if (!nightOverlaps(g.arrival_date, g.departure_date, night)) continue;

        const profile = profileByGroupId[g.id];
        const pax = Number(g.total_pax)
          || Number(profile?.total_pax)
          || (Number(profile?.participant_count || 0) + Number(profile?.staff_count || 0))
          || 0;

        lodgingPerNight[night].pax += pax;
        lodgingPerNight[night].sources.push(g.group_name || g.id);
        countedGroupIds.add(g.id);

        // VIP tents from allocations or profile
        const groupAllocs = allocationsByGroupId[g.id] || [];
        const hasVipAllocs = groupAllocs.some(a => a.allocation_type === "STAFF");
        if (hasVipAllocs) {
          // Count distinct tents used as VIP (STAFF allocation_type maps to VIP tents)
          const vipTentIds = new Set(groupAllocs.filter(a => a.allocation_type === "STAFF").map(a => a.tent_id));
          vipPerNight[night].occupied += vipTentIds.size;
        } else if (profile) {
          // Fallback: use profile VIP tent requirements
          const vipTentsNeeded = Number(profile.vip_tents_men_needed || 0) + Number(profile.vip_tents_women_needed || 0);
          vipPerNight[night].occupied += vipTentsNeeded;
        }

        // Student tents from allocations
        const studentAllocs = groupAllocs.filter(a => a.allocation_type === "STUDENT");
        if (studentAllocs.length > 0) {
          const studentTentIds = new Set(studentAllocs.map(a => a.tent_id));
          studentPerNight[night].occupied += studentTentIds.size;
        } else if (profile) {
          // Fallback: estimate from profile bed requirements
          const boysBeds  = Number(profile.boys_beds_needed  || 0);
          const girlsBeds = Number(profile.girls_beds_needed || 0);
          if (boysBeds > 0 || girlsBeds > 0) {
            studentPerNight[night].occupied +=
              Math.ceil(boysBeds / STUDENT_TENT_CAP) + Math.ceil(girlsBeds / STUDENT_TENT_CAP);
          }
        }
      }
    }

    // ── Count approved OperationalHolds not already represented by a Group ─────
    for (const h of allHolds) {
      if (h.group_type !== "LODGING") continue;
      if (h.group_id && !isPreparationGroupOperational(groupById[h.group_id])) continue;
      if (exclude_quote_id && h.quote_id === exclude_quote_id) continue;
      if (h.group_id && countedGroupIds.has(h.group_id)) continue; // already counted as Group

      for (const night of lodgingNights) {
        if (!nightOverlaps(h.arrival_date, h.departure_date, night)) continue;
        lodgingPerNight[night].pax += Number(h.total_pax) || 0;
        lodgingPerNight[night].sources.push(`hold:${h.id}`);
      }
    }

    // ── DAY_USE capacity (legacy behavior) ────────────────────────────────────
    let dayUseWarning = null;
    let dayUseCapacityInfo = null;
    if (group_type === "DAY_USE") {
      const overlappingDayHolds = allHolds.filter(h => {
        if (h.group_type !== "DAY_USE") return false;
        if (h.group_id && !isPreparationGroupOperational(groupById[h.group_id])) return false;
        if (exclude_quote_id && h.quote_id === exclude_quote_id) return false;
        const hArr = new Date(h.arrival_date);
        const hDep = h.departure_date ? new Date(h.departure_date) : new Date(h.arrival_date);
        return !(hDep < reqArrival || hArr > reqDeparture);
      });
      const heldDayUsePax = overlappingDayHolds.reduce((s, h) => s + (Number(h.total_pax) || 0), 0);
      const requestedPax  = Number(total_pax) || 0;
      const totalAfter    = heldDayUsePax + requestedPax;
      dayUseCapacityInfo  = { max: maxDayUse, held: heldDayUsePax, requested: requestedPax, totalAfter };
      if (maxDayUse > 0 && totalAfter > maxDayUse) {
        dayUseWarning = { type: "DAY_USE_CAPACITY", severity: "WARNING",
          message: `קיבולת יום כיף תעלה על ${maxDayUse} (${totalAfter}/${maxDayUse})`,
          held: heldDayUsePax, requested: requestedPax, max: maxDayUse };
      }
    }

    // ── Calculate required student tents for current quote ────────────────────
    const students = Number(participant_count) || Math.max(0, Number(total_pax || 0) - Number(staff_count || 0));
    const boys  = Number(boys_count  || 0);
    const girls = Number(girls_count || 0);
    let requiredStudentTents = 0;
    if (group_type === "LODGING" && students > 0) {
      if (boys > 0 || girls > 0) {
        requiredStudentTents = Math.ceil(boys / STUDENT_TENT_CAP) + Math.ceil(girls / STUDENT_TENT_CAP);
      } else {
        if (students === 1) requiredStudentTents = 1;
        else requiredStudentTents = Math.ceil((students - 1) / STUDENT_TENT_CAP) + 1;
      }
    }

    // ── Required VIP tents from current quote adult_lodging_lines ─────────────
    let requiredVipTents = 0;
    if (adult_lodging_lines) {
      try {
        const lines = JSON.parse(adult_lodging_lines);
        if (Array.isArray(lines)) {
          requiredVipTents = lines.reduce((s, l) => s + (Number(l.tent_count) || 0), 0);
        }
      } catch { /* ignore */ }
    }

    // ── Build per-night arrays for response ───────────────────────────────────
    const requestedPax = Number(total_pax) || 0;
    const warnings     = [];
    const messages     = [];

    // Lodging per-night analysis
    const lodgingPerNightArr = lodgingNights.map(night => {
      const existing = lodgingPerNight[night].pax;
      const total    = existing + requestedPax;
      return { night, existing, total, capacity: maxSleeping };
    });

    let maxLodgingUsed = 0;
    let worstLodgingNight = null;
    for (const n of lodgingPerNightArr) {
      if (n.total > maxLodgingUsed) { maxLodgingUsed = n.total; worstLodgingNight = n; }
    }

    if (group_type === "LODGING" && maxSleeping > 0 && worstLodgingNight) {
      if (worstLodgingNight.total > maxSleeping) {
        const nightFmt = worstLodgingNight.night.slice(5).replace("-", "/");
        const msg = `בתאריך ${nightFmt} צפויים ללון באתר ${worstLodgingNight.total} אנשים מתוך ${maxSleeping}.\nיש חריגה מתפוסת הלינה המקסימלית.`;
        warnings.push({ type: "SLEEPING_CAPACITY", severity: "WARNING",
          message: msg, held: worstLodgingNight.existing, requested: requestedPax, max: maxSleeping });
        messages.push(msg);
      } else if (worstLodgingNight.total >= maxSleeping * NEAR_FULL_PCT) {
        const pct = Math.round((worstLodgingNight.total / maxSleeping) * 100);
        const nightFmt = worstLodgingNight.night.slice(5).replace("-", "/");
        const msg = `בתאריך ${nightFmt} צפויים ללון באתר ${worstLodgingNight.total} אנשים מתוך ${maxSleeping}.\nכולל קבוצות קיימות וההצעה הנוכחית.`;
        warnings.push({ type: "SLEEPING_CAPACITY_NEAR_FULL", severity: "NEAR_FULL",
          message: msg, held: worstLodgingNight.existing, requested: requestedPax, max: maxSleeping, percentage: pct });
        messages.push(msg);
      }
    }

    // VIP per-night analysis
    const vipPerNightArr = lodgingNights.map(night => {
      const occupied  = vipPerNight[night].occupied;
      const available = Math.max(0, totalVipTents - occupied);
      return { night, occupied, available, total: totalVipTents };
    });

    const minVipAvailable = vipPerNightArr.length > 0
      ? Math.min(...vipPerNightArr.map(n => n.available))
      : totalVipTents;

    let vipWarning = null;
    if (group_type === "LODGING" && vipPerNightArr.length > 0) {
      const worstVip = vipPerNightArr.reduce((w, n) => n.available < w.available ? n : w, vipPerNightArr[0]);
      if (requiredVipTents > 0 && requiredVipTents > minVipAvailable) {
        const nightFmt = worstVip.night.slice(5).replace("-", "/");
        vipWarning = `ההצעה דורשת ${requiredVipTents} אוהלי VIP, אך בלילה ${nightFmt} זמינים רק ${worstVip.available} מתוך ${totalVipTents}.`;
        warnings.push({ type: "VIP_CAPACITY", severity: "WARNING", message: vipWarning });
      } else if (minVipAvailable <= 2 && totalVipTents > 0) {
        const nightFmt = worstVip.night.slice(5).replace("-", "/");
        vipWarning = `שים לב: במהלך התאריכים שנבחרו יש לילה שבו זמינים רק ${minVipAvailable} אוהלי VIP.\n${nightFmt} — ${totalVipTents - minVipAvailable} מתוך ${totalVipTents} תפוסים.`;
        warnings.push({ type: "VIP_LOW", severity: "NEAR_FULL", message: vipWarning });
      }
    }

    // Student tent per-night analysis
    const studentPerNightArr = lodgingNights.map(night => {
      const occupied  = studentPerNight[night].occupied;
      const available = totalStudentTents > 0 ? Math.max(0, totalStudentTents - occupied) : null;
      return { night, occupied, available, total: totalStudentTents };
    });

    const minStudentAvailable = (totalStudentTents > 0 && studentPerNightArr.length > 0)
      ? Math.min(...studentPerNightArr.map(n => n.available))
      : null;

    let studentWarning = null;
    let needsNeighborhoodCombination = false;
    if (group_type === "LODGING" && requiredStudentTents > 0) {
      if (minStudentAvailable !== null && requiredStudentTents > minStudentAvailable) {
        studentWarning = `ההצעה דורשת לפחות ${requiredStudentTents} אוהלי תלמידים, אך זמינים רק ${minStudentAvailable} במהלך התאריכים.`;
        warnings.push({ type: "STUDENT_TENTS", severity: "WARNING", message: studentWarning });
      } else {
        // Check if neighborhood combination might be needed (simple heuristic: > 1 neighborhood typical capacity)
        const NEIGHBORHOOD_TENT_CAP = 20; // typical neighborhood tent count
        if (requiredStudentTents > NEIGHBORHOOD_TENT_CAP) {
          needsNeighborhoodCombination = true;
          studentWarning = `ניתן לאכלס את הקבוצה, אך ייתכן שיידרש שילוב בין שכונות או אישור שיתוף שכונה.`;
          warnings.push({ type: "STUDENT_NEIGHBORHOOD", severity: "NEAR_FULL", message: studentWarning });
        }
      }
    }

    // ── Build legacy capacityInfo for backward compat ─────────────────────────
    const capacityInfo = {};
    if (group_type === "LODGING" && maxSleeping > 0 && worstLodgingNight) {
      capacityInfo.sleeping = { max: maxSleeping, held: worstLodgingNight.existing, requested: requestedPax, totalAfter: worstLodgingNight.total };
    } else if (group_type === "LODGING" && maxSleeping === 0) {
      capacityInfo.sleeping = { max: 0, held: 0, requested: requestedPax, unconfigured: true };
    }
    if (group_type === "DAY_USE" && dayUseCapacityInfo) {
      capacityInfo.day_use = dayUseCapacityInfo;
    }
    if (dayUseWarning) warnings.unshift(dayUseWarning);

    // ── Overall status ─────────────────────────────────────────────────────────
    const hasBlocked  = false; // we never hard-block
    const hasWarning  = warnings.some(w => w.severity === "WARNING");
    const hasNearFull = warnings.some(w => w.severity === "NEAR_FULL");
    const overallStatus = hasBlocked ? "BLOCKED" : hasWarning ? "WARNING" : hasNearFull ? "NEAR_FULL" : "OK";

    return Response.json({
      // Legacy fields (backward compat)
      warnings,
      capacityInfo,
      overlappingHoldsCount: 0,
      settings: { maxSleeping, maxDayUse, maxMeal },

      // New structured fields
      status: overallStatus,
      lodging_people: {
        per_night: lodgingPerNightArr,
        max_used: maxLodgingUsed,
        capacity: maxSleeping,
      },
      vip_tents: {
        total: totalVipTents,
        min_available: minVipAvailable,
        per_night: vipPerNightArr,
        required_by_current_quote: requiredVipTents,
        warning: vipWarning,
      },
      student_tents: {
        required: requiredStudentTents,
        available_min: minStudentAvailable,
        per_night: studentPerNightArr,
        needs_neighborhood_combination: needsNeighborhoodCombination,
        warning: studentWarning,
      },
      messages,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});