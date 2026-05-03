import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, RefreshCw, CalendarDays, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import ScheduleItemRow from "./ScheduleItemRow";
import MealReservationRow from "./MealReservationRow";
import QuoteTalksPanel, { extractQuoteTalks } from "./QuoteTalksPanel";

const MEAL_LABELS = { BREAKFAST: "ארוחת בוקר", LUNCH: "ארוחת צהריים", DINNER: "ארוחת ערב", OTHER: "אחר" };

// Default meal times
const MEAL_DEFAULTS = {
  BREAKFAST: { start_time: "07:00", end_time: "09:00" },
  LUNCH:     { start_time: "12:30", end_time: "13:30" },
  DINNER:    { start_time: "18:30", end_time: "20:00" },
  OTHER:     { start_time: "12:00", end_time: "13:00" },
};

const LOCATION_OPTIONS = ["כיתה", "מתחם חוץ", "מחוץ לחווה", "אחר"];

/**
 * Extract activity name options from a quote.
 * Reads workshop_lines, lecture_lines, addon_lines JSON fields and quote snapshot.
 */
function extractQuoteActivities(quote) {
  if (!quote) return [];
  const names = new Set();

  const parseLines = (field) => {
    if (!field) return [];
    try { return JSON.parse(field); } catch { return []; }
  };

  parseLines(quote.workshop_lines).forEach(l => l.name && names.add(l.name));
  parseLines(quote.lecture_lines).forEach(l => l.name && names.add(l.name));
  parseLines(quote.addon_lines).forEach(l => l.description && names.add(l.description));

  // Also check snapshot
  if (quote.snapshot) {
    try {
      const snap = JSON.parse(quote.snapshot);
      (snap.workshopLines || []).forEach(l => l.name && names.add(l.name));
      (snap.lectureLines  || []).forEach(l => l.name && names.add(l.name));
      (snap.workshop_lines || []).forEach(l => l.name && names.add(l.name));
      (snap.lecture_lines  || []).forEach(l => l.name && names.add(l.name));
    } catch {}
  }

  return [...names].filter(Boolean);
}

const EMPTY_SCHEDULE = {
  date: "", start_time: "09:00", end_time: "10:00",
  activity_name: "", requested_location: "", activity_space_id: null,
  quote_item_id: null, pax: "", notes: ""
};

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
  const [newSchedule, setNewSchedule] = useState(EMPTY_SCHEDULE);
  const [newMeal, setNewMeal] = useState(EMPTY_MEAL());
  const [newScheduleError, setNewScheduleError] = useState(null);

  // Custom activity name input toggle
  const [customActivityName, setCustomActivityName] = useState(false);

  const profileId = profile?.id;
  const arrivalDate   = group?.arrival_date   || "";
  const departureDate = group?.departure_date || "";

  // The approved quote (or first quote) for activity suggestions
  const activeQuote = quotes.find(q => q.status === "APPROVED") || quotes[0];
  const quoteActivities = extractQuoteActivities(activeQuote);
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

  // ── Schedule handlers ──────────────────────────────────────────────────────
  const handleSaveScheduleItem = async (form) => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("saveGroupScheduleItem", { ...form });
      if (res.data?.error) {
        invalidate(); // refetch so UI reflects actual DB state
        return res.data.error;
      }
      invalidate();
      toast.success("פעילות נשמרה");
      return null;
    } catch (err) {
      invalidate(); // refetch on any failure — never leave fake unsaved state
      const msg = err?.response?.data?.error || err?.message || "השמירה נכשלה. הנתונים רועננו, נסה שוב.";
      return msg;
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

  // Client-side date validation for schedule
  const validateScheduleDate = (date) => {
    if (!date) return "יש למלא תאריך";
    if (arrivalDate && departureDate) {
      if (date < arrivalDate || date > departureDate) {
        return "לא ניתן לקבוע פעילות מחוץ לתאריכי הקבוצה";
      }
    }
    return null;
  };

  const handleAddSchedule = async () => {
    setNewScheduleError(null);
    if (!newSchedule.activity_name) {
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
      setNewSchedule(EMPTY_SCHEDULE);
      setCustomActivityName(false);
      setAddingSchedule(false);
      invalidate();
      toast.success("פעילות נוספה");
    } catch (err) {
      invalidate(); // refetch so rollback-cancelled items don't appear as active
      const msg = err?.response?.data?.error || err?.message || "השמירה נכשלה. הנתונים רועננו, נסה שוב.";
      setNewScheduleError(msg);
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
      group_id: groupId,
      operational_group_profile_id: profileId,
      source: "manual",
      status: "ACTIVE",
    });
    setSaving(false);
    setNewMeal(EMPTY_MEAL());
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
    const res = await base44.functions.invoke("prefillGroupScheduleAndMeals", {
      operational_group_profile_id: profileId,
    });
    setSyncing(false);
    if (res.data?.success) {
      const { schedule, meals } = res.data;
      toast.success(`סנכרון הושלם: ${schedule.created} פעילויות חדשות, ${meals.created} ארוחות חדשות`);
      invalidate();
    } else {
      toast.error(res.data?.error || "שגיאה בסנכרון");
    }
  };

  // Sorted: earliest date, then for meals: BREAKFAST→LUNCH→DINNER, then start_time
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

  const activeSchedule = sortChron(scheduleItems.filter(i => i.status === "ACTIVE"), false);
  const cancelledSchedule = scheduleItems.filter(i => i.status === "CANCELLED");
  const activeMeals = sortChron(mealItems.filter(i => i.status === "ACTIVE"), true);
  const cancelledMeals = mealItems.filter(i => i.status === "CANCELLED");

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
        />
      )}

      {/* ── Schedule Section ─────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2 text-slate-800">
            <CalendarDays className="w-4 h-4" /> לוח פעילויות
          </h3>
          <Button size="sm" variant="outline" onClick={() => setAddingSchedule(v => !v)} className="gap-1">
            <Plus className="w-3.5 h-3.5" /> הוסף פעילות
          </Button>
        </div>

        {/* Add new schedule row */}
        {addingSchedule && (
          <div className="bg-slate-50 border border-primary/30 rounded-xl p-4 space-y-3 mb-3">
            <p className="text-xs font-semibold text-primary">פעילות חדשה (ידנית)</p>
            {arrivalDate && departureDate && (
              <p className="text-xs text-slate-400">תאריכים מותרים: {arrivalDate} עד {departureDate}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-1">
                <label className="text-xs text-slate-500">שם / סוג פעילות *</label>
                {quoteActivities.length > 0 && !customActivityName ? (
                  <div className="flex gap-1">
                    <Select
                      value={newSchedule.activity_name}
                      onValueChange={v => {
                        if (v === "__custom__") {
                          setCustomActivityName(true);
                          setNewSchedule(s => ({ ...s, activity_name: "" }));
                        } else {
                          setNewSchedule(s => ({ ...s, activity_name: v }));
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="בחר פעילות..." /></SelectTrigger>
                      <SelectContent>
                        {quoteActivities.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                        <SelectItem value="__custom__">✏️ אחר (הקלד ידנית)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <Input
                      value={newSchedule.activity_name}
                      onChange={e => setNewSchedule(s => ({ ...s, activity_name: e.target.value }))}
                      placeholder="שם הפעילות"
                      autoFocus={customActivityName}
                    />
                    {quoteActivities.length > 0 && (
                      <Button size="sm" variant="ghost" type="button" onClick={() => setCustomActivityName(false)} className="text-xs px-2">↩</Button>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">שעת התחלה</label>
                <Input type="time" value={newSchedule.start_time} onChange={e => setNewSchedule(s => ({ ...s, start_time: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">שעת סיום</label>
                <Input type="time" value={newSchedule.end_time} onChange={e => setNewSchedule(s => ({ ...s, end_time: e.target.value }))} />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-500">מרחב פעילות פנימי</label>
                <Select
                  value={newSchedule.activity_space_id || "none"}
                  onValueChange={v => setNewSchedule(s => ({ ...s, activity_space_id: v === "none" ? null : v }))}
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
                <label className="text-xs text-slate-500">משתתפים</label>
                <Input type="number" min="0" value={newSchedule.pax} onChange={e => setNewSchedule(s => ({ ...s, pax: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">הערות</label>
                <Input value={newSchedule.notes} onChange={e => setNewSchedule(s => ({ ...s, notes: e.target.value }))} placeholder="הערות..." />
              </div>
              {quoteTalks.length > 0 && (
                <div className="space-y-1 col-span-2">
                  <label className="text-xs text-slate-500">קשר להרצאה / סדנה מההצעה (אופציונלי)</label>
                  <Select
                    value={newSchedule.quote_item_id || "none"}
                    onValueChange={v => setNewSchedule(s => ({ ...s, quote_item_id: v === "none" ? null : v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="— לא משויך —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— לא משויך —</SelectItem>
                      {quoteTalks.map(t => (
                        <SelectItem key={t.quote_item_id} value={t.quote_item_id}>
                          {t.type}: {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {newScheduleError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{newScheduleError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setAddingSchedule(false); setNewScheduleError(null); setCustomActivityName(false); }}>ביטול</Button>
              <Button size="sm" onClick={handleAddSchedule} disabled={saving}>הוסף</Button>
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
                quoteActivities={quoteActivities}
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
                  quoteActivities={quoteActivities}
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

        {/* Add new meal row */}
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