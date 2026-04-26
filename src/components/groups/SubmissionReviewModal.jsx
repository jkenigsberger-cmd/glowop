import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { Pencil, CheckCircle2 } from "lucide-react";

// ── Safe JSON parse ────────────────────────────────────────────────────────────
function safeJson(str, fallback) {
  try { const r = JSON.parse(str); return r ?? fallback; } catch { return fallback; }
}

// ── Diet section ───────────────────────────────────────────────────────────────
const DIET_LABELS = [
  { key: "vegetarian_count",       label: "צמחוני",                      emoji: "🥗" },
  { key: "vegan_count",            label: "טבעוני",                      emoji: "🌱" },
  { key: "glutenFree_count",       label: "ללא גלוטן / צליאק",           emoji: "🌾" },
  { key: "mehadrinKosher_count",   label: "מהדרין",                      emoji: "✡️" },
  { key: "lifeThreatening_count",  label: "אלרגיה מסכנת חיים",           emoji: "⚠️" },
  { key: "nutFree_count",          label: "ללא אגוזים",                   emoji: "🥜" },
  { key: "eggFree_count",          label: "ללא ביצים",                    emoji: "🥚" },
  { key: "lactoseFree_count",      label: "ללא לקטוז",                   emoji: "🥛" },
];

function DietSection({ raw }) {
  const d = safeJson(raw, {});
  const hasAnything = DIET_LABELS.some(item => Number(d[item.key]) > 0) || d.upgraded_coffee || d.diet_notes;

  if (!hasAnything) return <EmptyState text="אין הגבלות תזונה מיוחדות" />;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {DIET_LABELS.map(({ key, label, emoji }) => {
          const count = Number(d[key]) || 0;
          if (!count) return null;
          return (
            <div key={key} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm border ${
              key === "lifeThreatening_count"
                ? "bg-red-50 border-red-200 text-red-800 font-semibold"
                : "bg-slate-50 border-slate-200 text-slate-700"
            }`}>
              <span>{emoji} {label}</span>
              <span className="font-bold">{count}</span>
            </div>
          );
        })}
      </div>
      {d.upgraded_coffee && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          ☕ פינת קפה ועוגיות / קפה משודרג
        </div>
      )}
      {d.diet_notes && (
        <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
          <span className="font-medium text-slate-500 text-xs block mb-1">הערות מזון</span>
          {d.diet_notes}
        </div>
      )}
    </div>
  );
}

// ── Lodging notes section ──────────────────────────────────────────────────────
function LodgingSection({ raw }) {
  const d = safeJson(raw, {});
  const notes = [
    { label: "הערות לינה לחניכים",             value: d.student_sleeping_notes },
    { label: "הערות לינה לצוות",                value: d.staff_sleeping_notes },
    { label: "הערות לינה לנהגים / אבטחה",      value: d.drivers_lodging_notes },
  ];
  const hasAny = notes.some(n => n.value?.trim());
  if (!hasAny) return <EmptyState text="אין הערות לינה" />;

  return (
    <div className="space-y-2">
      {notes.map(({ label, value }) => (
        <div key={label} className="space-y-0.5">
          <p className="text-xs text-slate-400 font-medium">{label}</p>
          <p className={`text-sm px-3 py-2 rounded-lg border ${value?.trim() ? "bg-slate-50 border-slate-200 text-slate-700" : "text-slate-300 italic"}`}>
            {value?.trim() || "אין הערות"}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Meal plan section ──────────────────────────────────────────────────────────
const MEAL_HE = { BREAKFAST: "ארוחת בוקר", LUNCH: "ארוחת צהריים", DINNER: "ארוחת ערב" };
const MEAL_EMOJI = { BREAKFAST: "🌅", LUNCH: "🌞", DINNER: "🌙" };

function MealsSection({ raw }) {
  const meals = safeJson(raw, []);
  if (!Array.isArray(meals) || !meals.length) return <EmptyState text="אין תפריט ארוחות" />;

  // Group by date
  const byDate = {};
  meals.forEach(m => {
    if (!byDate[m.date]) byDate[m.date] = [];
    byDate[m.date].push(m);
  });

  return (
    <div className="space-y-3">
      {Object.entries(byDate).map(([date, rows]) => (
        <div key={date}>
          <p className="text-xs font-semibold text-slate-500 mb-1">
            {(() => { try { return format(parseISO(date), "dd/MM/yyyy"); } catch { return date; } })()}
          </p>
          <div className="space-y-1">
            {rows.map((m, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm">
                <span>{MEAL_EMOJI[m.meal_type]} {MEAL_HE[m.meal_type] || m.meal_type}</span>
                {m.sandwich_instead && (
                  <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 rounded px-2 py-0.5">סנדוויץ׳ במקום ארוחה</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Schedule section ───────────────────────────────────────────────────────────
function ScheduleSection({ raw }) {
  const rows = safeJson(raw, []);
  if (!Array.isArray(rows) || !rows.length) return <EmptyState text="לא נמסר לוח זמנים" />;

  const nonEmpty = rows.filter(r => r.activity || r.date || r.location);
  if (!nonEmpty.length) return <EmptyState text="לא נמסר לוח זמנים" />;

  return (
    <div className="space-y-2">
      {nonEmpty.map((r, i) => (
        <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm space-y-1">
          <div className="flex flex-wrap gap-3 text-slate-700">
            {r.date && <span className="font-medium">{(() => { try { return format(parseISO(r.date), "dd/MM/yyyy"); } catch { return r.date; } })()}</span>}
            {r.start_time && <span className="text-slate-500">{r.start_time}{r.end_time ? ` — ${r.end_time}` : ""}</span>}
            {r.pax && <span className="text-slate-400">{r.pax} משתתפים</span>}
          </div>
          {r.activity && <p className="font-semibold text-slate-800">{r.activity}</p>}
          {r.location && <p className="text-slate-500 text-xs">📍 מיקום מבוקש: {r.location}</p>}
          {r.notes && <p className="text-slate-500 text-xs">הערות: {r.notes}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Comparison section ─────────────────────────────────────────────────────────
function CompareRow({ label, submitted, quoted }) {
  const diff = submitted !== quoted && quoted != null;
  return (
    <div className={`flex justify-between items-center text-sm px-3 py-2 rounded-lg ${diff ? "bg-amber-50 border border-amber-200" : "bg-slate-50 border border-slate-100"}`}>
      <span className="text-slate-600">{label}</span>
      <div className="flex items-center gap-3">
        {quoted != null && <span className="text-slate-400 text-xs">הצעה: {quoted}</span>}
        <span className={`font-semibold ${diff ? "text-amber-700" : "text-slate-800"}`}>{submitted ?? "—"}</span>
      </div>
    </div>
  );
}

function ComparisonSection({ submission, quoteData }) {
  if (!quoteData) return null;
  const snap = quoteData.snapshot ? safeJson(quoteData.snapshot, {}) : {};
  const qPax         = snap.totalPax      ?? quoteData.estimated_pax    ?? null;
  const qStaff       = snap.staffTotal    ?? quoteData.staff_count      ?? null;
  const qParticipants= snap.studentsTotal ?? quoteData.participant_count?? null;

  if (qPax == null && qStaff == null && qParticipants == null) return null;

  return (
    <Section title="השוואה להצעת המחיר" emoji="📊">
      <div className="space-y-1.5">
        <CompareRow label='סה"כ משתתפים' submitted={submission.total_pax} quoted={qPax} />
        <CompareRow label="חניכים"        submitted={submission.participant_count} quoted={qParticipants} />
        <CompareRow label="צוות"          submitted={submission.staff_count}       quoted={qStaff} />
        <CompareRow label="בנים"          submitted={submission.boys_count}        quoted={null} />
        <CompareRow label="בנות"          submitted={submission.girls_count}       quoted={null} />
      </div>
    </Section>
  );
}

// ── Generic section wrapper ────────────────────────────────────────────────────
function Section({ title, emoji, children }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">{emoji} {title}</h3>
      {children}
    </div>
  );
}

function EmptyState({ text }) {
  return <p className="text-sm text-slate-400 italic px-1">{text}</p>;
}

function Divider() {
  return <hr className="border-slate-100" />;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SubmissionReviewModal({ submission, quoteData, onClose, onEdit, onSaved }) {
  const [markingReviewed, setMarkingReviewed] = useState(false);

  const driversMen   = Number(submission.drivers_men_count)   || 0;
  const driversWomen = Number(submission.drivers_women_count) || 0;
  const driversTotal = driversMen + driversWomen;
  const staffCount   = Number(submission.staff_count)         || 0;
  const partCount    = Number(submission.participant_count)   || 0;
  const totalPax     = Number(submission.total_pax)           || 0;
  const expectedTotal = staffCount + partCount + driversTotal;
  const paxMismatch = totalPax > 0 && expectedTotal > 0 && expectedTotal !== totalPax;

  const markReviewed = async () => {
    setMarkingReviewed(true);
    await base44.entities.GuestFormSubmission.update(submission.id, { status: "REVIEWED" });
    setMarkingReviewed(false);
    onSaved();
  };

  const submittedAt = submission.submitted_at
    ? (() => { try { return format(parseISO(submission.submitted_at), "dd/MM/yyyy HH:mm"); } catch { return submission.submitted_at; } })()
    : null;

  const SOURCE_LABEL = { LINK: "קישור", WHATSAPP: "וואטסאפ", MANUAL: "ידני" };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0" dir="rtl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-start justify-between z-10">
          <div>
            <DialogTitle className="text-base font-bold text-slate-800">
              {submission.contact_name || "טופס קבלה"}
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded border font-medium ${
                submission.status === "REVIEWED"  ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                submission.status === "SUBMITTED" ? "bg-blue-50 text-blue-700 border-blue-200" :
                "bg-slate-100 text-slate-600 border-slate-200"
              }`}>
                {submission.status === "REVIEWED" ? "נבדק" : submission.status === "SUBMITTED" ? "הוגש" : "ממתין"}
              </span>
              {submittedAt && <span className="text-xs text-slate-400">{submittedAt}</span>}
              {submission.source && <span className="text-xs text-slate-400">{SOURCE_LABEL[submission.source] || submission.source}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {submission.status !== "REVIEWED" && (
              <Button size="sm" onClick={markReviewed} disabled={markingReviewed} className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {markingReviewed ? "..." : "סמן כנבדק"}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onEdit} className="gap-1">
              <Pencil className="w-3.5 h-3.5" /> עריכה
            </Button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Contact */}
          <Section title="פרטי איש קשר" emoji="👤">
            <div className="grid grid-cols-2 gap-2 text-sm">
              {submission.contact_name  && <div><span className="text-slate-400 text-xs">שם</span><p className="font-medium">{submission.contact_name}</p></div>}
              {submission.contact_phone && <div><span className="text-slate-400 text-xs">טלפון</span><p className="font-medium">{submission.contact_phone}</p></div>}
              {submission.contact_email && <div><span className="text-slate-400 text-xs">אימייל</span><p className="font-medium">{submission.contact_email}</p></div>}
              {submission.client_org    && <div><span className="text-slate-400 text-xs">ארגון</span><p className="font-medium">{submission.client_org}</p></div>}
              {submission.group_type_label && <div><span className="text-slate-400 text-xs">אפיון קבוצה</span><p className="font-medium">{submission.group_type_label}</p></div>}
            </div>
          </Section>

          <Divider />

          {/* Participants */}
          <Section title="משתתפים" emoji="👥">
            {paxMismatch && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-2">
                ⚠️ סה״כ ({totalPax}) אינו שווה לצוות + חניכים{driversTotal > 0 ? " + נהגים" : ""} ({expectedTotal})
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'סה"כ',    value: submission.total_pax },
                { label: "צוות",    value: submission.staff_count },
                { label: "חניכים",  value: submission.participant_count },
                { label: "בנים",    value: submission.boys_count },
                { label: "בנות",    value: submission.girls_count },
                ...(driversTotal > 0 ? [{ label: "נהגים / אבטחה", value: driversTotal }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="text-lg font-bold text-slate-700">{value ?? "—"}</p>
                </div>
              ))}
            </div>
          </Section>

          <Divider />

          {/* Comparison */}
          {quoteData && <ComparisonSection submission={submission} quoteData={quoteData} />}
          {quoteData && <Divider />}

          {/* Diet */}
          <Section title="העדפות מזון" emoji="🍽️">
            <DietSection raw={submission.special_diets} />
          </Section>

          <Divider />

          {/* Lodging */}
          <Section title="הערות לינה וחלוקת אוהלים" emoji="🏕️">
            <LodgingSection raw={submission.tent_distribution_notes} />
          </Section>

          <Divider />

          {/* Meals */}
          {submission.is_sleeping_group !== false && (
            <>
              <Section title="תפריט ארוחות" emoji="🍳">
                {submission.arrival_lunch !== undefined && (
                  <div className="flex gap-3 text-xs mb-2">
                    <span className={`px-2 py-1 rounded border ${submission.arrival_lunch ? "bg-green-50 border-green-200 text-green-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                      {submission.arrival_lunch ? "✓" : "✗"} ארוחת צהריים בהגעה
                    </span>
                    <span className={`px-2 py-1 rounded border ${submission.departure_lunch ? "bg-green-50 border-green-200 text-green-700" : "bg-slate-50 border-slate-200 text-slate-400"}`}>
                      {submission.departure_lunch ? "✓" : "✗"} ארוחת צהריים בעזיבה
                    </span>
                  </div>
                )}
                <MealsSection raw={submission.meal_plan} />
              </Section>
              <Divider />
            </>
          )}

          {/* Schedule */}
          <Section title="לוח פעילויות" emoji="📅">
            <ScheduleSection raw={submission.schedule_notes} />
          </Section>

          {/* General notes */}
          {submission.general_notes && (
            <>
              <Divider />
              <Section title="הערות כלליות" emoji="📝">
                <p className="text-sm text-slate-700 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">{submission.general_notes}</p>
              </Section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}