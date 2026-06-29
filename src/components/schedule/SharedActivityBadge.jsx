/**
 * SharedActivityBadge — compact shared activity info line shown under an activity row.
 * Shows: label, this group's pax, total pax, and other linked groups.
 *
 * Props:
 *   item           — the GroupScheduleItem
 *   currentGroupId — the group whose profile is open
 *   sharedDetails  — optional { totalPax, linkedGroups: [{ groupId, groupName, pax }] }
 *                    loaded by the parent; if absent, shows at least the label + snapshot names
 */
export default function SharedActivityBadge({ item, currentGroupId, sharedDetails }) {
  if (!item.is_shared_activity && !item.shared_activity_id) return null;

  // Parse snapshot names as fallback when live details aren't loaded yet
  let snapshotOtherGroups = [];
  try {
    const ids   = item.shared_activity_group_ids   ? JSON.parse(item.shared_activity_group_ids)   : [];
    const names = item.shared_activity_group_names ? JSON.parse(item.shared_activity_group_names) : [];
    snapshotOtherGroups = ids
      .map((id, i) => ({ id, name: names[i] || id }))
      .filter(g => g.id !== currentGroupId);
  } catch {}

  const thisGroupPax = item.pax;

  return (
    <div className="mt-1.5 rounded-md bg-slate-50 border border-slate-200 px-2.5 py-1.5 space-y-0.5">
      {/* Label */}
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
        🔗 פעילות משותפת
      </span>

      {/* Pax line */}
      <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
        {thisGroupPax > 0 && (
          <span>קבוצה זו: <strong className="text-slate-700">{thisGroupPax}</strong></span>
        )}
        {sharedDetails ? (
          sharedDetails.totalPax > 0 && (
            <span>סה״כ בפעילות: <strong className="text-slate-700">{sharedDetails.totalPax}</strong></span>
          )
        ) : null}
      </div>

      {/* Linked groups */}
      {sharedDetails ? (
        sharedDetails.linkedGroups.length > 0 && (
          <div className="text-[11px] text-slate-500">
            משותף עם:{" "}
            {sharedDetails.linkedGroups.map((g, i) => (
              <span key={g.groupId}>
                {i > 0 && ", "}
                <span className="text-slate-600 font-medium">{g.groupName}</span>
                {g.pax > 0 && <span> — {g.pax} משתתפים</span>}
              </span>
            ))}
          </div>
        )
      ) : snapshotOtherGroups.length > 0 ? (
        <div className="text-[11px] text-slate-400 italic">
          משותף עם: {snapshotOtherGroups.map(g => g.name).join(", ")}
        </div>
      ) : null}
    </div>
  );
}