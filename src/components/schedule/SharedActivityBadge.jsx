/**
 * SharedActivityBadge — shows "פעילות משותפת" label + linked group names.
 * Used in ScheduleItemRow display and elsewhere.
 */
export default function SharedActivityBadge({ item, currentGroupId }) {
  if (!item.is_shared_activity && !item.shared_activity_id) return null;

  let otherGroups = [];
  try {
    const ids = item.shared_activity_group_ids ? JSON.parse(item.shared_activity_group_ids) : [];
    const names = item.shared_activity_group_names ? JSON.parse(item.shared_activity_group_names) : [];
    otherGroups = ids
      .map((id, i) => ({ id, name: names[i] || id }))
      .filter(g => g.id !== currentGroupId);
  } catch {}

  return (
    <div className="mt-1 space-y-0.5">
      <span className="inline-flex items-center gap-1 text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5 font-semibold">
        🔗 פעילות משותפת
      </span>
      {otherGroups.length > 0 && (
        <p className="text-xs text-slate-500">
          משויך גם ל: {otherGroups.map(g => g.name).join(", ")}
        </p>
      )}
    </div>
  );
}