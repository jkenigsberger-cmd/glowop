/**
 * Compact display for a group of split-activity items (same split_group_id).
 * Shows as a single card with a location breakdown inside.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Copy, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import RoleGate from "@/components/RoleGate";
import SplitActivityEditModal from "./SplitActivityEditModal";

export default function SplitActivityGroup({
  items,
  activitySpaces,
  onCancel,
  onDuplicate,
  onEditSave,   // async (updatedRows) => errorString | null
  groupDateRange,
  saving,
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);

  if (!items || items.length === 0) return null;

  const sorted = [...items].sort((a, b) => (a.split_index ?? 0) - (b.split_index ?? 0));
  const first = sorted[0];
  const totalPax = sorted.reduce((s, i) => s + (Number(i.pax) || 0), 0);
  const isCancelled = sorted.every(i => i.status === "CANCELLED");

  const getSpaceName = (id) => activitySpaces.find(s => s.id === id)?.name || "—";

  const coffeeLocations = sorted
    .filter(i => i.notes?.includes("פינת קפה ועוגיות"))
    .map(i => getSpaceName(i.activity_space_id))
    .filter(Boolean);

  return (
    <>
      <div className={`bg-card border rounded-xl overflow-hidden ${isCancelled ? "opacity-50 border-border" : "border-purple-200"}`}>
        {/* Header row */}
        <div className="px-4 py-3 flex items-start gap-3">
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{first.activity_name}</span>
              <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded px-1.5 py-0.5">
                {sorted.length} מרחבים
              </span>
              {isCancelled && (
                <span className="text-xs bg-red-50 text-red-600 border border-red-200 rounded px-1.5 py-0.5">בוטל</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {first.date} · {first.start_time}–{first.end_time}
              {totalPax > 0 ? ` · ${totalPax} משתתפים סה״כ` : ""}
            </p>
            {coffeeLocations.length > 0 && (
              <p className="text-xs text-amber-700">☕ קפה: {coffeeLocations.join(", ")}</p>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-0.5 px-1"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {!isCancelled && (
              <RoleGate permission="MANAGE_ACTIVITIES">
                <div className="flex gap-1">
                  {onEditSave && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(true)}
                      className="h-7 w-7 p-0 text-slate-500 hover:text-primary"
                      title="ערוך פעילות מפוצלת"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {onDuplicate && (
                    <Button size="sm" variant="ghost" onClick={() => onDuplicate(first)} className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700" title="שכפל">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(`לבטל את כל ${sorted.length} מרחבי הפעילות "${first.activity_name}"?`)) {
                        sorted.forEach(i => onCancel(i.id));
                      }
                    }}
                    className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                    title="בטל קבוצה"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </RoleGate>
            )}
          </div>
        </div>

        {/* Expanded location breakdown */}
        {expanded && (
          <div className="border-t border-purple-100 divide-y divide-slate-100">
            {sorted.map((item, idx) => {
              const spaceName = getSpaceName(item.activity_space_id);
              const hasCoffee = item.notes?.includes("פינת קפה ועוגיות");
              return (
                <div key={item.id} className="px-4 py-2 flex items-center gap-3 text-xs text-slate-600 bg-slate-50/50">
                  <span className="font-bold text-slate-400 w-4 shrink-0">{idx + 1}.</span>
                  <MapPin className="w-3 h-3 text-primary shrink-0" />
                  <span className="font-medium">{spaceName}</span>
                  {item.pax ? <span className="text-slate-400">{item.pax} משתתפים</span> : null}
                  {hasCoffee && <span className="text-amber-600">☕</span>}
                  {!isCancelled && (
                    <RoleGate permission="MANAGE_ACTIVITIES">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onCancel(item.id)}
                        className="h-5 w-5 p-0 text-red-300 hover:text-red-500 mr-auto"
                        title="בטל מרחב זה"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </RoleGate>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && onEditSave && (
        <SplitActivityEditModal
          items={sorted}
          activitySpaces={activitySpaces}
          groupDateRange={groupDateRange}
          onSave={onEditSave}
          onClose={() => setEditing(false)}
          saving={saving}
        />
      )}
    </>
  );
}