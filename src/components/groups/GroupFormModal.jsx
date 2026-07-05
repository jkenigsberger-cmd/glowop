import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import DietaryFields, { EMPTY_DIETS, parseDiets, mergeDiets } from "@/components/shared/DietaryFields";
import { upsertReviewAlert } from "@/lib/reviewAlerts";
import { syncExistingOperationalPaxForGroup } from "@/lib/syncOperationalPax";
import MealSyncAfterDateChangeModal from "@/components/groups/MealSyncAfterDateChangeModal";

// Fields that trigger pax-related alerts when changed
const PAX_FIELDS = ["total_pax", "participant_count", "staff_count", "boys_count", "girls_count"];
// Fields that trigger date-related alerts when changed
const DATE_FIELDS = ["arrival_date", "departure_date"];

export default function GroupFormModal({ group, onClose, onSaved, initialProfileDiets = null }) {
  const isEdit = !!group;
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    group_name:    group?.group_name    || "",
    group_type:    group?.group_type    || "LODGING",
    arrival_date:  group?.arrival_date  || "",
    departure_date: group?.departure_date || "",
    arrival_time:  group?.arrival_time  || "",
    departure_time: group?.departure_time || "",
    total_pax:     group?.total_pax     ?? "",
    staff_count:   group?.staff_count   ?? "",
    boys_count:    group?.boys_count    ?? "",
    girls_count:   group?.girls_count   ?? "",
    contact_name:  group?.contact_name  || "",
    contact_phone: group?.contact_phone || "",
    contact_email: group?.contact_email || "",
    internal_notes: group?.internal_notes || "",
    status:        isEdit ? (group?.status || "CONFIRMED") : "CONFIRMED",
  });
  // Dietary data — pre-loaded from profile.special_diets when editing
  const [diets, setDiets] = useState(() => mergeDiets(parseDiets(initialProfileDiets)));
  const [saving, setSaving] = useState(false);

  // ── Prefill operational numbers from the OperationalGroupProfile (source of truth) ──
  // Operational pax lives on the OGP, not on stale Group fields. On edit, read the OGP
  // once (read-only — never mutates the DB) and fill any pax field the OGP provides.
  useEffect(() => {
    if (!isEdit || !group?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const profiles = await base44.entities.OperationalGroupProfile.filter({ group_id: group.id });
        const prof = profiles[0];
        if (!prof || cancelled) return;
        setForm(f => ({
          ...f,
          total_pax:   prof.total_pax   != null ? prof.total_pax   : f.total_pax,
          staff_count: prof.staff_count != null ? prof.staff_count : f.staff_count,
          boys_count:  prof.boys_count  != null ? prof.boys_count  : f.boys_count,
          girls_count: prof.girls_count != null ? prof.girls_count : f.girls_count,
        }));
        // Also prefill diets from the OGP if the caller didn't already supply them
        if (initialProfileDiets == null && prof.special_diets) {
          setDiets(mergeDiets(parseDiets(prof.special_diets)));
        }
      } catch (err) {
        console.warn("[GroupFormModal] failed to prefill from OGP (non-blocking):", err?.message);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, group?.id]);
  const [allocationBlockError, setAllocationBlockError] = useState(null);
  const [genderConsistencyError, setGenderConsistencyError] = useState(null);
  const [mealSyncData, setMealSyncData] = useState(null); // { outOfRangeMeals, newDeparture }

  // ── Derived values ────────────────────────────────────────────────────────
  const totalPax   = Number(form.total_pax   || 0);
  const staffCount = Number(form.staff_count || 0);
  const boysCount  = Number(form.boys_count  || 0);
  const girlsCount = Number(form.girls_count || 0);

  // participant_count is always derived, never manually entered
  const participantCount = Math.max(0, totalPax - staffCount);

  // Validation warnings
  const staffExceedsTotal = staffCount > totalPax && totalPax > 0;
  const genderExceedsPax  = (boysCount + girlsCount) > participantCount && participantCount > 0;

  // ── Field setters with auto-fill logic ───────────────────────────────────
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleBoysChange = (val) => {
    const boys = Math.max(0, Math.min(Number(val || 0), participantCount));
    const girls = Math.max(0, participantCount - boys);
    setForm(f => ({ ...f, boys_count: boys, girls_count: girls }));
  };

  const handleGirlsChange = (val) => {
    const girls = Math.max(0, Math.min(Number(val || 0), participantCount));
    const boys = Math.max(0, participantCount - girls);
    setForm(f => ({ ...f, girls_count: girls, boys_count: boys }));
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setAllocationBlockError(null);
    setGenderConsistencyError(null);

    // ── Guard: for LODGING groups with participant_count > 0, boys+girls must equal participant_count
    // One gender can be 0 (e.g. all boys or all girls), but both empty or a mismatch is not allowed.
    if (form.group_type === "LODGING" && participantCount > 0) {
      const genderSum = boysCount + girlsCount;
      if (genderSum === 0) {
        setGenderConsistencyError(
          `כדי לעדכן דרישות לינה יש להזין חלוקת בנים / בנות שתואמת למספר החניכים.\nסה״כ חניכים: ${participantCount}`
        );
        return;
      }
      if (genderSum !== participantCount) {
        const diff = participantCount - genderSum;
        const msg = diff > 0
          ? `כדי לעדכן דרישות לינה יש להזין חלוקת בנים / בנות שתואמת למספר החניכים.\nסה״כ חניכים: ${participantCount}\nבנים + בנות: ${genderSum}\nחסרים ${diff} חניכים בחלוקה.`
          : `כדי לעדכן דרישות לינה יש להזין חלוקת בנים / בנות שתואמת למספר החניכים.\nסה״כ חניכים: ${participantCount}\nבנים + בנות: ${genderSum}\nיש ${Math.abs(diff)} חניכים יותר מדי בחלוקה.`;
        setGenderConsistencyError(msg);
        return;
      }
    }

    // ── Guard: block date/type changes if active sleeping allocations exist ──
    if (isEdit) {
      const datesChanged = (form.arrival_date !== (group.arrival_date || "")) ||
                           (form.departure_date !== (group.departure_date || ""));
      const typeChangedToDay = group.group_type === "LODGING" && form.group_type === "DAY_USE";

      if (datesChanged || typeChangedToDay) {
        const activeAllocs = await base44.entities.SleepingAllocation.filter({
          group_id: group.id,
          status: { $in: ["DRAFT", "CONFIRMED"] },
        });
        if (activeAllocs.length > 0) {
          setAllocationBlockError(
            "לא ניתן לשנות תאריכים או להפוך ליום סמינר כאשר קיימים שיבוצי לינה פעילים.\nיש לשחרר או לבטל את השיבוצים הקיימים ואז לבצע את השינוי."
          );
          return;
        }
      }
    }

    setSaving(true);
    const payload = {
      ...form,
      participant_count: participantCount,
    };
    // coerce numeric fields
    ["total_pax", "staff_count", "participant_count", "boys_count", "girls_count"].forEach(k => {
      if (payload[k] !== "" && payload[k] !== undefined) payload[k] = Number(payload[k]);
      else delete payload[k];
    });
    // DAY_USE: normalize departure_date to arrival_date
    if (payload.group_type === "DAY_USE") {
      payload.departure_date = payload.arrival_date || payload.departure_date;
    }

    const profilePaxFields = {
      total_pax: payload.total_pax || null,
      participant_count: payload.participant_count || null,
      staff_count: payload.staff_count || null,
      boys_count: payload.boys_count || null,
      girls_count: payload.girls_count || null,
    };

    // Only save dietary data if at least one field is non-zero or has notes
    const hasAnyDiet = Object.entries(diets).some(([k, v]) => k === "diet_notes" ? !!v : Number(v) > 0);
    const dietPayload = hasAnyDiet ? { special_diets: JSON.stringify(diets) } : {};

    if (isEdit) {
      // If status is changing to CANCELLED or ARCHIVED, delegate to lifecycle function
      // so all operational resources are properly released — never update status directly.
      const statusChangingToLifecycle =
        payload.status !== group.status &&
        (payload.status === "CANCELLED" || payload.status === "ARCHIVED");

      if (statusChangingToLifecycle) {
        const action = payload.status === "CANCELLED" ? "cancel" : "freeze";
        const res = await base44.functions.invoke("updateGroupLifecycle", {
          group_id: group.id,
          action,
          reason: payload.internal_notes || "",
        });
        if (!res.data?.success) {
          setSaving(false);
          return;
        }
        // Still save the non-status fields (name, contact, notes, etc.)
        const { status: _s, ...payloadWithoutStatus } = payload;
        await base44.entities.Group.update(group.id, payloadWithoutStatus);
        setSaving(false);
        onSaved();
        return;
      }

      await base44.entities.Group.update(group.id, payload);

      // Sync existing operational pax if total_pax changed
      const oldTotalPax = Number(group.total_pax ?? 0);
      const newTotalPax = Number(payload.total_pax ?? 0);
      if (newTotalPax > 0 && newTotalPax !== oldTotalPax) {
        try {
          await syncExistingOperationalPaxForGroup(group.id, newTotalPax);
        } catch (syncErr) {
          console.warn("[GroupFormModal] pax sync failed (non-blocking):", syncErr?.message);
        }
      }

      // Keep OperationalGroupProfile in sync with group pax edits + dietary
      const existingProfiles = await base44.entities.OperationalGroupProfile.filter({ group_id: group.id });
      if (existingProfiles.length > 0) {
        const prof = existingProfiles[0];
        // Do not overwrite richer GuestForm dietary data with empty manual values
        const existingDiets = parseDiets(prof.special_diets);
        const shouldUpdateDiets = hasAnyDiet || !existingDiets;

        // Always sync beds_needed from the validated boys/girls counts
        const bedsUpdate = payload.group_type === "LODGING"
          ? { boys_beds_needed: payload.boys_count ?? null, girls_beds_needed: payload.girls_count ?? null }
          : {};

        await base44.entities.OperationalGroupProfile.update(prof.id, {
          ...profilePaxFields,
          ...bedsUpdate,
          is_sleeping_group: payload.group_type === "LODGING",
          ...(shouldUpdateDiets ? dietPayload : {}),
        });
      }

      // ── Review alerts (additive, never blocks save) ────────────────────────
      try {
        const groupIsConfirmed = group.status === "CONFIRMED" || group.status === "PENDING_APPROVAL" || group.status === "COMPLETED";
        const isLodging = payload.group_type === "LODGING";
        if (groupIsConfirmed || existingProfiles.length > 0) {
          // A. Pax changes
          const paxChanged = PAX_FIELDS.some(f => {
            const oldVal = Number(group[f] ?? 0);
            const newVal = Number(payload[f] ?? 0);
            return oldVal !== newVal;
          });
          if (paxChanged) {
            const oldPax = Number(group.total_pax ?? 0);
            const newPax = Number(payload.total_pax ?? 0);
            const diff   = newPax - oldPax;
            const diffTxt = diff > 0 ? `נוספו ${diff} אנשים.` : diff < 0 ? `ירדו ${Math.abs(diff)} אנשים.` : "";
            const prev = Object.fromEntries(PAX_FIELDS.map(f => [f, group[f] ?? null]));
            const next = Object.fromEntries(PAX_FIELDS.map(f => [f, payload[f] ?? null]));
            if (isLodging) {
              const msg = `מספר האנשים בקבוצה השתנה מ-${oldPax} ל-${newPax}.${diffTxt ? " " + diffTxt : ""} יש לבדוק דרישות לינה, שיבוץ לינה ומטבח.`;
              await upsertReviewAlert(group.id, "SLEEPING_REQUIREMENTS", "GROUP_PAX_CHANGED", "שינוי בפרטי הקבוצה דורש בדיקה", msg, prev, next);
              await upsertReviewAlert(group.id, "ALLOCATION",            "GROUP_PAX_CHANGED", "שינוי בפרטי הקבוצה דורש בדיקה", msg, prev, next);
              await upsertReviewAlert(group.id, "KITCHEN",               "GROUP_PAX_CHANGED", "שינוי בפרטי הקבוצה דורש בדיקה", msg, prev, next);

              // Extra alert if active sleeping allocations already exist
              const activeAllocs = await base44.entities.SleepingAllocation.filter({
                group_id: group.id,
                status: { $in: ["DRAFT", "CONFIRMED"] },
              });
              if (activeAllocs.length > 0) {
                const allocMsg = "כמות המשתתפים / חלוקת בנים-בנות השתנתה לאחר שכבר קיים שיבוץ לינה.\nיש לבדוק ולעדכן את השיבוץ.";
                await upsertReviewAlert(group.id, "ALLOCATION", "ALLOCATION_CHANGED", "שינוי בפרטי הקבוצה — שיבוץ הלינה דורש עדכון", allocMsg, prev, next);
              }
            } else {
              // DAY_USE — only kitchen alert for pax changes
              const msg = `מספר האנשים בקבוצה השתנה מ-${oldPax} ל-${newPax}.${diffTxt ? " " + diffTxt : ""} יש לבדוק את תכנון המטבח.`;
              await upsertReviewAlert(group.id, "KITCHEN", "GROUP_PAX_CHANGED", "שינוי בפרטי הקבוצה דורש בדיקה", msg, prev, next);
            }
          }

          // B. Date changes
          const datesChanged = DATE_FIELDS.some(f => (group[f] || "") !== (payload[f] || ""));
          if (datesChanged) {
            const prev = { arrival_date: group.arrival_date, departure_date: group.departure_date };
            const next = { arrival_date: payload.arrival_date, departure_date: payload.departure_date };

            // ── Activities review: if the group already has activities, warn that they
            // may need to be moved manually. Google Calendar is a mirror — activities are
            // NOT auto-shifted here; each manual activity edit re-syncs its Google event.
            try {
              const activeActivities = await base44.entities.GroupScheduleItem.filter({
                group_id: group.id,
                status: "ACTIVE",
              });
              if (activeActivities.length > 0) {
                const actMsg = `שינוי תאריכי הקבוצה דורש בדיקת פעילויות.\nייתכן שיש להזיז ${activeActivities.length} פעילויות ידנית לתאריכים החדשים. עדכון ידני של כל פעילות יסנכרן מחדש את האירוע ביומן Google.`;
                await upsertReviewAlert(group.id, "ACTIVITIES", "GROUP_DATES_CHANGED", "שינוי תאריכי הקבוצה דורש בדיקת פעילויות", actMsg, prev, next);
              }
            } catch (actErr) {
              console.warn("[GroupFormModal] activity date-change alert failed (non-blocking):", actErr?.message);
            }

            if (isLodging) {
              const msg = `תאריכי הקבוצה השתנו (${group.arrival_date || "—"} — ${group.departure_date || "—"} ← ${payload.arrival_date || "—"} — ${payload.departure_date || "—"}). יש לבדוק זמינות, שיבוץ, ארוחות ומשק בית.`;
              await upsertReviewAlert(group.id, "ALLOCATION",   "GROUP_DATES_CHANGED", "שינוי תאריכים דורש בדיקה", msg, prev, next);
              await upsertReviewAlert(group.id, "KITCHEN",      "GROUP_DATES_CHANGED", "שינוי תאריכים דורש בדיקה", msg, prev, next);
              await upsertReviewAlert(group.id, "HOUSEKEEPING", "GROUP_DATES_CHANGED", "שינוי תאריכים דורש בדיקה", msg, prev, next);
            } else {
              // DAY_USE — only kitchen alert for date changes
              const msg = `תאריך יום הסמינר השתנה (${group.arrival_date || "—"} ← ${payload.arrival_date || "—"}). יש לבדוק ארוחות ופעילויות.`;
              await upsertReviewAlert(group.id, "KITCHEN", "GROUP_DATES_CHANGED", "שינוי תאריכים דורש בדיקה", msg, prev, next);
            }
          }

          // C. Diet changes — only compare if new diets have data and profile existed
          if (hasAnyDiet && existingProfiles.length > 0) {
            const prevDiets = parseDiets(existingProfiles[0].special_diets);
            const prevJson = JSON.stringify(prevDiets || {});
            const newJson  = JSON.stringify(diets);
            if (prevJson !== newJson) {
              const msg = "נתוני דיאטות/אלרגיות השתנו. יש לבדוק את תכנון המטבח.";
              await upsertReviewAlert(group.id, "KITCHEN", "DIET_CHANGED", "שינוי דיאטות/אלרגיות דורש בדיקה", msg, prevDiets, diets);
            }
          }
        }
      } catch (alertErr) {
        // Never block save — just warn
        console.warn("[GroupFormModal] Alert creation failed:", alertErr?.message);
      }
    } else {
      // ── Manual group creation → backend function creates Group + OGP atomically ──
      const group_data = {
        group_name:     payload.group_name,
        group_type:     payload.group_type,
        arrival_date:   payload.arrival_date,
        departure_date: payload.departure_date,
        arrival_time:   payload.arrival_time || null,
        departure_time: payload.departure_time || null,
        contact_name:   payload.contact_name || null,
        contact_phone:  payload.contact_phone || null,
        contact_email:  payload.contact_email || null,
        internal_notes: payload.internal_notes || null,
        status:         payload.status,
      };
      const ogp_data = {
        ...profilePaxFields,
        is_sleeping_group: payload.group_type === "LODGING",
        general_notes: payload.internal_notes || null,
        ...(payload.group_type === "LODGING"
          ? { boys_beds_needed: payload.boys_count ?? null, girls_beds_needed: payload.girls_count ?? null }
          : {}),
        ...dietPayload,
      };

      const res = await base44.functions.invoke("createGroupWithOperationalProfile", { group_data, ogp_data });
      const data = res.data || {};
      if (!data.success) {
        setSaving(false);
        const errCode = data.error;
        if (errCode === "OGP_CREATE_FAILED_AFTER_GROUP") {
          console.error("[GroupFormModal] OGP failed after group create. group_id:", data.group_id);
          setAllocationBlockError("הקבוצה נוצרה אך יצירת הפרופיל התפעולי נכשלה. יש לפנות למנהל מערכת.");
        } else if (errCode === "MISSING_REQUIRED_GROUP_FIELDS" || errCode === "MISSING_GROUP_DATA") {
          setAllocationBlockError("חסרים שדות חובה. יש למלא שם קבוצה ותאריך הגעה.");
        } else if (errCode === "INVALID_GROUP_TYPE") {
          setAllocationBlockError("סוג הקבוצה אינו תקין.");
        } else if (errCode === "FORBIDDEN" || errCode === "UNAUTHORIZED") {
          setAllocationBlockError("אין הרשאה ליצירת קבוצה.");
        } else {
          setAllocationBlockError("יצירת הקבוצה נכשלה. אנא נסה שוב.");
        }
        return;
      }
    }

    setSaving(false);
    // Invalidate kitchen and group-detail profile queries so all views refresh immediately
    queryClient.invalidateQueries({ queryKey: ["profiles_kitchen"] });
    queryClient.invalidateQueries({ queryKey: ["profiles_kitchenReport"] });
    queryClient.invalidateQueries({ queryKey: ["operationalProfile"] });

    // ── Check for out-of-range meals after departure date shortening ────────
    if (isEdit && payload.departure_date && group.departure_date) {
      const oldDeparture = group.departure_date;
      const newDeparture = payload.departure_date;
      const newArrival   = payload.arrival_date || group.arrival_date;
      if (newDeparture < oldDeparture || newArrival > (group.arrival_date || newArrival)) {
        try {
          const allMeals = await base44.entities.MealReservation.filter({ group_id: group.id });
          const outOfRange = allMeals.filter(m => {
            if (m.status === "CANCELLED") return false;
            if (newArrival   && m.date < newArrival)    return true;
            if (newDeparture && m.date > newDeparture)  return true;
            return false;
          });
          if (outOfRange.length > 0) {
            setMealSyncData({ outOfRangeMeals: outOfRange, newDeparture });
            return; // modal handles onSaved
          }
        } catch { /* non-blocking */ }
      }
    }

    onSaved();
  };

  const isDayUse = form.group_type === "DAY_USE";

  if (mealSyncData) {
    return (
      <MealSyncAfterDateChangeModal
        groupId={group.id}
        outOfRangeMeals={mealSyncData.outOfRangeMeals}
        newDeparture={mealSyncData.newDeparture}
        onClose={() => { setMealSyncData(null); onSaved(); }}
      />
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-full max-w-lg sm:max-h-[90vh] h-dvh sm:h-auto flex flex-col p-0 gap-0 overflow-hidden" dir="rtl">
        {/* Sticky header */}
        <DialogHeader className="px-4 sm:px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="text-right">{isEdit ? "עריכת קבוצה" : "קבוצה חדשה"}</DialogTitle>
        </DialogHeader>

        {/* Scrollable form body */}
        <form id="group-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 text-sm">

          {/* Name + Type + Status */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>שם קבוצה *</Label>
              <Input value={form.group_name} onChange={e => set("group_name", e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>סוג</Label>
                <Select value={form.group_type} onValueChange={v => set("group_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LODGING">לינה</SelectItem>
                    <SelectItem value="DAY_USE">פעילות יום</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isEdit && (
                <div className="space-y-1">
                  <Label>סטטוס</Label>
                  <Select value={form.status} onValueChange={v => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING_APPROVAL">בהמתנה</SelectItem>
                      <SelectItem value="CONFIRMED">מאושר</SelectItem>
                      <SelectItem value="COMPLETED">הסתיים</SelectItem>
                      <SelectItem value="ARCHIVED">מוקפא</SelectItem>
                      <SelectItem value="CANCELLED">מבוטל</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>תאריך הגעה *</Label>
              <Input type="date" value={form.arrival_date} onChange={e => set("arrival_date", e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>{isDayUse ? "תאריך האירוע" : "תאריך עזיבה"}</Label>
              <Input type="date" value={form.departure_date} onChange={e => set("departure_date", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>שעת הגעה <span className="text-slate-400 font-normal text-[11px]">(אופציונלי)</span></Label>
              <Input type="time" value={form.arrival_time} onChange={e => set("arrival_time", e.target.value)} placeholder="לדוגמה 15:00" />
            </div>
            <div className="space-y-1">
              <Label>שעת יציאה <span className="text-slate-400 font-normal text-[11px]">(אופציונלי)</span></Label>
              <Input type="time" value={form.departure_time} onChange={e => set("departure_time", e.target.value)} placeholder="לדוגמה 11:00" />
            </div>
          </div>

          {/* Participant counts */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>סה"כ</Label>
              <Input type="number" min="0" value={form.total_pax} onChange={e => set("total_pax", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>צוות</Label>
              <Input type="number" min="0" value={form.staff_count} onChange={e => set("staff_count", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>חניכים</Label>
              <div className="h-9 flex items-center px-3 rounded-md border bg-muted/40 text-sm font-medium">
                {participantCount}
              </div>
            </div>
          </div>

          {staffExceedsTotal && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              ⚠️ מספר הצוות ({staffCount}) גדול מסה"כ המשתתפים ({totalPax})
            </div>
          )}

          {/* Gender split — optional */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>בנים <span className="text-slate-400 font-normal text-[11px]">(אופציונלי)</span></Label>
              <Input type="number" min="0" value={form.boys_count} onChange={e => handleBoysChange(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>בנות <span className="text-slate-400 font-normal text-[11px]">(אופציונלי)</span></Label>
              <Input type="number" min="0" value={form.girls_count} onChange={e => handleGirlsChange(e.target.value)} />
            </div>
          </div>

          {genderConsistencyError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 whitespace-pre-line">
              ⛔ {genderConsistencyError}
            </div>
          )}
          {!genderConsistencyError && form.group_type === "LODGING" && participantCount > 0 && (() => {
            const genderSum = boysCount + girlsCount;
            if (genderSum === 0) return (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                ⚠️ יש להזין חלוקת בנים / בנות כדי לשמור קבוצת לינה ({participantCount} חניכים)
              </div>
            );
            if (genderSum === participantCount) return (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
                ✓ חלוקת בנים / בנות תואמת ({boysCount} + {girlsCount} = {participantCount})
              </div>
            );
            return null;
          })()}

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>איש קשר</Label>
              <Input value={form.contact_name} onChange={e => set("contact_name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>טלפון</Label>
              <Input value={form.contact_phone} onChange={e => set("contact_phone", e.target.value)} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>אימייל</Label>
              <Input type="email" value={form.contact_email} onChange={e => set("contact_email", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>הערות פנימיות</Label>
            <Textarea rows={3} value={form.internal_notes} onChange={e => set("internal_notes", e.target.value)} />
          </div>

          <div className="border border-amber-200 rounded-xl px-4 py-3 bg-amber-50/40 space-y-3">
            <p className="text-sm font-semibold text-amber-800">🍽️ צרכים תזונתיים ואלרגיות</p>
            <DietaryFields value={diets} onChange={setDiets} />
          </div>

        </form>

        {/* Allocation block error */}
        {allocationBlockError && (
          <div className="px-4 sm:px-6 py-3 border-t border-red-200 bg-red-50 text-xs text-red-700 whitespace-pre-line text-right shrink-0">
            ⛔ {allocationBlockError}
          </div>
        )}

        {/* Sticky footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-border shrink-0 flex gap-2 justify-end bg-card">
          <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
          <Button type="submit" form="group-form" disabled={saving}>{saving ? "שומר..." : isEdit ? "שמור" : "צור קבוצה"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}