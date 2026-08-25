import { normalizeStayPeriods } from "./groupStayPeriods.js";

export async function loadGuestFormStayPeriods(base44, groupId, token) {
  if (!token) throw Object.assign(new Error("INVALID_FORM_TOKEN"), { code: "INVALID_FORM_TOKEN" });

  const links = await base44.asServiceRole.entities.GroupExternalFormLink.filter({ group_id: groupId });
  const activeLink = links.find(link => link.token === token && link.status === "ACTIVE");
  const maxVersion = Math.max(0, ...links.map(link => link.version_number || 0));
  if (!activeLink || (activeLink.version_number || 0) < maxVersion) {
    throw Object.assign(new Error("INVALID_FORM_TOKEN"), { code: "INVALID_FORM_TOKEN" });
  }

  const periods = normalizeStayPeriods(
    await base44.asServiceRole.entities.GroupStayPeriod.filter({ group_id: groupId, status: "ACTIVE" })
  );
  return periods.map(period => ({
    id: period.id,
    start_date: period.start_date,
    end_date: period.end_date,
    arrival_time: period.arrival_time || "",
    departure_time: period.departure_time || "",
  }));
}

export async function updateGuestFormStayPeriodTimes(base44, groupId, token, requestedPeriods) {
  const periods = await loadGuestFormStayPeriods(base44, groupId, token);
  const byId = new Map(periods.map(period => [period.id, period]));
  const requested = Array.isArray(requestedPeriods) ? requestedPeriods : [];

  for (const item of requested) {
    if (!item?.id || !byId.has(item.id)) {
      throw Object.assign(new Error("FOREIGN_STAY_PERIOD"), { code: "FOREIGN_STAY_PERIOD" });
    }
  }

  let updated = 0;
  for (const item of requested) {
    const current = byId.get(item.id);
    const arrivalTime = typeof item.arrival_time === "string" ? item.arrival_time : "";
    const departureTime = typeof item.departure_time === "string" ? item.departure_time : "";
    if (arrivalTime === current.arrival_time && departureTime === current.departure_time) continue;
    await base44.asServiceRole.entities.GroupStayPeriod.update(item.id, {
      arrival_time: arrivalTime || null,
      departure_time: departureTime || null,
    });
    updated += 1;
  }
  return { updated };
}