import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { format } from "date-fns";

function LockedField({ label, value }) {
  return (
    <div className="space-y-1">
      <Label className="text-slate-600">{label}</Label>
      <div className="h-9 flex items-center px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600 font-medium">
        {value || "—"}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

export default function GuestFormStep0({ form, setForm, quoteData }) {
  const [showExtra, setShowExtra] = useState(true);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isDayUse = quoteData?.group_type === "DAY_USE";
  const hasDates = quoteData?.arrival_date;

  return (
    <div className="space-y-4">
      {/* Info banner */}
      {hasDates && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 space-y-1">
          <p className="font-semibold">📅 פרטי הפעילות שלכם</p>
          {isDayUse ? (
            <p>תאריך פעילות: <strong>{quoteData.arrival_date}</strong></p>
          ) : (
            <p>
              הגעה: <strong>{quoteData.arrival_date}</strong>
              {quoteData.departure_date && <> {" — "} עזיבה: <strong>{quoteData.departure_date}</strong></>}
            </p>
          )}
          <p className="text-blue-600 text-xs">חלק מהשדות מולאו מראש מנתוני ההצעה — ניתן לתקן אם יש שינוי.</p>
        </div>
      )}

      {/* Group name — locked (never shows client_name here, resolver already handled it) */}
      <LockedField label="שם הקבוצה" value={form.group_name || "—"} />

      {/* Group type — free text */}
      <Field label="אפיון קבוצה (לא חובה)">
        <Input
          placeholder="לדוגמה: בית ספר, תנועת נוער, גיבוש חברה..."
          value={form.group_type_label}
          onChange={e => set("group_type_label", e.target.value)}
        />
      </Field>

      {/* Contact */}
      <Field label="שם איש קשר *">
        <Input
          required
          value={form.contact_name}
          onChange={e => set("contact_name", e.target.value)}
          placeholder="שם מלא"
        />
      </Field>

      <Field label="טלפון *">
        <Input
          required
          type="tel"
          value={form.contact_phone}
          onChange={e => set("contact_phone", e.target.value)}
          placeholder="050-0000000"
        />
      </Field>

      {/* Collapsible extra */}
      <button
        type="button"
        onClick={() => setShowExtra(v => !v)}
        className="text-sm text-primary underline-offset-2 hover:underline"
      >
        {showExtra ? "▲ הסתר פרטים נוספים" : "▼ פירוט נוסף (ארגון / אימייל)"}
      </button>

      {showExtra && (
        <div className="space-y-3 pt-1">
          <Field label="ארגון / חברה">
            <Input
              value={form.client_org}
              onChange={e => set("client_org", e.target.value)}
              placeholder="שם המוסד או הארגון"
            />
          </Field>
          <Field label="אימייל לאישור">
            <Input
              type="email"
              value={form.contact_email}
              onChange={e => set("contact_email", e.target.value)}
              placeholder="example@email.com"
            />
          </Field>
        </div>
      )}
    </div>
  );
}