import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

function CountInput({ label, value, onChange }) {
  return (
    <div className="space-y-1">
      <Label className="text-slate-600 text-xs">{label}</Label>
      <Input
        type="number" min="0"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-center"
      />
    </div>
  );
}

function NotesInput({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1 col-span-2">
      <Label className="text-slate-600 text-xs">{label}</Label>
      <textarea
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[64px] focus:outline-none focus:ring-1 focus:ring-primary bg-white"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function Section({ title, emoji, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-right"
      >
        <span className="font-medium text-slate-700 text-sm">{emoji} {title}</span>
        <span className="text-slate-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

export default function GuestFormStep3({ form, setForm, quoteData }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isDayUse = quoteData?.group_type === 'DAY_USE';

  const boys = Number(form.boys_count) || 0;
  const girls = Number(form.girls_count) || 0;
  const staffMen = Number(form.staff_men_count) || 0;
  const staffWomen = Number(form.staff_women_count) || 0;
  const driversMen = Number(form.drivers_men_count) || 0;
  const driversWomen = Number(form.drivers_women_count) || 0;

  const studentsTotal = boys + girls;
  const staffTotal = staffMen + staffWomen;
  const driversTotal = driversMen + driversWomen;
  const grandTotal = studentsTotal + staffTotal + driversTotal;

  // Use resolved total_pax (snapshot > quote fields), fallback to participant+staff if available
  const estimatedTotal = quoteData?.total_pax
    ?? ((quoteData?.participant_count ?? 0) + (quoteData?.staff_count ?? 0))
    ?? 0;
  const diff = grandTotal - estimatedTotal;
  const hasDiff = estimatedTotal > 0 && Math.abs(diff) > 2;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        כאן ניתן לעדכן את מספר המשתתפים ואת צרכי הלינה לפי המידע העדכני ביותר.
      </p>

      {/* Students */}
      <Section title="תלמידים / חניכים" emoji="🎒" defaultOpen>
        <div className="grid grid-cols-2 gap-3">
          <CountInput label="בנים" value={form.boys_count} onChange={v => set("boys_count", v)} />
          <CountInput label="בנות" value={form.girls_count} onChange={v => set("girls_count", v)} />
          <div className="col-span-2 text-xs text-slate-400">סה״כ: <strong className="text-slate-600">{studentsTotal}</strong></div>
          {!isDayUse && (
            <NotesInput
              label="הערות לינה לתלמידים"
              value={form.student_sleeping_notes}
              onChange={v => set("student_sleeping_notes", v)}
              placeholder="חלוקת חדרים, בקשות מיוחדות"
            />
          )}
        </div>
      </Section>

      {/* Staff */}
      <Section title="צוות / מלווים" emoji="👩‍🏫">
        <div className="grid grid-cols-2 gap-3">
          <CountInput label="גברים" value={form.staff_men_count} onChange={v => set("staff_men_count", v)} />
          <CountInput label="נשים" value={form.staff_women_count} onChange={v => set("staff_women_count", v)} />
          <div className="col-span-2 text-xs text-slate-400">סה״כ: <strong className="text-slate-600">{staffTotal}</strong></div>
          {!isDayUse && (
            <NotesInput
              label="הערות לינה לצוות"
              value={form.staff_sleeping_notes}
              onChange={v => set("staff_sleeping_notes", v)}
              placeholder="חלוקת חדרים, בקשות מיוחדות"
            />
          )}
        </div>
      </Section>

      {/* Drivers / Security */}
      <Section title="נהגים / אבטחה / אחרים" emoji="🚌">
        <div className="grid grid-cols-2 gap-3">
          <CountInput label="גברים" value={form.drivers_men_count} onChange={v => set("drivers_men_count", v)} />
          <CountInput label="נשים" value={form.drivers_women_count} onChange={v => set("drivers_women_count", v)} />
          <div className="col-span-2 text-xs text-slate-400">סה״כ: <strong className="text-slate-600">{driversTotal}</strong></div>
          {!isDayUse && (
            <NotesInput
              label="הערות לינה לנהגים / אבטחה"
              value={form.drivers_lodging_notes}
              onChange={v => set("drivers_lodging_notes", v)}
              placeholder="צרכי לינה, האם ישנים באתר..."
            />
          )}
        </div>
      </Section>

      {/* Live total + warning */}
      <div className={`rounded-xl px-4 py-3 text-sm border ${
        hasDiff ? "bg-amber-50 border-amber-300 text-amber-800" : "bg-slate-50 border-slate-200 text-slate-600"
      }`}>
        <div className="flex items-center justify-between">
          <span>סה״כ משתתפים מלא: <strong>{grandTotal}</strong></span>
          {estimatedTotal > 0 && (
            <span className="text-xs">הערכה מקורית: {estimatedTotal}</span>
          )}
        </div>
        {hasDiff && (
          <p className="text-xs mt-1">
            {diff > 0 ? `⚠️ גידול של ${diff} משתתפים מהערכה המקורית` : `⚠️ קיטון של ${Math.abs(diff)} משתתפים מהערכה המקורית`}
            {" "}— ניתן להמשיך, הצוות שלנו יתאם אתכם.
          </p>
        )}
      </div>
    </div>
  );
}