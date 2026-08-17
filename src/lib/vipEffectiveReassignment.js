export function normalizeVipGender(gender) {
  if (gender === "MEN" || gender === "BOYS" || gender === "MALE") return "MEN";
  if (gender === "WOMEN" || gender === "GIRLS" || gender === "FEMALE") return "WOMEN";
  return gender || null;
}

export function getExactVipSourceCandidates({ allocations = [], requirement, effectiveDate, existingAllocation }) {
  const isCurrent = row => row?.status === "CONFIRMED" && row.arrival_date <= effectiveDate && effectiveDate < row.departure_date;
  if (isCurrent(existingAllocation)) return [existingAllocation];

  const requestedPax = Number(requirement?.people_count || 0);
  const requestedType = requirement?.allocation_type || "STAFF";
  const requestedGender = normalizeVipGender(requirement?.gender_group);
  return allocations.filter(row => {
    if (!isCurrent(row) || Number(row.allocated_pax) !== requestedPax) return false;
    if (row.allocation_type !== requestedType || (row.notes || "").includes("__alt_tent__")) return false;
    if (/__vip_req_\d+__/.test(row.notes || "")) return false;
    return !requestedGender || normalizeVipGender(row.gender_group) === requestedGender;
  });
}