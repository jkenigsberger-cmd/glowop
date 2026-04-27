import { useState, useEffect } from "react";
import GuestFormStep0 from "@/components/guest-form/GuestFormStep0";
import GuestFormStep1 from "@/components/guest-form/GuestFormStep1";
import GuestFormStep2 from "@/components/guest-form/GuestFormStep2";
import GuestFormStep3 from "@/components/guest-form/GuestFormStep3";
import GuestFormStep4 from "@/components/guest-form/GuestFormStep4";
import GuestFormProgress from "@/components/guest-form/GuestFormProgress";
import { Button } from "@/components/ui/button";
import { differenceInCalendarDays, addDays, format, parseISO } from "date-fns";

function buildInitialMeals(arrival, departure) {
  if (!arrival || !departure) return [];
  try {
    const start = parseISO(arrival);
    const end = parseISO(departure);
    const nights = differenceInCalendarDays(end, start);
    if (nights <= 0) return [];
    const result = [];
    for (let i = 0; i <= nights; i++) {
      const date = format(addDays(start, i), "yyyy-MM-dd");
      if (i === 0) {
        result.push({ date, meal_type: "DINNER", sandwich_instead: false });
      } else if (i === nights) {
        result.push({ date, meal_type: "BREAKFAST", sandwich_instead: false });
      } else {
        result.push({ date, meal_type: "BREAKFAST", sandwich_instead: false });
        result.push({ date, meal_type: "LUNCH", sandwich_instead: false });
        result.push({ date, meal_type: "DINNER", sandwich_instead: false });
      }
    }
    return result;
  } catch { return []; }
}

const snap = (d) => { try { return d?.snapshot || null; } catch { return null; } };
const getGroupName     = (d) => snap(d)?.groupName    || snap(d)?.group_name || d?.group_name || '';
const getArrivalDate   = (d) => d?.arrival_date   || snap(d)?.startDate  || '';
const getDepartureDate = (d) => d?.departure_date || snap(d)?.endDate    || '';
const getTotalPax      = (d) => snap(d)?.totalPax      ?? d?.total_pax         ?? null;
const getStaffCount    = (d) => snap(d)?.staffTotal    ?? d?.staff_count       ?? null;
const getParticipantCount = (d) => snap(d)?.studentsTotal ?? d?.participant_count ?? null;
const getBoysCount     = (d) => d?.boys_count  ?? null;
const getGirlsCount    = (d) => d?.girls_count ?? null;
const getContactName   = (d) => snap(d)?.clientName  || d?.contact_name  || '';
const getContactPhone  = (d) => snap(d)?.clientPhone || d?.contact_phone || '';
const getContactEmail  = (d) => snap(d)?.clientEmail || d?.contact_email || '';

const isValidEmail = (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const ALL_STEPS = [
  { key: "details",      label: "פרטי קבוצה" },
  { key: "diet",         label: "העדפות מזון" },
  { key: "meals",        label: "תפריט ארוחות" },
  { key: "participants", label: "משתתפים ולינה" },
  { key: "schedule",     label: "לוח פעילויות" },
];

async function callFunction(name, payload) {
  const res = await fetch(`/functions/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export default function GuestForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const quoteId = urlParams.get("quote") || urlParams.get("q");

  const [quoteData, setQuoteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [validationError, setValidationError] = useState(null);

  const [details, setDetails] = useState({
    group_name: "", group_type_label: "",
    contact_name: "", contact_phone: "", contact_email: "", client_org: "",
  });
  const [diet, setDiet] = useState({
    vegetarian_count: 0, vegan_count: 0, glutenFree_count: 0,
    mehadrinKosher_count: 0, lifeThreatening_count: 0, nutFree_count: 0,
    eggFree_count: 0, lactoseFree_count: 0,
    upgraded_coffee: false, diet_notes: "",
  });
  const [mealOptions, setMealOptions] = useState({ arrival_lunch: false, departure_lunch: false });
  const [meals, setMeals] = useState([]);
  const [participants, setParticipants] = useState({
    boys_count: "", girls_count: "", student_sleeping_notes: "",
    staff_men_count: "", staff_women_count: "", staff_sleeping_notes: "",
    drivers_men_count: "", drivers_women_count: "", drivers_lodging_notes: "",
  });
  const [schedule, setSchedule] = useState([]);
  const [generalNotes, setGeneralNotes] = useState("");

  const scheduleHasTimeErrors = schedule.some(r => r.start_time && r.end_time && r.start_time >= r.end_time);

  useEffect(() => {
    if (!quoteId) {
      setError("קישור לא תקין");
      setLoading(false);
      return;
    }

    callFunction("getQuotePublicData", { quote_id: quoteId })
      .then(d => {
        if (d?.error) {
          const msg = d.error;
          if (msg.includes('not found') || msg.includes('Not found')) setError("הטופס לא נמצא — בדקו שהקישור תקין");
          else if (msg.includes('not available') || msg.includes('not approved')) setError("הצעת המחיר אינה מאושרת — הטופס זמין רק לאחר אישור הצעה");
          else setError("הקישור אינו תקין");
          return;
        }

        setQuoteData(d);
        setDetails({
          group_name:       getGroupName(d),
          group_type_label: "",
          contact_name:     getContactName(d),
          contact_phone:    getContactPhone(d),
          contact_email:    getContactEmail(d),
          client_org:       "",
        });

        const arr = d.arrival_date || '';
        const dep = d.departure_date || '';
        const nights = arr && dep ? differenceInCalendarDays(parseISO(dep), parseISO(arr)) : 0;
        if (nights > 0) setMeals(buildInitialMeals(arr, dep));

        const studentsTotal = getParticipantCount(d) || 0;
        const staffTotal    = getStaffCount(d) || 0;
        setParticipants(p => ({
          ...p,
          boys_count:        Math.floor(studentsTotal / 2) || "",
          girls_count:       Math.ceil(studentsTotal / 2)  || "",
          staff_men_count:   Math.floor(staffTotal / 2)    || "",
          staff_women_count: Math.ceil(staffTotal / 2)     || "",
        }));
      })
      .catch(() => setError("הצעת המחיר אינה זמינה"))
      .finally(() => setLoading(false));
  }, [quoteId]);

  const resolvedArrival   = getArrivalDate(quoteData);
  const resolvedDeparture = getDepartureDate(quoteData);
  const isSleeping = resolvedArrival && resolvedDeparture
    ? differenceInCalendarDays(new Date(resolvedDeparture), new Date(resolvedArrival)) > 0
    : false;

  const resolvedQuoteData = quoteData ? {
    ...quoteData,
    arrival_date:      resolvedArrival,
    departure_date:    resolvedDeparture,
    group_name:        getGroupName(quoteData),
    total_pax:         getTotalPax(quoteData),
    staff_count:       getStaffCount(quoteData),
    participant_count: getParticipantCount(quoteData),
    boys_count:        getBoysCount(quoteData),
    girls_count:       getGirlsCount(quoteData),
  } : null;

  const activeSteps = isSleeping ? ALL_STEPS : ALL_STEPS.filter(s => s.key !== "meals");
  const currentStepKey = activeSteps[step]?.key;
  const isLast = step === activeSteps.length - 1;

  const goNext = () => setStep(s => Math.min(s + 1, activeSteps.length - 1));
  const goBack = () => setStep(s => Math.max(s - 1, 0));

  const validate = () => {
    if (!details.contact_name?.trim()) return "נא להזין שם איש קשר";
    if (!details.contact_phone?.trim()) return "נא להזין מספר טלפון";
    if (!isValidEmail(details.contact_email)) return "כתובת האימייל אינה תקינה";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setValidationError(err); return; }
    setValidationError(null);
    setSubmitting(true);

    const boys         = Number(participants.boys_count)         || 0;
    const girls        = Number(participants.girls_count)        || 0;
    const staffMen     = Number(participants.staff_men_count)    || 0;
    const staffWomen   = Number(participants.staff_women_count)  || 0;
    const driversMen   = Number(participants.drivers_men_count)  || 0;
    const driversWomen = Number(participants.drivers_women_count)|| 0;
    const participantCount = boys + girls;
    const staffCount       = staffMen + staffWomen;
    const driversTotal     = driversMen + driversWomen;
    const totalPax         = participantCount + staffCount + driversTotal;

    try {
      await callFunction("submitGuestForm", {
        quote_id:        quoteId,
        group_id:        quoteData.group_id,
        contact_name:    details.contact_name,
        contact_phone:   details.contact_phone,
        contact_email:   details.contact_email,
        client_org:      details.client_org,
        group_type_label: details.group_type_label,
        total_pax:       totalPax,
        participant_count: participantCount,
        staff_count:     staffCount,
        boys_count:      boys,
        girls_count:     girls,
        staff_men_count: staffMen,
        staff_women_count: staffWomen,
        drivers_men_count: driversMen,
        drivers_women_count: driversWomen,
        is_sleeping_group: isSleeping,
        arrival_lunch:   mealOptions.arrival_lunch,
        departure_lunch: mealOptions.departure_lunch,
        special_diets:   JSON.stringify(diet),
        meal_plan:       JSON.stringify(meals),
        tent_distribution_notes: JSON.stringify({
          student_sleeping_notes: participants.student_sleeping_notes,
          staff_sleeping_notes:   participants.staff_sleeping_notes,
          drivers_lodging_notes:  participants.drivers_lodging_notes,
        }),
        schedule_notes:  JSON.stringify(schedule),
        general_notes:   generalNotes,
      });
      setSubmitted(true);
    } catch {
      setValidationError("שגיאה בשליחת הטופס. אנא נסו שוב או פנו אלינו ישירות.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4" dir="rtl">
      <div className="text-center space-y-3 max-w-sm">
        <div className="text-5xl">⚠️</div>
        <p className="text-xl font-bold text-slate-800">{error}</p>
        <p className="text-sm text-slate-500">אנא פנו אלינו לקבלת קישור תקין.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4" dir="rtl">
      <div className="text-center space-y-4 max-w-sm">
        <div className="text-6xl">✅</div>
        <p className="text-2xl font-bold text-slate-800">תודה! הפרטים התקבלו.</p>
        <p className="text-slate-500 text-sm">הצוות שלנו יחזור אליכם בהקדם לאישור סופי.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <div className="bg-white border-b border-slate-200 px-4 py-4 text-center sticky top-0 z-10">
        <h1 className="text-lg font-bold text-slate-800">שאלון הכנה לקבוצה</h1>
        {quoteData?.quote_number && (
          <p className="text-xs text-slate-400 mt-0.5">הצעה מס׳ {quoteData.quote_number}</p>
        )}
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        <GuestFormProgress steps={activeSteps} currentStep={step} />

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-1">
            <h2 className="text-base font-bold text-slate-800">{activeSteps[step]?.label}</h2>
          </div>
          <div className="p-5">
            {currentStepKey === "details" && (
              <GuestFormStep0 form={details} setForm={setDetails} quoteData={resolvedQuoteData} />
            )}
            {currentStepKey === "diet" && (
              <GuestFormStep1 form={diet} setForm={setDiet} />
            )}
            {currentStepKey === "meals" && (
              <GuestFormStep2
                quoteData={resolvedQuoteData}
                mealOptions={mealOptions} setMealOptions={setMealOptions}
                meals={meals} setMeals={setMeals}
              />
            )}
            {currentStepKey === "participants" && (
              <GuestFormStep3 form={participants} setForm={setParticipants} quoteData={resolvedQuoteData} />
            )}
            {currentStepKey === "schedule" && (
              <GuestFormStep4 rows={schedule} setRows={setSchedule} quoteData={resolvedQuoteData} />
            )}
          </div>
        </div>

        {isLast && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-2">
            <label className="text-sm font-medium text-slate-700">הערות כלליות</label>
            <textarea
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="כל מידע נוסף שחשוב לנו לדעת..."
              value={generalNotes}
              onChange={e => setGeneralNotes(e.target.value)}
            />
          </div>
        )}

        {validationError && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm text-center">
            {validationError}
          </div>
        )}

        <div className="flex gap-3">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={goBack} className="flex-1">
              ← חזרה
            </Button>
          )}
          {isLast ? (
            <Button type="button" onClick={handleSubmit} disabled={submitting} className="flex-1 bg-primary text-white">
              {submitting ? "שולח..." : "שליחת הפרטים ✓"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={goNext}
              disabled={currentStepKey === "schedule" && scheduleHasTimeErrors}
              className="flex-1"
            >
              המשך ←
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}