import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, RefreshCw, CalendarDays, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import ScheduleItemRow from "./ScheduleItemRow";
import MealReservationRow from "./MealReservationRow";

const MEAL_LABELS = { BREAKFAST: "ארוחת בוקר", LUNCH: "ארוחת צהריים", DINNER: "ארוחת ערב", OTHER: "אחר" };
const MEAL_DURATIONS = { BREAKFAST: 60, LUNCH: 90, DINNER: 90, OTHER: 60 };
const LOCATION_OPTIONS = ["כיתה", "מתחם חוץ", "מחוץ לחווה", "אחר"];

function addMinutes(timeStr, mins) {
  const [h, m] = (timeStr || "08:00").split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const EMPTY_SCHEDULE = {
  date: "", start_time: "09:00", end_time: "10:00",
  activity_name: "", requested_location: "", activity_space_id: null, pax: "", notes: ""
};

const EMPTY_MEAL = {
  date: "", meal_type: "BREAKFAST", start_time: "08:00", end_time: "09:00",
  pax: "", sandwich_option: false, notes: ""
};

export default function ScheduleAndMealsTab({ groupId, profile }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [addingSchedule, setAddingSchedule] = useState(false);
  const [addingMeal, setAddingMeal] = useState(false);
  const [newSchedule, setNewSchedule] = useState(EMPTY_SCHEDULE);
  const [newMeal, setNewMeal] = useState(EMPTY_MEAL);
  const [newScheduleError, setNewScheduleError] = useState(null);

  const profileId = profile?.id;

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
    const res = await base44.functions.invoke("saveGroupScheduleItem", { ...form });
    setSaving(false);
    if (res.data?.error) return res.data.error;
    invalidate();
    toast.success("פעילות נשמרה");
    return null;
  };

  const handleCancelScheduleItem = async (id) => {
    if (!window.confirm("לבטל פעילות זו?")) return;
    await base44.entities.GroupScheduleItem.update(id, { status: "CANCELLED" });
    invalidate();
    toast.success("פעילות בוטלה");
  };

  const handleAddSchedule = async () => {
    setNewScheduleError(null);
    if (!newSchedule.date || !newSchedule.activity_name) {
      setNewScheduleError("יש למלא תאריך ושם פעילות");
      return;
    }
    setSaving(true);
    const res = await base44.functions.invoke("saveGroupScheduleItem", {
      ...newSchedule,
      group_id: groupId,
      operational_group_profile_id: profileId,
      source: "manual",
      status: "ACTIVE",
    });
    setSaving(false);
    if (res.data?.error) { setNewScheduleError(res.data.error); return; }
    setNewSchedule(EMPTY_SCHEDULE);
    setAddingSchedule(false);
    invalidate();
    toast.success("פעילות נוספה");
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
    setNewMeal(EMPTY_MEAL);
    setAddingMeal(false);
    invalidate();
    toast.success("ארוחה נוספה");
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

  const activeSchedule = scheduleItems.filter(i => i.status === "ACTIVE").sort((a, b) =>
    a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)
  );
  const cancelledSchedule = scheduleItems.filter(i => i.status === "CANCELLED");
  const activeMeals = mealItems.filter(i => i.status === "ACTIVE").sort((a, b) =>
    a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time)
  );
  const cancelledMeals = mealItems.filter(i => i.status === "CANCELLED");

  const setNewMealStartTime = (v) => {
    const duration = MEAL_DURATIONS[newMeal.meal_type] || 60;
    setNewMeal(m => ({ ...m, start_time: v, end_time: addMinutes(v, duration) }));
  };

  const setNewMealType = (v) => {
    const duration = MEAL_DURATIONS[v] || 60;
    setNewMeal(m => ({ ...m, meal_type: v, end_time: addMinutes(m.start_time, duration) }));
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">תאריך *</label>
                <Input type="date" value={newSchedule.date} onChange={e => setNewSchedule(s => ({ ...s, date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">שם פעילות *</label>
                <Input value={newSchedule.activity_name} onChange={e => setNewSchedule(s => ({ ...s, activity_name: e.target.value }))} placeholder="שם הפעילות" />
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
                <label className="text-xs text-slate-500">מיקום מבוקש</label>
                <Select value={newSchedule.requested_location || ""} onValueChange={v => setNewSchedule(s => ({ ...s, requested_location: v }))}>
                  <SelectTrigger><SelectValue placeholder="בחר..." /></SelectTrigger>
                  <SelectContent>
                    {LOCATION_OPTIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
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
            </div>
            {newScheduleError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{newScheduleError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setAddingSchedule(false); setNewScheduleError(null); }}>ביטול</Button>
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
                <Input type="time" value={newMeal.start_time} onChange={e => setNewMealStartTime(e.target.value)} />
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