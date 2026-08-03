import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { isGroupOperationallyEnabled } from '../../shared/groupOperationalIsolation.js';

// generateDailyBriefData — READ-ONLY.
// Reads operational data for a single date and returns a structured summary object.
// It NEVER writes/creates/updates/deletes any entity. The frontend stores the
// returned object into DailyStaffBrief.auto_summary_json when the user saves/refreshes.

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);

// Operationally sensitive space names (substring match on ActivitySpace.name)
const SENSITIVE_NAMES = ["חדר אוכל", "אוהל מועד", "חדר תקווה", "חדר אומץ", "שירותים", "מכולות"];

// GroupScheduleItem equipment flags -> Hebrew label
const EQUIPMENT_MAP = [
  { field: "needs_projector", label: "מקרן" },
  { field: "needs_screen", label: "מסך" },
  { field: "needs_microphone", label: "מיקרופון" },
  { field: "needs_sound", label: "סאונד" },
  { field: "needs_whiteboard", label: "לוח" },
  { field: "needs_chair_circle", label: "מעגל כיסאות" },
];

function toMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== "string" || !hhmm.includes(":")) return null;
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function isSensitive(name) {
  if (!name) return false;
  return SENSITIVE_NAMES.some((s) => name.includes(s));
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Resolve internal role — only ADMIN / SUPER_ADMIN may generate
    let role = null;
    try {
      const internalUsers = await base44.asServiceRole.entities.InternalUser.filter({ email: user.email });
      role = internalUsers?.[0]?.role || null;
    } catch (_e) {
      role = null;
    }
    if (!role || !ADMIN_ROLES.has(role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const date = body?.date;
    if (!date || typeof date !== "string") {
      return Response.json({ error: 'Missing date' }, { status: 400 });
    }

    const nextDate = new Date(date + "T00:00:00Z");
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const nextDateStr = nextDate.toISOString().slice(0, 10);

    // ── Read all needed data (read-only) ──────────────────────────────────
    const [groups, profiles, meals, coffee, prisa, activities, spaces, maintenance, standaloneActivities, standaloneAssignments] = await Promise.all([
      base44.asServiceRole.entities.Group.list("-arrival_date", 500),
      base44.asServiceRole.entities.OperationalGroupProfile.list("-accepted_at", 500),
      base44.asServiceRole.entities.MealReservation.filter({ date, status: "ACTIVE" }),
      base44.asServiceRole.entities.CoffeeCornerRequest.filter({ date, status: "ACTIVE" }),
      base44.asServiceRole.entities.PrisaRequest.filter({ date, status: "ACTIVE" }),
      base44.asServiceRole.entities.GroupScheduleItem.filter({ date, status: "ACTIVE" }),
      base44.asServiceRole.entities.ActivitySpace.list("", 500),
      base44.asServiceRole.entities.MaintenanceIssue.filter({ status: { $in: ["OPEN", "IN_PROGRESS", "WAITING_PARTS"] } }, "-created_date", 500),
      base44.asServiceRole.entities.StandaloneActivityReservation.filter({ event_date: date, status: "ACTIVE" }),
      base44.asServiceRole.entities.StandaloneActivitySpaceAssignment.list("-created_date", 500),
    ]);

    const EXCLUDED = new Set(["CANCELLED", "COMPLETED", "ARCHIVED"]);
    const operationalGroups = groups.filter(isGroupOperationallyEnabled);
    const groupById = Object.fromEntries(operationalGroups.map((g) => [g.id, g]));
    const spaceById = Object.fromEntries(spaces.map((s) => [s.id, s]));

    const groupName = (id) => String(id || "").startsWith("__standalone__") ? "פעילות כללית" : groupById[id]?.group_name || "קבוצה";
    const paxForGroup = (id) => {
      const p = profiles.find((pr) => pr.group_id === id);
      const g = groupById[id];
      return p?.total_pax ?? g?.total_pax ?? null;
    };

    // ── 1. Groups today ───────────────────────────────────────────────────
    const activeToday = operationalGroups.filter((g) => {
      if (EXCLUDED.has(g.status)) return false;
      if (g.group_type === "DAY_USE") return g.arrival_date === date;
      const dep = g.departure_date && g.departure_date.trim() !== "" ? g.departure_date : null;
      if (!dep) return g.arrival_date === date;
      return g.arrival_date <= date && dep > date;
    });

    const arrivals = activeToday
      .filter((g) => g.arrival_date === date)
      .map((g) => ({ name: g.group_name, type: g.group_type, arrival_time: g.arrival_time || null, pax: paxForGroup(g.id) }));

    const departures = operationalGroups
      .filter((g) => !EXCLUDED.has(g.status) && g.group_type === "LODGING" && g.departure_date === date)
      .map((g) => ({ name: g.group_name, departure_time: g.departure_time || null, pax: paxForGroup(g.id) }));

    const sleeping = operationalGroups
      .filter((g) => {
        if (EXCLUDED.has(g.status) || g.group_type !== "LODGING") return false;
        const dep = g.departure_date && g.departure_date.trim() !== "" ? g.departure_date : null;
        return dep && g.arrival_date <= date && dep > date;
      })
      .map((g) => ({ name: g.group_name, pax: paxForGroup(g.id) }));

    const dayUse = activeToday
      .filter((g) => g.group_type === "DAY_USE")
      .map((g) => ({ name: g.group_name, arrival_time: g.arrival_time || null, departure_time: g.departure_time || null, pax: paxForGroup(g.id) }));

    // ── 2. Meals ───────────────────────────────────────────────────────────
    const MEAL_LABELS = { BREAKFAST: "ארוחת בוקר", LUNCH: "ארוחת צהריים", DINNER: "ארוחת ערב", COFFEE_CORNER: "פינת קפה", OTHER: "אחר" };
    const MEAL_ORDER = { BREAKFAST: 1, LUNCH: 2, DINNER: 3, COFFEE_CORNER: 4, OTHER: 5 };
    const mealsOut = meals
      .filter((m) => groupById[m.group_id] && m.meal_type !== "COFFEE_CORNER")
      .map((m) => {
        let diets = null;
        if (m.special_diets_summary) {
          try { diets = JSON.parse(m.special_diets_summary); } catch (_e) { diets = null; }
        }
        return {
          meal_type: m.meal_type,
          label: MEAL_LABELS[m.meal_type] || m.meal_type,
          start_time: m.start_time || null,
          end_time: m.end_time || null,
          group: groupName(m.group_id),
          pax: m.pax ?? null,
          diets,
          notes: m.notes || null,
        };
      })
      .sort((a, b) => (MEAL_ORDER[a.meal_type] || 9) - (MEAL_ORDER[b.meal_type] || 9) || (toMinutes(a.start_time) ?? 0) - (toMinutes(b.start_time) ?? 0));

    // ── 3. Coffee corner ─────────────────────────────────────────────────
    const coffeeTypeLabel = (value) => value === "HOT_WATER_THERMOCAN_ONLY" ? "מיחם וטרמוקן בלבד" : value || null;
    const coffeeOut = coffee
      .filter((c) => groupById[c.group_id])
      .map((c) => ({
        start_time: c.start_time || null,
        end_time: c.end_time || null,
        group: groupName(c.group_id),
        pax: c.pax ?? null,
        type: coffeeTypeLabel(c.coffee_corner_type),
        location: c.location_name_snapshot || null,
      }))
      .sort((a, b) => (toMinutes(a.start_time) ?? 0) - (toMinutes(b.start_time) ?? 0));

    // ── 4. Prisa (פריסה) ──────────────────────────────────────────────────
    const PRISA_SLOT = { AFTER_BREAKFAST: "אחרי ארוחת בוקר", AFTER_LUNCH: "אחרי ארוחת צהריים", AFTER_DINNER: "אחרי ארוחת ערב" };
    const PRISA_TYPE = { REGULAR: "רגיל", DOUBLE: "כפול" };
    const prisaOut = prisa.filter((p) => groupById[p.group_id]).map((p) => ({
      group: groupName(p.group_id),
      slot: PRISA_SLOT[p.pickup_slot] || p.pickup_slot || null,
      type: PRISA_TYPE[p.type] || p.type || null,
      quantity: p.effective_quantity ?? p.quantity ?? null,
    }));

    // ── 5. Activity spaces — flag those needing attention ────────────────
    const standaloneSpaceActivities = standaloneAssignments.flatMap((assignment) => {
      const reservation = standaloneActivities.find((item) => item.id === assignment.reservation_id);
      return reservation ? [{ ...assignment, group_id: `__standalone__${reservation.id}`, activity_space_id: assignment.activity_space_id, activity_name: reservation.title, start_time: reservation.start_time, end_time: reservation.end_time, pax: reservation.expected_pax, notes: [reservation.preparation_notes, reservation.cleanup_notes].filter(Boolean).join(" | ") }] : [];
    });
    const spaceActivities = [...activities.filter((item) => groupById[item.group_id]), ...standaloneSpaceActivities];
    const bySpace = {};
    for (const a of spaceActivities) {
      const key = a.activity_space_id || `__name__${a.activity_space_code || a.requested_location || "לא משויך"}`;
      if (!bySpace[key]) bySpace[key] = [];
      bySpace[key].push(a);
    }

    const flaggedSpaces = [];
    for (const key of Object.keys(bySpace)) {
      const items = bySpace[key].slice().sort((x, y) => (toMinutes(x.start_time) ?? 0) - (toMinutes(y.start_time) ?? 0));
      const spaceObj = key.startsWith("__name__") ? null : spaceById[key];
      const spaceName = spaceObj?.name || items[0]?.activity_space_code || items[0]?.requested_location || "מרחב לא משויך";

      const groupSet = new Set(items.map((i) => i.group_id));
      const activityCount = items.length;

      // total usage duration (minutes) & gaps
      let totalMinutes = 0;
      let hasShortGap = false;
      for (let i = 0; i < items.length; i++) {
        const s = toMinutes(items[i].start_time);
        const e = toMinutes(items[i].end_time);
        if (s != null && e != null && e > s) totalMinutes += e - s;
        if (i > 0) {
          const prevEnd = toMinutes(items[i - 1].end_time);
          const curStart = toMinutes(items[i].start_time);
          if (prevEnd != null && curStart != null && curStart - prevEnd < 60) hasShortGap = true;
        }
      }

      // equipment needed across items
      const equipment = [];
      for (const eq of EQUIPMENT_MAP) {
        if (items.some((i) => i[eq.field])) equipment.push(eq.label);
      }

      const multipleGroups = groupSet.size > 1;
      const manyActivities = activityCount >= 3;
      const longUsage = totalMinutes > 240;
      const sensitive = isSensitive(spaceName);
      const needsEquipment = equipment.length > 0;

      const shouldFlag = multipleGroups || manyActivities || longUsage || hasShortGap || needsEquipment || sensitive;
      if (!shouldFlag) continue;

      // recommendation
      const recommendations = [];
      if (needsEquipment) recommendations.push("לבדוק ציוד לפני תחילת הפעילות");
      if (multipleGroups || hasShortGap) recommendations.push("לוודא איפוס בין פעילויות");
      if (sensitive) recommendations.push("לוודא סידור לפני הפעילות");
      if (longUsage || manyActivities) recommendations.push("לוודא ניקיון/סידור בסוף היום");

      const firstUse = items[0]?.start_time || null;
      const lastUse = items[items.length - 1]?.end_time || items[items.length - 1]?.start_time || null;

      flaggedSpaces.push({
        space_name: spaceName,
        first_use: firstUse,
        last_use: lastUse,
        activity_count: activityCount,
        groups: [...groupSet].map((id) => groupName(id)),
        equipment,
        recommendations: [...new Set(recommendations)],
      });
    }
    flaggedSpaces.sort((a, b) => (toMinutes(a.first_use) ?? 0) - (toMinutes(b.first_use) ?? 0));

    // ── 6. Maintenance — open/in-progress only ────────────────────────────
    const PRIORITY = { LOW: "נמוכה", MEDIUM: "בינונית", HIGH: "גבוהה", URGENT: "דחוף" };
    const maintenanceOut = maintenance.map((m) => ({
      title: m.title || null,
      location: m.location_name || null,
      priority: PRIORITY[m.priority] || m.priority || null,
      status: m.status || null,
    }));

    const summary = {
      date,
      generated_at: new Date().toISOString(),
      groups: { arrivals, departures, sleeping, day_use: dayUse },
      meals: mealsOut,
      coffee_corner: coffeeOut,
      prisa: prisaOut,
      activity_spaces: flaggedSpaces,
      maintenance: maintenanceOut,
    };

    return Response.json({ summary });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}