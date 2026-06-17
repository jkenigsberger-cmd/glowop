/**
 * Unified allocation counting utility.
 *
 * Counts ALL active SleepingAllocation records for a group regardless of
 * allocation_type (STUDENT, STAFF) or internal markers (__alt_tent__, __vip_req_N__).
 *
 * Uses allocated_pax from actual SleepingAllocation records — never from
 * tent capacity, distribution JSON plans, or UI card display.
 */

const ALT_TENT_MARKER = "__alt_tent__";
const VIP_REQ_MARKER  = /__vip_req_\d+__/;

/**
 * @param {Array}  allocations - all SleepingAllocation records for the group
 * @param {Object} profile     - OperationalGroupProfile record
 * @returns {Object}
 */
export function computeAllocationCounts(allocations = [], profile = null) {
  // ── Active allocations (not CANCELLED) ────────────────────────────────
  const active = allocations.filter(a => a.status !== "CANCELLED");

  // ── Allocated pax by sub-category ─────────────────────────────────────
  const studentAllocs = active.filter(a => a.allocation_type === "STUDENT");
  const staffAllocs   = active.filter(a => a.allocation_type === "STAFF");

  // VIP allocations = STAFF allocations with __vip_req_N__ marker
  const vipAllocs = staffAllocs.filter(a => VIP_REQ_MARKER.test(a.notes || ""));
  // Alt tent allocations = STAFF allocations with __alt_tent__ marker
  const altTentAllocs = staffAllocs.filter(a => (a.notes || "").includes(ALT_TENT_MARKER));
  // Other staff (neither VIP nor alt tent)
  const otherStaffAllocs = staffAllocs.filter(
    a => !VIP_REQ_MARKER.test(a.notes || "") && !(a.notes || "").includes(ALT_TENT_MARKER)
  );

  // ── Pax sums ──────────────────────────────────────────────────────────
  const studentAllocated   = studentAllocs.reduce((s, a) => s + (a.allocated_pax || 0), 0);
  const vipAllocated       = vipAllocs.reduce((s, a) => s + (a.allocated_pax || 0), 0);
  const altTentAllocated   = altTentAllocs.reduce((s, a) => s + (a.allocated_pax || 0), 0);
  const otherStaffAllocated = otherStaffAllocs.reduce((s, a) => s + (a.allocated_pax || 0), 0);
  const staffAllocated     = vipAllocated + altTentAllocated + otherStaffAllocated;
  const totalAllocated     = studentAllocated + staffAllocated;

  // Tent counts
  const studentTentCount   = new Set(studentAllocs.map(a => a.tent_id)).size;
  const vipTentCount       = new Set(vipAllocs.map(a => a.tent_id)).size;
  const altTentCount       = new Set(altTentAllocs.map(a => a.tent_id)).size;

  // ── Required counts (from profile) ────────────────────────────────────
  if (!profile) {
    return {
      studentAllocated, vipAllocated, altTentAllocated, otherStaffAllocated,
      staffAllocated, totalAllocated,
      studentTentCount, vipTentCount, altTentCount,
      studentRequired: 0, staffRequired: 0, totalRequired: 0,
      studentRemaining: 0, staffRemaining: 0, totalRemaining: 0,
      isComplete: true,
      activeCount: active.length,
      confirmedCount: active.filter(a => a.status === "CONFIRMED").length,
      draftCount: active.filter(a => a.status === "DRAFT").length,
    };
  }

  // Student required
  const hasGenderSplit = ((profile.boys_count || 0) + (profile.girls_count || 0)) > 0;
  let studentRequired;
  if (hasGenderSplit) {
    const boysNeeded  = profile.boys_beds_needed  ?? profile.boys_count  ?? 0;
    const girlsNeeded = profile.girls_beds_needed ?? profile.girls_count ?? 0;
    studentRequired   = boysNeeded + girlsNeeded;
  } else {
    studentRequired = profile.participant_count || profile.total_pax || 0;
  }

  // Staff required = staff_count only
  // (staff_alt_tent_pax is a subset of staff_count, not an additional group)
  const staffRequired = profile.staff_count ?? 0;

  const totalRequired = studentRequired + staffRequired;

  // Remaining
  const studentRemaining = Math.max(0, studentRequired - studentAllocated);
  const staffRemaining   = Math.max(0, staffRequired - staffAllocated);
  const totalRemaining   = Math.max(0, totalRequired - totalAllocated);

  const isComplete = totalRequired > 0 && totalRemaining === 0;

  return {
    studentAllocated, vipAllocated, altTentAllocated, otherStaffAllocated,
    staffAllocated, totalAllocated,
    studentTentCount, vipTentCount, altTentCount,
    studentRequired, staffRequired, totalRequired,
    studentRemaining, staffRemaining, totalRemaining,
    isComplete,
    activeCount: active.length,
    confirmedCount: active.filter(a => a.status === "CONFIRMED").length,
    draftCount: active.filter(a => a.status === "DRAFT").length,
  };
}