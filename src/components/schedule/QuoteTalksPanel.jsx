import { useMemo, useState } from "react";
import { CheckCircle2, Clock, Plus, Pencil, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import TalkSplitEditor from "./TalkSplitEditor";

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
 * Single-space inline editor (unchanged from before).
 */
function TalkScheduleEditor({
  talk,
  suggestion,
  groupId,
  profileId,
  group,
  activitySpaces,
  onSaved,
  onCancel,
}) {
  const defaultDate = suggestion?.date || group?.arrival_date || "";
  const defaultStart = suggestion?.start_time || "09:00";
  const defaultEnd = suggestion?.end_time || "10:00";
  const defaultPax = group?.participant_count || group?.total_pax || "";

  const [form, setForm] = useState({
    activity_name: talk.name,
    date: defaultDate,
    start_time: defaultStart,
    end_time: defaultEnd,
    activity_space_id: null,
    pax: defaultPax,
    notes: suggestion?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setError(null);
    if (!form.date) { setError("יש למלא תאריך"); return; }
    if (!form.start_time || !form.end_time || form.start_time >= form.end_time) {
      setError("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
      return;
    }
    setSaving(true);
    try {
      const res = await base44.functions.invoke("saveGroupScheduleItem", {
        group_id: groupId,
        operational_group_profile_id: profileId,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        activity_name: form.activity_name,
        activity_space_id: form.activity_space_id || null,
        quote_item_id: talk.quote_item_id,
        pax: form.pax ? Number(form.pax) : null,
        notes: form.notes || null,
        source: "manual",
        status: "ACTIVE",
      });
      if (res.data?.error) { setError(res.data.error); return; }
      toast.success("פעילות נשמרה בהצלחה");
      onSaved();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 bg-white border border-primary/30 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-primary">שיבוץ פעילות — {talk.type}: {talk.name}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1 col-span-2">
          <label className="text-xs text-slate-500">שם פעילות</label>
          <Input value={form.activity_name} onChange={e => set("activity_name", e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">תאריך *</label>
          <Input
            type="date"
            value={form.date}
            min={group?.arrival_date || undefined}
            max={group?.departure_date || undefined}
            onChange={e => set("date", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">מרחב פעילות</label>
          <Select
            value={form.activity_space_id || "none"}
            onValueChange={v => set("activity_space_id", v === "none" ? null : v)}
          >
            <SelectTrigger><SelectValue placeholder="לא הוקצה" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— לא הוקצה —</SelectItem>
              {activitySpaces.map(sp => (
                <SelectItem key={sp.id} value={sp.id}>{sp.name} ({sp.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">שעת התחלה</label>
          <Input type="time" value={form.start_time} onChange={e => set("start_time", e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">שעת סיום</label>
          <Input type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">משתתפים</label>
          <Input type="number" min="0" value={form.pax} onChange={e => set("pax", e.target.value)} placeholder="0" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">הערות</label>
          <Input value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="הערות..." />
        </div>
      </div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel}>בטל</Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "שומר..." : "שמור שיבוץ"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Shows quote talks (lectures + workshops) with scheduled/unscheduled status.
 * Supports split scheduling via TalkSplitEditor.
 */
export default function QuoteTalksPanel({
  quote,
  scheduleItems = [],
  clientSuggestions = [],
  groupId,
  profileId,
  group,
  activitySpaces = [],
  onScheduleChanged,
}) {
  const [showUnscheduledOnly, setShowUnscheduledOnly] = useState(false);
  // activeEditor: { quoteItemId, mode: 'single' | 'split' } | null
  const [activeEditor, setActiveEditor] = useState(null);

  const talks = useMemo(() => extractQuoteTalks(quote), [quote]);

  // All ACTIVE schedule items with this quote_item_id
  const scheduledByQuoteItem = useMemo(() => {
    const map = {};
    scheduleItems
      .filter(i => i.quote_item_id && i.status === "ACTIVE")
      .forEach(i => {
        if (!map[i.quote_item_id]) map[i.quote_item_id] = [];
        map[i.quote_item_id].push(i);
      });
    return map;
  }, [scheduleItems]);

  const suggestionMap = useMemo(() => {
    const map = {};
    clientSuggestions.forEach(s => { if (s.quote_item_id) map[s.quote_item_id] = s; });
    return map;
  }, [clientSuggestions]);

  if (talks.length === 0) return null;

  const unscheduledCount = talks.filter(t => !scheduledByQuoteItem[t.quote_item_id]).length;
  const visible = showUnscheduledOnly ? talks.filter(t => !scheduledByQuoteItem[t.quote_item_id]) : talks;

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
          const scheduledItems = scheduledByQuoteItem[talk.quote_item_id] || [];
          const isScheduled = scheduledItems.length > 0;
          const isSplit = scheduledItems.length > 1;
          const suggestion = suggestionMap[talk.quote_item_id];
          const isEditing = activeEditor?.quoteItemId === talk.quote_item_id;
          const editorMode = activeEditor?.mode;

          return (
            <div key={talk.quote_item_id}>
              <div
                className={cn(
                  "rounded-xl border px-4 py-3 flex items-start justify-between gap-3",
                  isScheduled ? "bg-emerald-50 border-emerald-200" : "bg-amber-50/60 border-amber-200"
                )}
              >
                <div className="flex-1 space-y-1 min-w-0">
                  {/* Talk title */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0",
                      talk.type === "הרצאה"
                        ? "bg-blue-100 text-blue-700 border-blue-200"
                        : "bg-purple-100 text-purple-700 border-purple-200"
                    )}>
                      {talk.type}
                    </span>
                    <span className="font-semibold text-sm text-slate-800">{talk.name}</span>
                  </div>

                  {/* Scheduled: show actual details */}
                  {isScheduled && (
                    <div className="space-y-0.5">
                      {isSplit ? (
                        <div className="space-y-1">
                          <p className="text-xs text-emerald-700 font-semibold">📅 {scheduledItems[0].date} · {scheduledItems[0].start_time}–{scheduledItems[0].end_time}</p>
                          {scheduledItems.map((item, idx) => (
                            <p key={item.id} className="text-xs text-emerald-600 mr-4">
                              {idx + 1}. {item.activity_space_code || "ללא מרחב"} · {item.pax || "—"} משתתפים
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-emerald-700">
                          📅 {scheduledItems[0].date} · {scheduledItems[0].start_time}–{scheduledItems[0].end_time}
                          {scheduledItems[0].activity_space_code && ` · ${scheduledItems[0].activity_space_code}`}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Unscheduled: show client suggestion if any */}
                  {!isScheduled && suggestion && (
                    <div className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 mt-1 space-y-0.5">
                      <p className="font-semibold text-slate-600">💬 הצעת לקוח:</p>
                      {suggestion.date && <p>תאריך מועדף: {suggestion.date}</p>}
                      {(suggestion.start_time || suggestion.end_time) && (
                        <p>שעות: {suggestion.start_time || "—"}–{suggestion.end_time || "—"}</p>
                      )}
                      {suggestion.notes && <p>הערה: {suggestion.notes}</p>}
                    </div>
                  )}

                  {!isScheduled && !suggestion && (
                    <p className="text-xs text-slate-400 mt-0.5">לא נשלחה הצעת מועד</p>
                  )}
                </div>

                {/* Right side: status badge + action buttons */}
                <div className="shrink-0 flex flex-col items-end gap-2 mt-0.5">
                  {isScheduled ? (
                    isSplit ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 rounded-full px-2.5 py-1">
                        <GitBranch className="w-3 h-3" /> שובץ מפוצל ({scheduledItems.length})
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 rounded-full px-2.5 py-1">
                        <CheckCircle2 className="w-3 h-3" /> שובץ
                      </span>
                    )
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded-full px-2.5 py-1">
                      <Clock className="w-3 h-3" /> טרם שובץ
                    </span>
                  )}

                  {/* Action buttons for unscheduled talks */}
                  {!isScheduled && !isEditing && (
                    <div className="flex flex-col gap-1.5 items-end">
                      <div className="flex gap-1.5">
                        {suggestion ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 px-2 gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                              onClick={() => setActiveEditor({ quoteItemId: talk.quote_item_id, mode: "single" })}
                            >
                              <Pencil className="w-3 h-3" /> ערוך ושבץ
                            </Button>
                            <Button
                              size="sm"
                              className="text-xs h-7 px-2 gap-1 bg-amber-500 hover:bg-amber-600 text-white"
                              onClick={() => setActiveEditor({ quoteItemId: talk.quote_item_id, mode: "single" })}
                            >
                              <Plus className="w-3 h-3" /> שבץ לפי ההצעה
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-2 gap-1"
                            onClick={() => setActiveEditor({ quoteItemId: talk.quote_item_id, mode: "single" })}
                          >
                            <Plus className="w-3 h-3" /> שבץ ידנית
                          </Button>
                        )}
                      </div>
                      {/* Split toggle */}
                      <button
                        type="button"
                        onClick={() => setActiveEditor({ quoteItemId: talk.quote_item_id, mode: "split" })}
                        className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 underline"
                      >
                        <GitBranch className="w-3 h-3" /> הרצאה מפוצלת למספר מרחבים
                      </button>
                    </div>
                  )}

                  {/* Close button when editor is open */}
                  {isEditing && (
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-slate-600 underline"
                      onClick={() => setActiveEditor(null)}
                    >
                      סגור
                    </button>
                  )}
                </div>
              </div>

              {/* Inline editor — single or split */}
              {isEditing && editorMode === "single" && (
                <TalkScheduleEditor
                  talk={talk}
                  suggestion={suggestion}
                  groupId={groupId}
                  profileId={profileId}
                  group={group}
                  activitySpaces={activitySpaces}
                  onSaved={() => {
                    setActiveEditor(null);
                    onScheduleChanged?.();
                  }}
                  onCancel={() => setActiveEditor(null)}
                />
              )}
              {isEditing && editorMode === "split" && (
                <TalkSplitEditor
                  talk={talk}
                  suggestion={suggestion}
                  groupId={groupId}
                  profileId={profileId}
                  group={group}
                  activitySpaces={activitySpaces}
                  onSaved={() => {
                    setActiveEditor(null);
                    onScheduleChanged?.();
                  }}
                  onCancel={() => setActiveEditor(null)}
                />
              )}
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