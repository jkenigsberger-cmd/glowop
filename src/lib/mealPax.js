export function resolveMealPax(group, profile) {
  const participants = group?.participant_count ?? profile?.participant_count;
  const staff = group?.staff_count ?? profile?.staff_count;
  if (participants != null && staff != null) return Number(participants) + Number(staff);
  if (participants != null) return Number(participants);
  return group?.total_pax ?? profile?.total_pax ?? "";
}