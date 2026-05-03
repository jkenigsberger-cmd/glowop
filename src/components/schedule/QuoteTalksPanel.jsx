import { useMemo, useState } from "react";
import { CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Parses lecture_lines and workshop_lines from a quote into a stable talks array.
 * Returns [{ quote_item_id, name, type }]
 */
export function extractQuoteTalks(quote) {
  if (!quote) return [];
  const talks = [];
  const parseSafe = (field) => { try { return JSON.parse(field || "[]") || []; } catch { return []; } };
  parseSafe(quote.lecture_lines).forEach((l, i) => {
    if (l.name) talks.push({ quote_item_id: `lecture__${i}`, name: l.name, type: "הרצאה" });
  });
  parseSafe(quote.workshop_lines).forEach((l, i) => {
    if (l.name) talks.push({ quote_item_id: `workshop__${i}`, name: l.name, type: "סדנה" });
  });
  return talks;
}

/**
 * Shows quote talks (lectures + workshops) with scheduled/unscheduled status.
 * Props:
 *   quote          — the approved Quote record
 *   scheduleItems  — active GroupScheduleItem[] for this group
 *   clientSuggestions — parsed array from GuestFormSubmission.schedule_notes (is_talk_suggestion=true rows)
 */
export default function QuoteTalksPanel({ quote, scheduleItems = [], clientSuggestions = [] }) {
  const [showUnscheduledOnly, setShowUnscheduledOnly] = useState(false);

  const talks = useMemo(() => extractQuoteTalks(quote), [quote]);

  // Build a set of scheduled quote_item_ids from active schedule items
  const scheduledIds = useMemo(
    () => new Set(scheduleItems.filter(i => i.quote_item_id && i.status === "ACTIVE").map(i => i.quote_item_id)),
    [scheduleItems]
  );

  // Build suggestion map: quote_item_id → suggestion row
  const suggestionMap = useMemo(() => {
    const map = {};
    clientSuggestions.forEach(s => { if (s.quote_item_id) map[s.quote_item_id] = s; });
    return map;
  }, [clientSuggestions]);

  if (talks.length === 0) return null;

  const visible = showUnscheduledOnly ? talks.filter(t => !scheduledIds.has(t.quote_item_id)) : talks;

  const unscheduledCount = talks.filter(t => !scheduledIds.has(t.quote_item_id)).length;

  return (
    <section dir="rtl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2 text-slate-800 text-sm">
          🎤 הרצאות וסדנאות מההצעה
          {unscheduledCount > 0 && (
            <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5 font-bold">
              {unscheduledCount} טרם שובצו
            </span>
          )}
        </h3>
        {talks.length > 1 && (
          <button
            type="button"
            onClick={() => setShowUnscheduledOnly(v => !v)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border transition-colors",
              showUnscheduledOnly
                ? "bg-amber-50 border-amber-300 text-amber-700 font-semibold"
                : "border-slate-200 text-slate-500 hover:border-slate-300"
            )}
          >
            {showUnscheduledOnly ? "הצג הכל" : "הצג רק טרם שובצו"}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {visible.map(talk => {
          const isScheduled = scheduledIds.has(talk.quote_item_id);
          const suggestion = suggestionMap[talk.quote_item_id];
          const scheduledItem = scheduleItems.find(
            i => i.quote_item_id === talk.quote_item_id && i.status === "ACTIVE"
          );

          return (
            <div
              key={talk.quote_item_id}
              className={cn(
                "rounded-xl border px-4 py-3 flex items-start justify-between gap-3",
                isScheduled
                  ? "bg-emerald-50 border-emerald-200"
                  : "bg-amber-50/60 border-amber-200"
              )}
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                    talk.type === "הרצאה"
                      ? "bg-blue-100 text-blue-700 border-blue-200"
                      : "bg-purple-100 text-purple-700 border-purple-200"
                  )}>
                    {talk.type}
                  </span>
                  <span className="font-semibold text-sm text-slate-800">{talk.name}</span>
                </div>

                {/* Admin scheduled info */}
                {isScheduled && scheduledItem && (
                  <p className="text-xs text-emerald-700">
                    📅 {scheduledItem.date} · {scheduledItem.start_time}–{scheduledItem.end_time}
                    {scheduledItem.activity_space_code && ` · ${scheduledItem.activity_space_code}`}
                  </p>
                )}

                {/* Client suggestion */}
                {suggestion && !isScheduled && (
                  <div className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 mt-1 space-y-0.5">
                    <p className="font-semibold text-slate-600">💬 הצעת לקוח:</p>
                    {suggestion.date && <p>תאריך מועדף: {suggestion.date}</p>}
                    {(suggestion.start_time || suggestion.end_time) && (
                      <p>שעות: {suggestion.start_time || "—"}–{suggestion.end_time || "—"}</p>
                    )}
                    {suggestion.notes && <p>הערה: {suggestion.notes}</p>}
                  </div>
                )}
              </div>

              {/* Status badge */}
              <div className="shrink-0 mt-0.5">
                {isScheduled ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 rounded-full px-2.5 py-1">
                    <CheckCircle2 className="w-3 h-3" /> שובץ
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded-full px-2.5 py-1">
                    <Clock className="w-3 h-3" /> טרם שובץ
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {visible.length === 0 && showUnscheduledOnly && (
          <p className="text-sm text-emerald-600 text-center py-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            ✅ כל ההרצאות והסדנאות שובצו!
          </p>
        )}
      </div>
    </section>
  );
}