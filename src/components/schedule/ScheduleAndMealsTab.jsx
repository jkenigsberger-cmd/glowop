import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, RefreshCw, CalendarDays, UtensilsCrossed, GitBranch, X, Shuffle } from "lucide-react";
import { toast } from "sonner";
import ScheduleItemRow from "./ScheduleItemRow";
import MealReservationRow from "./MealReservationRow";
import QuoteTalksPanel, { extractQuoteTalks } from "./QuoteTalksPanel";
import DietaryFields, { EMPTY_DIETS, parseDiets, mergeDiets } from "@/components/shared/DietaryFields";

const MEAL_LABELS = { BREAKFAST: "ארוחת בוקר", LUNCH: "ארוחת צהריים", DINNER: "ארוחת ערב", OTHER: "אחר" };

const MEAL_DEFAULTS = {
  BREAKFAST: { start_time: "07:00", end_time: "09:00" },
  LUNCH:     { start_time: "12:30", end_time: "13:30" },
  DINNER:    { start_time: "18:30", end_time: "20:00" },
  OTHER:     { start_time: "12:00", end_time: "13:00" },
};

function autoDividePax(total, n) {
  if (!total || !n) return Array(n).fill("");
  const base = Math.floor(total / n);
  const remainder = total % n;
  return Array.from({ length: n }, (_, i) => (i < remainder ? base + 1 : base));
}

const EMPTY_MEAL = (type = "BREAKFAST") => ({
  date: "",
  meal_type: type,
  start_time: MEAL_DEFAULTS[type].start_time,
  end_time:   MEAL_DEFAULTS[type].end_time,
  pax: "", sandwich_option: false, notes: ""
});

export default function ScheduleAndMealsTab({ groupId, profile, group, quotes = [], guestFormSubmission = null }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [addingSchedule, setAddingSchedule] = useState(false);
  const [addingMeal, setAddingMeal] = useState(false);
  const [newMeal, setNewMeal] = useState(EMPTY_MEAL());
  const [newMealDiets, setNewMealDiets] = useState(() => mergeDiets(parseDiets(profile?.special_diets)));
  const [newScheduleError, setNewScheduleError] = useState(null);

  // Split state
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitRows, setSplitRows] = useState([
    { activity_space_id: "", pax: "" },
    { activity_space_id: "", pax: "" },
  ]);

  const profileId = profile?.id;
  const arrivalDate   = group?.arrival_date   || "";
  const departureDate = group?.departure_date || "";

  // Resolved group participant count for pax auto-fill
  const groupParticipantCount = useMemo(() =>
    group?.participant_count || group?.total_pax ||
    profile?.participant_count || profile?.total_pax || null,
    [group, profile]
  );

  // Default empty schedule with pax auto-filled
  const makeEmptySchedule = () => ({
    date: "", start_time: "09:00", end_time: "10:00",
    activity_name: "", requested_location: "", activity_space_id: null,
    quote_item_id: null, pax: groupParticipantCount ? String(groupParticipantCount) : "", notes: ""
  });

  const [newSchedule, setNewSchedule] = useState(makeEmptySchedule);

  // The approved quote (or first quote) for activity suggestions
  const activeQuote = quotes.find(q => q.status === "APPROVED") || quotes[0];
  const quoteTalks = extractQuoteTalks(activeQuote);

  // Parse client talk suggestions from GuestFormSubmission.schedule_notes
  const clientTalkSuggestions = useMemo(() => {
    if (!guestFormSubmission?.schedule_notes) return [];
    try {
      const rows = JSON.parse(guestFormSubmission.schedule_notes);
      return rows.filter(r => r.is_talk_suggestion && r.quote_item_id);
    } catch { return []; }
  }, [guestFormSubmission]);

  const { data: scheduleItems = [] } = useQuery({
    queryKey: ["groupScheduleItems", groupId],
    queryFn: () => base44.entities.GroupScheduleItem.filter({ group_id: groupId }),
    enabled: !!groupId,
  });

  const { data: mealItems = [] } = useQuery({
    queryKey: ["mealReservations", groupId],
    queryFn: () => base44.entities.MealReservation.filter({ group_id: groupId }),
    enabled: !!groupId,
  });

  const { data: activitySpaces = [] } = useQuery({
    queryKey: ["activitySpaces"],
    queryFn: () => base44.entities.ActivitySpace.list(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["groupScheduleItems", groupId] });
    queryClient.invalidateQueries({ queryKey: ["mealReservations", groupId] });
  };

  // Open Add Activity form, optionally prefilled from a suggestion or quote talk
  const openActivityForm = (prefill = {}) => {
    const base = makeEmptySchedule();
    setNewSchedule({
      ...base,
      date: prefill.date || base.date,
      start_time: prefill.start_time || base.start_time,
      end_time: prefill.end_time || base.end_time,
      activity_name: prefill.activity_name || base.activity_name,
      quote_item_id: prefill.quote_item_id || null,
      notes: prefill.notes || base.notes,
      pax: groupParticipantCount ? String(groupParticipantCount) : base.pax,
      activity_space_id: null,
    });
    setSplitEnabled(false);
    setSplitRows([
      { activity_space_id: "", pax: groupParticipantCount ? String(Math.ceil(groupParticipantCount / 2)) : "" },
      { activity_space_id: "", pax: groupParticipantCount ? String(Math.floor(groupParticipantCount / 2)) : "" },
    ]);
    setNewScheduleError(null);
    setAddingSchedule(true);
    // Scroll to form
    setTimeout(() => {
      document.getElementById("add-activity-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  // ── Schedule handlers ──────────────────────────────────────────────────────
  const handleSaveScheduleItem = async (form) => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("saveGroupScheduleItem", { ...form });
      if (res.data?.error) {
        invalidate();
        return res.data.error;
      }
      invalidate();
      toast.success("פעילות נשמרה");
      return null;
    } catch (err) {
      invalidate();
      return err?.response?.data?.error || err?.message || "השמירה נכשלה. הנתונים רועננו, נסה שוב.";
    } finally {
      setSaving(false);
    }
  };

  const handleCancelScheduleItem = async (id) => {
    if (!window.confirm("לבטל פעילות זו?")) return;
    await base44.entities.GroupScheduleItem.update(id, { status: "CANCELLED" });
    invalidate();
    toast.success("פעילות בוטלה");
  };

  const validateScheduleDate = (date) => {
    if (!date) return "יש למלא תאריך";
    if (arrivalDate && departureDate) {
      if (date < arrivalDate || date > departureDate) {
        return "לא ניתן לקבוע פעילות מחוץ לתאריכי הקבוצה";
      }
    }
    return null;
  };

  const resetAddActivityForm = () => {
    setAddingSchedule(false);
    setNewScheduleError(null);
    setSplitEnabled(false);
    setSplitRows([{ activity_space_id: "", pax: "" }, { activity_space_id: "", pax: "" }]);
    setNewSchedule(makeEmptySchedule());
  };

  // Single-space save
  const handleAddSchedule = async () => {
    setNewScheduleError(null);
    if (!newSchedule.activity_name.trim()) {
      setNewScheduleError("יש למלא שם פעילות");
      return;
    }
    const dateErr = validateScheduleDate(newSchedule.date);
    if (dateErr) { setNewScheduleError(dateErr); return; }
    if (!newSchedule.start_time || !newSchedule.end_time || newSchedule.start_time >= newSchedule.end_time) {
      setNewScheduleError("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
      return;
    }
    setSaving(true);
    try {
      const res = await base44.functions.invoke("saveGroupScheduleItem", {
        ...newSchedule,
        group_id: groupId,
        operational_group_profile_id: profileId,
        source: "manual",
        status: "ACTIVE",
      });
      if (res.data?.error) { setNewScheduleError(res.data.error); return; }
      toast.success("פעילות נוספה");
      resetAddActivityForm();
      invalidate();
    } catch (err) {
      invalidate();
      setNewScheduleError(err?.response?.data?.error || err?.message || "השמירה נכשלה. הנתונים רועננו, נסה שוב.");
    } finally {
      setSaving(false);
    }
  };

  // Split save with rollback
  const handleAddSplitSchedule = async () => {
    setNewScheduleError(null);
    if (!newSchedule.activity_name.trim()) {
      setNewScheduleError("יש למלא שם פעילות");
      return;
    }
    const dateErr = validateScheduleDate(newSchedule.date);
    if (dateErr) { setNewScheduleError(dateErr); return; }
    if (!newSchedule.start_time || !newSchedule.end_time || newSchedule.start_time >= newSchedule.end_time) {
      setNewScheduleError("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
      return;
    }
    if (splitRows.length < 2) { setNewScheduleError("יש לבחור לפחות שני מרחבים לפיצול"); return; }
    for (let i = 0; i < splitRows.length; i++) {
      if (!splitRows[i].activity_space_id) {
        setNewScheduleError(`יש לבחור מרחב פעילות (שורה ${i + 1})`);
        return;
      }
    }
    const ids = splitRows.map(r => r.activity_space_id);
    if (new Set(ids).size !== ids.length) {
      setNewScheduleError("לא ניתן לבחור את אותו מרחב פעמיים");
      return;
    }

    setSaving(true);
    const splitGroupId = crypto.randomUUID();
    const createdIds = [];
    try {
      for (let i = 0; i < splitRows.length; i++) {
        const row = splitRows[i];
        const res = await base44.functions.invoke("saveGroupScheduleItem", {
          group_id: groupId,
          operational_group_profile_id: profileId,
          date: newSchedule.date,
          start_time: newSchedule.start_time,
          end_time: newSchedule.end_time,
          activity_name: newSchedule.activity_name,
          activity_space_id: row.activity_space_id || null,
          quote_item_id: newSchedule.quote_item_id || null,
          pax: row.pax ? Number(row.pax) : null,
          notes: newSchedule.notes || null,
          split_group_id: splitGroupId,
          split_index: i + 1,
          split_total: splitRows.length,
          source: "manual",
          status: "ACTIVE",
        });
        if (res.data?.error) {
          // Rollback
          for (const cid of createdIds) {
            await base44.entities.GroupScheduleItem.update(cid, { status: "CANCELLED" }).catch(() => {});
          }
          invalidate();
          setNewScheduleError(`אחד המרחבים שנבחרו כבר תפוס בשעה הזו. יש לבחור שעה או מרחב אחר. (${res.data.error})`);
          setSaving(false);
          return;
        }
        createdIds.push(res.data.item.id);
      }
      toast.success(`שיבוץ מפוצל נשמר — ${splitRows.length} מרחבים`);
      resetAddActivityForm();
      invalidate();
    } catch (err) {
      for (const cid of createdIds) {
        await base44.entities.GroupScheduleItem.update(cid, { status: "CANCELLED" }).catch(() => {});
      }
      invalidate();
      setNewScheduleError(err?.response?.data?.error || err?.message || "השמירה נכשלה. הנתונים רועננו, נסה שוב.");
    } finally {
      setSaving(false);
    }
  };

  // ── Meal handlers ──────────────────────────────────────────────────────────
  const handleSaveMealItem = async (form) => {
    setSaving(true);
    if (form.id) {
      await base44.entities.MealReservation.update(form.id, form);
    } else {
      await base44.entities.MealReservation.create(form);
    }
    setSaving(false);
    invalidate();
    toast.success("ארוחה נשמרה");
  };

  const handleCancelMealItem = async (id) => {
    if (!window.confirm("לבטל ארוחה זו?")) return;
    await base44.entities.MealReservation.update(id, { status: "CANCELLED" });
    invalidate();
    toast.success("ארוחה בוטלה");
  };

  const handleAddMeal = async () => {
    if (!newMeal.date) { toast.error("יש לבחור תאריך"); return; }
    setSaving(true);
    await base44.entities.MealReservation.create({
      ...newMeal,
      pax: Number(newMeal.pax) || 0,
      special_diets_summary: JSON.stringify(newMealDiets),
      group_id: groupId,
      operational_group_profile_id: profileId,
      source: "manual",
      status: "ACTIVE",
    });
    setSaving(false);
    setNewMeal(EMPTY_MEAL());
    setNewMealDiets(mergeDiets(parseDiets(profile?.special_diets)));
    setAddingMeal(false);
    invalidate();
    toast.success("ארוחה נוספה");
  };

  const setNewMealType = (v) => {
    const defaults = MEAL_DEFAULTS[v] || MEAL_DEFAULTS.OTHER;
    setNewMeal(m => ({ ...m, meal_type: v, start_time: defaults.start_time, end_time: defaults.end_time }));
  };

  // ── Sync from GuestForm ─────────────────────────────────────────────────────
  const handleSync = async () => {
    if (!profileId) { toast.error("אין פרופיל תפעולי"); return; }
    if (!window.confirm("לסנכרן לוח זמנים וארוחות מהשאלון? שורות קיימות מסנכרון קודם יעודכנו. שורות ידניות לא יושפעו.")) return;
    setSyncing(true);
    console.log("[Sync Profile LIVE] clicked", { groupId, profileId, submissionId: guestFormSubmission?.id });
    console.log("[Sync Profile LIVE] sources", {
      hasGroup: !!group,
      hasProfile: !!profile,
      hasSubmission: !!guestFormSubmission,
    });
    try {
      console.log("[Sync Profile LIVE] before function call");
      const res = await base44.functions.invoke("prefillGroupScheduleAndMeals", {
        operational_group_profile_id: profileId,
      });
      console.log("[Sync Profile LIVE] response", res);
      if (res.data?.success) {
        if (res.data.partial) {
          toast.success("סנכרון חלקי בוצע — שאלון לקוח עדיין לא התקבל. הנתונים סונכרנו מתוך הקבוצה וההצעה.");
        } else {
          const { schedule, meals } = res.data;
          toast.success(`סנכרון הושלם: ${schedule.created} פעילויות חדשות, ${meals.created} ארוחות חדשות`);
        }
        invalidate();
      } else {
        toast.error(res.data?.error || "שגיאה בסנכרון");
      }
    } catch (err) {
      console.error("[Sync Profile LIVE] error", err);
      console.error("[Sync Profile LIVE] backend error", err?.response?.data);
      toast.error(err?.response?.data?.error || err?.message || "סנכרון נכשל");
    } finally {
      setSyncing(false);
    }
  };

  const MEAL_ORDER = { BREAKFAST: 0, LUNCH: 1, DINNER: 2, OTHER: 3 };
  const sortChron = (arr, isMeals = false) =>
    [...arr].sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      if (isMeals) {
        const mealCmp = (MEAL_ORDER[a.meal_type] ?? 99) - (MEAL_ORDER[b.meal_type] ?? 99);
        if (mealCmp !== 0) return mealCmp;
      }
      return (a.start_time || "").localeCompare(b.start_time || "");
    });

  // Quote-linked talks are managed/displayed in QuoteTalksPanel — exclude from the regular list.
  const activeSchedule = sortChron(scheduleItems.filter(i => i.status === "ACTIVE" && !i.quote_item_id), false);
  const cancelledSchedule = scheduleItems.filter(i => i.status === "CANCELLED");
  const activeMeals = sortChron(mealItems.filter(i => i.status === "ACTIVE"), true);
  const cancelledMeals = mealItems.filter(i => i.status === "CANCELLED");

  // Resolved pax for split: use what admin typed, fallback to group count
  const splitTotalPax = Number(newSchedule.pax) || groupParticipantCount || null;

  // Helpers for split toggle pax auto-divide
  const handleSplitToggle = (enabled) => {
    setSplitEnabled(enabled);
    if (enabled) {
      const divided = autoDividePax(splitTotalPax, 2);
      setSplitRows([
        { activity_space_id: "", pax: divided[0] !== "" ? String(divided[0]) : "" },
        { activity_space_id: "", pax: divided[1] !== "" ? String(divided[1]) : "" },
      ]);
    }
  };

  const handleAutoDivide = () => {
    const divided = autoDividePax(splitTotalPax, splitRows.length);
    setSplitRows(rows => rows.map((r, i) => ({ ...r, pax: divided[i] !== "" ? String(divided[i]) : "" })));
  };

  const addSplitRow = () => {
    setSplitRows(rows => [...rows, { activity_space_id: "", pax: "" }]);
  };

  const removeSplitRow = (idx) => {
    if (splitRows.length <= 2) return;
    setSplitRows(rows => rows.filter((_, i) => i !== idx));
  };

  if (!profile) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        <p>אין פרופיל תפעולי מאושר לקבוצה זו.</p>
        <p className="text-xs mt-1">יש לאשר טופס קבלה כפרופיל תפעולי תחילה.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" dir="rtl">

      {/* Sync button */}
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="gap-1.5 text-xs">
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "מסנכרן..." : "סנכרן מחדש מהשאלון"}
        </Button>
      </div>

      {/* ── Quote Talks Panel ────────────────────────────────────────────────── */}
      {quoteTalks.length > 0 && (
        <QuoteTalksPanel
          quote={activeQuote}
          scheduleItems={scheduleItems}
          clientSuggestions={clientTalkSuggestions}
          groupId={groupId}
          profileId={profileId}
          group={group}
          activitySpaces={activitySpaces}
          onScheduleChanged={invalidate}
          onOpenActivityForm={openActivityForm}
        />
      )}

      {/* ── Schedule Section ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2 text-slate-800">
            <CalendarDays className="w-4 h-4" /> לוח פעילויות
          </h3>
          <Button size="sm" variant="outline" onClick={() => addingSchedule ? resetAddActivityForm() : openActivityForm()} className="gap-1">
            <Plus className="w-3.5 h-3.5" /> הוסף פעילות
          </Button>
        </div>

        {/* ── Unified Add Activity Form ─────────────────────────────────────── */}
        {addingSchedule && (
          <div id="add-activity-form" className="bg-slate-50 border border-primary/30 rounded-xl p-4 space-y-3 mb-3">
            <p className="text-xs font-semibold text-primary">פעילות חדשה</p>
            {arrivalDate && departureDate && (
              <p className="text-xs text-slate-400">תאריכים מותרים: {arrivalDate} עד {departureDate}</p>
            )}
            <div className="grid grid-cols-2 gap-3">

              {/* Quote talk selector — always shown if quote has talks */}
              {quoteTalks.length > 0 && (
                <div className="space-y-1 col-span-2">
                  <label className="text-xs text-slate-500">פעילות מתוך הצעת המחיר</label>
                  <Select
                    value={newSchedule.quote_item_id || "none"}
                    onValueChange={v => {
                      if (v === "none") {
                        setNewSchedule(s => ({ ...s, quote_item_id: null }));
                      } else {
                        const talk = quoteTalks.find(t => t.quote_item_id === v);
                        setNewSchedule(s => ({ ...s, quote_item_id: v, activity_name: talk?.name || s.activity_name }));
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="— פעילות בהזנה ידנית —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— פעילות בהזנה ידנית —</SelectItem>
                      {quoteTalks.map(t => (
                        <SelectItem key={t.quote_item_id} value={t.quote_item_id}>
                          {t.type}: {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Activity name */}
              <div className="space-y-1 col-span-2">
                <label className="text-xs text-slate-500">
                  {newSchedule.quote_item_id ? "שם הפעילות" : "שם / סוג פעילות *"}
                </label>
                <Input
                  value={newSchedule.activity_name}
                  onChange={e => setNewSchedule(s => ({ ...s, activity_name: e.target.value }))}
                  placeholder="שם הפעילות"
                />
                {newSchedule.quote_item_id && (
                  <p className="text-[11px] text-slate-400">נמלא אוטומטית לפי ההצעה, ניתן לערוך</p>
                )}
              </div>

              {/* Date */}
              <div className="space-y-1">
                <label className="text-xs text-slate-500">תאריך *</label>
                <Input
                  type="date"
                  value={newSchedule.date}
                  min={arrivalDate || undefined}
                  max={departureDate || undefined}
                  onChange={e => setNewSchedule(s => ({ ...s, date: e.target.value }))}
                />
              </div>

              {/* Pax — always visible; in split mode it's the total for auto-divide */}
              <div className="space-y-1">
                <label className="text-xs text-slate-500">
                  {splitEnabled ? "סה״כ משתתפים לפיצול" : "מספר משתתפים"}
                </label>
                <Input
                  type="number" min="0"
                  value={newSchedule.pax}
                  onChange={e => setNewSchedule(s => ({ ...s, pax: e.target.value }))}
                  placeholder="0"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-500">שעת התחלה</label>
                <Input type="time" value={newSchedule.start_time} onChange={e => setNewSchedule(s => ({ ...s, start_time: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">שעת סיום</label>
                <Input type="time" value={newSchedule.end_time} onChange={e => setNewSchedule(s => ({ ...s, end_time: e.target.value }))} />
              </div>

              {/* Single-space selector — only when NOT split */}
              {!splitEnabled && (
                <div className="space-y-1 col-span-2">
                  <label className="text-xs text-slate-500">מרחב פעילות</label>
                  <Select
                    value={newSchedule.activity_space_id || "none"}
                    onValueChange={v => setNewSchedule(s => ({ ...s, activity_space_id: v === "none" ? null : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="לא הוקצה (אופציונלי)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— לא הוקצה —</SelectItem>
                      {activitySpaces.map(sp => (
                        <SelectItem key={sp.id} value={sp.id}>{sp.name} ({sp.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1 col-span-2">
                <label className="text-xs text-slate-500">הערות</label>
                <Input value={newSchedule.notes} onChange={e => setNewSchedule(s => ({ ...s, notes: e.target.value }))} placeholder="הערות..." />
              </div>

              {/* ── Split toggle — ALWAYS visible ── */}
              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                  <input
                    type="checkbox"
                    checked={splitEnabled}
                    onChange={e => handleSplitToggle(e.target.checked)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="flex items-center gap-1 text-xs text-blue-700 font-medium">
                    <GitBranch className="w-3 h-3" /> פיצול למספר מרחבים
                  </span>
                </label>
              </div>
            </div>

            {/* Split rows */}
            {splitEnabled && (
              <div className="space-y-2 border border-blue-200 rounded-lg p-3 bg-blue-50/40">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-blue-700">בחר מרחבים</p>
                  <button
                    type="button"
                    onClick={handleAutoDivide}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    <Shuffle className="w-3 h-3" /> פיצול אוטומטי לפי המספר שהוזן
                    {splitTotalPax ? ` (${splitTotalPax})` : ""}
                  </button>
                </div>
                {splitRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-blue-100">
                    <span className="text-xs font-bold text-slate-400 w-5 shrink-0">{idx + 1}.</span>
                    <div className="flex-1">
                      <Select
                        value={row.activity_space_id || "none"}
                        onValueChange={v => setSplitRows(rows => rows.map((r, i) => i === idx ? { ...r, activity_space_id: v === "none" ? "" : v } : r))}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="בחר מרחב..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— בחר מרחב —</SelectItem>
                          {activitySpaces
                            .filter(sp => !splitRows.some((r, i) => i !== idx && r.activity_space_id === sp.id))
                            .map(sp => (
                              <SelectItem key={sp.id} value={sp.id}>{sp.name} ({sp.code})</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-28 shrink-0">
                      <Input
                        type="number" min="0"
                        value={row.pax}
                        onChange={e => setSplitRows(rows => rows.map((r, i) => i === idx ? { ...r, pax: e.target.value } : r))}
                        placeholder="משתתפים"
                        className="h-8 text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSplitRow(idx)}
                      disabled={splitRows.length <= 2}
                      className="text-slate-300 hover:text-red-500 disabled:opacity-30 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addSplitRow}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                >
                  <Plus className="w-3 h-3" /> הוסף מרחב נוסף
                </button>
                <p className="text-xs text-slate-400">
                  סה״כ משתתפים:{" "}
                  <span className="font-semibold text-slate-600">
                    {splitRows.reduce((s, r) => s + (Number(r.pax) || 0), 0)}
                  </span>
                  {groupParticipantCount && ` / ${groupParticipantCount} בקבוצה`}
                </p>
              </div>
            )}

            {newScheduleError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{newScheduleError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={resetAddActivityForm}>ביטול</Button>
              {splitEnabled ? (
                <Button size="sm" onClick={handleAddSplitSchedule} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {saving ? "שומר..." : "שמור שיבוץ מפוצל"}
                </Button>
              ) : (
                <Button size="sm" onClick={handleAddSchedule} disabled={saving}>
                  {saving ? "שומר..." : "הוסף"}
                </Button>
              )}
            </div>
          </div>
        )}

        {activeSchedule.length === 0 && !addingSchedule ? (
          <p className="text-sm text-muted-foreground text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
            אין פעילויות עדיין — הוסף ידנית או סנכרן מהשאלון
          </p>
        ) : (
          <div className="space-y-2">
            {activeSchedule.map(item => (
              <ScheduleItemRow
                key={item.id}
                item={item}
                activitySpaces={activitySpaces}
                quoteActivities={[]}
                groupDateRange={{ arrivalDate, departureDate }}
                onSave={handleSaveScheduleItem}
                onCancel={handleCancelScheduleItem}
                saving={saving}
              />
            ))}
          </div>
        )}

        {cancelledSchedule.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              {cancelledSchedule.length} פעילויות מבוטלות
            </summary>
            <div className="space-y-2 mt-2">
              {cancelledSchedule.map(item => (
                <ScheduleItemRow
                  key={item.id}
                  item={item}
                  activitySpaces={activitySpaces}
                  quoteActivities={[]}
                  groupDateRange={{ arrivalDate, departureDate }}
                  onSave={handleSaveScheduleItem}
                  onCancel={() => {}}
                  saving={saving}
                />
              ))}
            </div>
          </details>
        )}
      </section>

      {/* ── Meals Section ────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2 text-slate-800">
            <UtensilsCrossed className="w-4 h-4" /> ארוחות
          </h3>
          <Button size="sm" variant="outline" onClick={() => setAddingMeal(v => !v)} className="gap-1">
            <Plus className="w-3.5 h-3.5" /> הוסף ארוחה
          </Button>
        </div>

        {addingMeal && (
          <div className="bg-slate-50 border border-primary/30 rounded-xl p-4 space-y-3 mb-3">
            <p className="text-xs font-semibold text-primary">ארוחה חדשה (ידנית)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">תאריך *</label>
                <Input type="date" value={newMeal.date} onChange={e => setNewMeal(m => ({ ...m, date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">סוג ארוחה</label>
                <Select value={newMeal.meal_type} onValueChange={setNewMealType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MEAL_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">שעת התחלה</label>
                <Input type="time" value={newMeal.start_time} onChange={e => setNewMeal(m => ({ ...m, start_time: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">שעת סיום</label>
                <Input type="time" value={newMeal.end_time} onChange={e => setNewMeal(m => ({ ...m, end_time: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">מספר אנשים</label>
                <Input type="number" min="0" value={newMeal.pax} onChange={e => setNewMeal(m => ({ ...m, pax: e.target.value }))} />
              </div>
              <div className="flex items-center gap-2 pt-5 space-y-1">
                <input
                  type="checkbox"
                  checked={!!newMeal.sandwich_option}
                  onChange={e => setNewMeal(m => ({ ...m, sandwich_option: e.target.checked }))}
                  className="w-4 h-4"
                />
                <label className="text-xs text-slate-600">כריכים במקום ארוחה חמה</label>
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs text-slate-500">הערות למטבח</label>
                <Input value={newMeal.notes} onChange={e => setNewMeal(m => ({ ...m, notes: e.target.value }))} placeholder="הערות..." />
              </div>
            </div>

            {/* Dietary section */}
            <div className="border border-amber-200 rounded-xl px-3 py-3 bg-amber-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-amber-800">🍽️ צרכים תזונתיים ואלרגיות</p>
                {profile?.special_diets && (
                  <button
                    type="button"
                    onClick={() => setNewMealDiets(mergeDiets(parseDiets(profile.special_diets)))}
                    className="text-[10px] text-primary hover:underline"
                  >
                    טען מהפרופיל
                  </button>
                )}
              </div>
              <DietaryFields value={newMealDiets} onChange={setNewMealDiets} compact />
            </div>

            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setAddingMeal(false)}>ביטול</Button>
              <Button size="sm" onClick={handleAddMeal} disabled={saving}>הוסף</Button>
            </div>
          </div>
        )}

        {activeMeals.length === 0 && !addingMeal ? (
          <p className="text-sm text-muted-foreground text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
            אין ארוחות עדיין — הוסף ידנית או סנכרן מהשאלון
          </p>
        ) : (
          <div className="space-y-2">
            {activeMeals.map(item => (
              <MealReservationRow
                key={item.id}
                item={item}
                onSave={handleSaveMealItem}
                onCancel={handleCancelMealItem}
                saving={saving}
              />
            ))}
          </div>
        )}

        {cancelledMeals.length > 0 && (
          <details className="mt-3">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
              {cancelledMeals.length} ארוחות מבוטלות
            </summary>
            <div className="space-y-2 mt-2">
              {cancelledMeals.map(item => (
                <MealReservationRow
                  key={item.id}
                  item={item}
                  onSave={handleSaveMealItem}
                  onCancel={() => {}}
                  saving={saving}
                />
              ))}
            </div>
          </details>
        )}
      </section>
    </div>
  );
}