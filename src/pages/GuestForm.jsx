import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import GuestFormStep0 from "@/components/guest-form/GuestFormStep0";
import GuestFormStep1 from "@/components/guest-form/GuestFormStep1";
import GuestFormStep2 from "@/components/guest-form/GuestFormStep2";
import GuestFormStep3 from "@/components/guest-form/GuestFormStep3";
import GuestFormStep4 from "@/components/guest-form/GuestFormStep4";
import GuestFormProgress from "@/components/guest-form/GuestFormProgress";
import { Button } from "@/components/ui/button";
import { differenceInCalendarDays } from "date-fns";

const ALL_STEPS = [
  { key: "details",      label: "פרטי קבוצה" },
  { key: "diet",         label: "העדפות מזון" },
  { key: "meals",        label: "תפריט ארוחות" },
  { key: "participants", label: "משתתפים ולינה" },
  { key: "schedule",     label: "לוח פעילויות" },
];

export default function GuestForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const quoteId = urlParams.get("quote") || urlParams.get("q");

  const [quoteData, setQuoteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);

  // ── Form state ─────────────────────────────────────────────────────────────
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
  const [meals, setMeals] = useState([]); // [{date, meal_type, sandwich_instead}]

  const [participants, setParticipants] = useState({
    boys_count: "", girls_count: "", student_sleeping_notes: "",
    staff_men_count: "", staff_women_count: "", staff_sleeping_notes: "",
    drivers_men_count: "", drivers_women_count: "", drivers_lodging_notes: "",
  });

  const [schedule, setSchedule] = useState([]); // [{date,start_time,end_time,activity,location,pax,notes}]
  const [generalNotes, setGeneralNotes] = useState("");

  // ── Load quote ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!quoteId) { setError("קישור לא תקין"); setLoading(false); return; }
    base44.functions.invoke("getQuotePublicData", { quote_id: quoteId })
      .then(res => {
        const d = res.data;
        setQuoteData(d);
        // Prefill details
        setDetails({
          group_name: d.client_name || "",
          group_type_label: "",
          contact_name: d.client_name || "",
          contact_phone: d.client_phone || "",
          contact_email: "",
          client_org: "",
        });
        // Prefill participants from estimate
        const studentsTotal = d.participant_count || 0;
        const staffTotal = d.staff_count || 0;
        setParticipants(p => ({
          ...p,
          boys_count: Math.floor(studentsTotal / 2) || "",
          girls_count: Math.ceil(studentsTotal / 2) || "",
          staff_men_count: Math.floor(staffTotal / 2) || "",
          staff_women_count: Math.ceil(staffTotal / 2) || "",
        }));
      })
      .catch(() => setError("הצעת המחיר אינה זמינה"))
      .finally(() => setLoading(false));
  }, [quoteId]);

  // ── Sleeping detection ────────────────────────────────────────────────────
  const isSleeping = quoteData?.arrival_date && quoteData?.departure_date
    ? differenceInCalendarDays(new Date(quoteData.departure_date), new Date(quoteData.arrival_date)) > 0
    : false;

  const activeSteps = isSleeping ? ALL_STEPS : ALL_STEPS.filter(s => s.key !== "meals");

  // ── Navigation ─────────────────────────────────────────────────────────────
  const currentStepKey = activeSteps[step]?.key;
  const isLast = step === activeSteps.length - 1;

  const goNext = () => setStep(s => Math.min(s + 1, activeSteps.length - 1));
  const goBack = () => setStep(s => Math.max(s - 1, 0));

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    const boys = Number(participants.boys_count) || 0;
    const girls = Number(participants.girls_count) || 0;
    const staffMen = Number(participants.staff_men_count) || 0;
    const staffWomen = Number(participants.staff_women_count) || 0;
    const driversMen = Number(participants.drivers_men_count) || 0;
    const driversWomen = Number(participants.drivers_women_count) || 0;
    const participantCount = boys + girls;
    const staffCount = staffMen + staffWomen;
    const driversTotal = driversMen + driversWomen;
    const totalPax = participantCount + staffCount + driversTotal;

    await base44.functions.invoke("submitGuestForm", {
      quote_id: quoteId,
      group_id: quoteData.group_id,
      contact_name: details.contact_name,
      contact_phone: details.contact_phone,
      contact_email: details.contact_email,
      client_org: details.client_org,
      group_type_label: details.group_type_label,
      total_pax: totalPax,
      participant_count: participantCount,
      staff_count: staffCount,
      boys_count: boys,
      girls_count: girls,
      staff_men_count: staffMen,
      staff_women_count: staffWomen,
      drivers_men_count: driversMen,
      drivers_women_count: driversWomen,
      is_sleeping_group: isSleeping,
      arrival_lunch: mealOptions.arrival_lunch,
      departure_lunch: mealOptions.departure_lunch,
      special_diets: JSON.stringify(diet),
      meal_plan: JSON.stringify(meals),
      tent_distribution_notes: JSON.stringify({
        student_sleeping_notes: participants.student_sleeping_notes,
        staff_sleeping_notes: participants.staff_sleeping_notes,
        drivers_lodging_notes: participants.drivers_lodging_notes,
      }),
      schedule_notes: JSON.stringify(schedule),
      general_notes: generalNotes,
    });
    setSubmitted(true);
    setSubmitting(false);
  };

  // ── States ────────────────────────────────────────────────────────────────
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
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 text-center sticky top-0 z-10">
        <h1 className="text-lg font-bold text-slate-800">שאלון הכנה לקבוצה</h1>
        {quoteData?.quote_number && (
          <p className="text-xs text-slate-400 mt-0.5">הצעה מס׳ {quoteData.quote_number}</p>
        )}
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {/* Progress */}
        <GuestFormProgress steps={activeSteps} currentStep={step} />

        {/* Step content */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-1">
            <h2 className="text-base font-bold text-slate-800">{activeSteps[step]?.label}</h2>
          </div>
          <div className="p-5">
            {currentStepKey === "details" && (
              <GuestFormStep0
                form={details} setForm={setDetails}
                quoteData={quoteData}
              />
            )}
            {currentStepKey === "diet" && (
              <GuestFormStep1 form={diet} setForm={setDiet} />
            )}
            {currentStepKey === "meals" && (
              <GuestFormStep2
                quoteData={quoteData}
                mealOptions={mealOptions} setMealOptions={setMealOptions}
                meals={meals} setMeals={setMeals}
              />
            )}
            {currentStepKey === "participants" && (
              <GuestFormStep3
                form={participants} setForm={setParticipants}
                quoteData={quoteData}
              />
            )}
            {currentStepKey === "schedule" && (
              <GuestFormStep4
                rows={schedule} setRows={setSchedule}
                quoteData={quoteData}
              />
            )}
          </div>
        </div>

        {/* Last step: general notes */}
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

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="outline" onClick={goBack} className="flex-1">
              ← חזרה
            </Button>
          )}
          {isLast ? (
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-primary text-white">
              {submitting ? "שולח..." : "שליחת הפרטים ✓"}
            </Button>
          ) : (
            <Button onClick={goNext} className="flex-1">
              המשך ←
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}