import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

// ── Catalog (source of truth from company documentation) ─────────────────────

const STUDENT_LODGING_RATES = {
  day_activity:      { label: "יום פעילות",          rate: 125 },
  midweek_lodging:   { label: "לינה אמצע שבוע",       rate: 190 },
  weekend_lodging:   { label: "לינה סוף שבוע",         rate: 250 },
};

const ADULT_TENT_RATES = {
  BED3:  { label: "אוהל 3 מיטות", rate: 340 },
  BED68: { label: "אוהל 6/8 מיטות", rate: 250 },
};

const WORKSHOP_CATALOG = [
  { name: "ענייני פנים ענייני חוץ", students: 750, adults: 1500 },
  { name: "יוצרים תקווה",           students: 750, adults: 1500 },
  { name: "מי שרוצה מצליח",         students: 750, adults: null },
  { name: "שירארץ",                  students: 750, adults: 1500 },
  { name: "סדנת סטיקרים",           students: 750, adults: 1500 },
  { name: "הקול שלי במרחב",         students: 750, adults: null },
  { name: "סדנת נרטיבים",           students: 750, adults: null },
  { name: "סדנת אומץ",              students: 750, adults: 1500 },
  { name: "פדגוגיה של חוויה",       students: 750, adults: 1500 },
];

const LECTURE_CATALOG = [
  { name: "פדגוגיה של תקווה",         lecturer: "שירלי רימון ברכה", base_price: 2500, vat_included: false },
  { name: "חינוך כמעשה נרטיבי",       lecturer: "שירלי רימון ברכה", base_price: 2500, vat_included: false },
  { name: "יהודית ודמוקרטית",         lecturer: "שירלי רימון ברכה", base_price: 2500, vat_included: false },
  { name: "בניית אקוסיסטם חינוכי",    lecturer: "רותי אנזל",         base_price: 1500, vat_included: false },
  { name: "לצאת מדעתנו",              lecturer: "מירב לשם גונן",     base_price: 5000, vat_included: true  },
];

const VAT_RATE = 0.18;
const COFFEE_CORNER_RATE = 15;

// ── helpers ───────────────────────────────────────────────────────────────────
const parse = (str, fallback) => { try { const r = JSON.parse(str); return Array.isArray(r) ? r : fallback; } catch { return fallback; } };

const calcStudentLodging = (r) => {
  const rate = STUDENT_LODGING_RATES[r.rate_type]?.rate ?? Number(r.rate ?? 0);
  const isDay = r.rate_type === "day_activity";
  return Number(r.pax) * rate * (isDay ? 1 : Number(r.nights));
};

const calcAdultLodging = (r) => {
  const rate = ADULT_TENT_RATES[r.tent_type]?.rate ?? Number(r.rate_per_tent_per_night ?? 0);
  return Number(r.tent_count) * Number(r.nights) * rate;
};

const calcWorkshop = (r) => Number(r.rate ?? 0);

const calcLecture = (r) => {
  const base = Number(r.base_price ?? 0);
  if (r.vat_included) return base * (1 + VAT_RATE);
  return base;
};

const calcAddon = (r) => Number(r.quantity) * Number(r.unit_price);

// ── Sub-section components ────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }) {
  return (
    <div className="border-b border-primary/20 pb-1 mb-3">
      <div className="font-semibold text-sm text-primary">{title}</div>
      {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
    </div>
  );
}

function RowTotal({ amount }) {
  return <div className="text-xs font-medium text-foreground whitespace-nowrap">₪{Math.round(amount).toLocaleString()}</div>;
}

function StudentLodgingSection({ lines, setLines }) {
  const update = (idx, field, val) => {
    setLines(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const u = { ...r, [field]: val };
      return u;
    }));
  };
  return (
    <div className="space-y-2">
      <SectionHeader title="לינה — תלמידים" subtitle="מחיר לאדם" />
      {lines.map((r, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end text-xs">
          <div className="col-span-4 space-y-0.5">
            <div className="text-muted-foreground text-[10px]">סוג</div>
            <Select value={r.rate_type} onValueChange={v => update(idx, "rate_type", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STUDENT_LODGING_RATES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label} — ₪{v.rate}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-0.5">
            <div className="text-muted-foreground text-[10px]">תלמידים</div>
            <Input className="h-8 text-xs" type="number" min="0" value={r.pax} onChange={e => update(idx, "pax", e.target.value)} />
          </div>
          {r.rate_type !== "day_activity" && (
            <div className="col-span-2 space-y-0.5">
              <div className="text-muted-foreground text-[10px]">לילות</div>
              <Input className="h-8 text-xs" type="number" min="1" value={r.nights} onChange={e => update(idx, "nights", e.target.value)} />
            </div>
          )}
          <div className={r.rate_type !== "day_activity" ? "col-span-3" : "col-span-5"} />
          <div className="col-span-1 flex items-center gap-1 justify-end">
            <RowTotal amount={calcStudentLodging(r)} />
            <button type="button" onClick={() => setLines(p => p.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-red-500 mr-1">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, { rate_type: "midweek_lodging", pax: 0, nights: 1 }])} className="gap-1 text-xs h-7">
        <Plus className="w-3 h-3" /> הוסף שורה
      </Button>
    </div>
  );
}

function AdultLodgingSection({ lines, setLines }) {
  const update = (idx, field, val) => {
    setLines(prev => prev.map((r, i) => (i !== idx ? r : { ...r, [field]: val })));
  };
  return (
    <div className="space-y-2">
      <SectionHeader title="לינה — מבוגרים" subtitle="מחיר לאוהל ללילה" />
      {lines.map((r, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end text-xs">
          <div className="col-span-4 space-y-0.5">
            <div className="text-muted-foreground text-[10px]">סוג אוהל</div>
            <Select value={r.tent_type} onValueChange={v => update(idx, "tent_type", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ADULT_TENT_RATES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label} — ₪{v.rate}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-0.5">
            <div className="text-muted-foreground text-[10px]">מס' אוהלים</div>
            <Input className="h-8 text-xs" type="number" min="0" value={r.tent_count} onChange={e => update(idx, "tent_count", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-0.5">
            <div className="text-muted-foreground text-[10px]">לילות</div>
            <Input className="h-8 text-xs" type="number" min="1" value={r.nights} onChange={e => update(idx, "nights", e.target.value)} />
          </div>
          <div className="col-span-3" />
          <div className="col-span-1 flex items-center gap-1 justify-end">
            <RowTotal amount={calcAdultLodging(r)} />
            <button type="button" onClick={() => setLines(p => p.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-red-500 mr-1">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, { tent_type: "BED3", tent_count: 0, nights: 1 }])} className="gap-1 text-xs h-7">
        <Plus className="w-3 h-3" /> הוסף שורה
      </Button>
    </div>
  );
}

function WorkshopSection({ lines, setLines }) {
  const update = (idx, field, val) => {
    setLines(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const u = { ...r, [field]: val };
      if (field === "name" || field === "audience") {
        const cat = WORKSHOP_CATALOG.find(c => c.name === (field === "name" ? val : u.name));
        if (cat) {
          const aud = field === "audience" ? val : u.audience;
          u.rate = aud === "STUDENTS" ? (cat.students ?? 0) : (cat.adults ?? 0);
        }
      }
      return u;
    }));
  };

  const addRow = () => {
    const cat = WORKSHOP_CATALOG[0];
    setLines(p => [...p, { name: cat.name, audience: "STUDENTS", rate: cat.students }]);
  };

  return (
    <div className="space-y-2">
      <SectionHeader title="סדנאות" />
      {lines.map((r, idx) => {
        const cat = WORKSHOP_CATALOG.find(c => c.name === r.name);
        const audienceDisabled = cat && cat.adults === null;
        return (
          <div key={idx} className="grid grid-cols-12 gap-2 items-end text-xs">
            <div className="col-span-5 space-y-0.5">
              <div className="text-muted-foreground text-[10px]">סדנה</div>
              <Select value={r.name} onValueChange={v => update(idx, "name", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WORKSHOP_CATALOG.map(c => (
                    <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-3 space-y-0.5">
              <div className="text-muted-foreground text-[10px]">קהל</div>
              <Select value={r.audience} onValueChange={v => update(idx, "audience", v)} disabled={audienceDisabled}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENTS">תלמידים</SelectItem>
                  {cat?.adults !== null && <SelectItem value="ADULTS">מבוגרים</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-0.5">
              <div className="text-muted-foreground text-[10px]">מחיר (₪)</div>
              <Input className="h-8 text-xs" type="number" min="0" value={r.rate} onChange={e => update(idx, "rate", Number(e.target.value))} />
            </div>
            <div className="col-span-2 flex items-center gap-1 justify-end">
              <RowTotal amount={calcWorkshop(r)} />
              <button type="button" onClick={() => setLines(p => p.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-red-500 mr-1">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1 text-xs h-7">
        <Plus className="w-3 h-3" /> הוסף סדנה
      </Button>
    </div>
  );
}

function LectureSection({ lines, setLines }) {
  const update = (idx, field, val) => {
    setLines(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const u = { ...r, [field]: val };
      if (field === "name") {
        const cat = LECTURE_CATALOG.find(c => c.name === val);
        if (cat) { u.lecturer = cat.lecturer; u.base_price = cat.base_price; u.vat_included = cat.vat_included; }
      }
      return u;
    }));
  };

  const addRow = () => {
    const cat = LECTURE_CATALOG[0];
    setLines(p => [...p, { name: cat.name, lecturer: cat.lecturer, base_price: cat.base_price, vat_included: cat.vat_included }]);
  };

  return (
    <div className="space-y-2">
      <SectionHeader title="הרצאות" />
      {lines.map((r, idx) => {
        const vatAmount = r.vat_included ? Math.round(Number(r.base_price) * VAT_RATE) : 0;
        const total = calcLecture(r);
        return (
          <div key={idx} className="grid grid-cols-12 gap-2 items-end text-xs">
            <div className="col-span-5 space-y-0.5">
              <div className="text-muted-foreground text-[10px]">הרצאה</div>
              <Select value={r.name} onValueChange={v => update(idx, "name", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LECTURE_CATALOG.map(c => (
                    <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-0.5">
              <div className="text-muted-foreground text-[10px]">מרצה</div>
              <div className="h-8 flex items-center text-xs text-muted-foreground border rounded-md px-2 bg-muted/30">{r.lecturer}</div>
            </div>
            <div className="col-span-2 space-y-0.5">
              <div className="text-muted-foreground text-[10px]">מחיר בסיס (₪)</div>
              <Input className="h-8 text-xs" type="number" min="0" value={r.base_price} onChange={e => update(idx, "base_price", Number(e.target.value))} />
            </div>
            <div className="col-span-1 flex flex-col items-center gap-0.5">
              <div className="text-muted-foreground text-[10px]">מע"מ</div>
              <input type="checkbox" checked={r.vat_included} onChange={e => update(idx, "vat_included", e.target.checked)} className="mt-2" />
            </div>
            <div className="col-span-2 flex items-end gap-1 justify-end">
              <div className="text-right">
                <RowTotal amount={total} />
                {r.vat_included && <div className="text-[10px] text-muted-foreground">כולל מע"מ ₪{vatAmount.toLocaleString()}</div>}
              </div>
              <button type="button" onClick={() => setLines(p => p.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-red-500 mb-0.5">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1 text-xs h-7">
        <Plus className="w-3 h-3" /> הוסף הרצאה
      </Button>
    </div>
  );
}

function AddonSection({ lines, setLines }) {
  const update = (idx, field, val) => {
    setLines(prev => prev.map((r, i) => (i !== idx ? r : { ...r, [field]: val })));
  };
  return (
    <div className="space-y-2">
      <SectionHeader title="תוספות חופשיות" />
      {lines.map((r, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end text-xs">
          <Input className="col-span-5 h-8 text-xs" placeholder="תיאור" value={r.description} onChange={e => update(idx, "description", e.target.value)} />
          <div className="col-span-2 space-y-0.5">
            <div className="text-muted-foreground text-[10px]">כמות</div>
            <Input className="h-8 text-xs" type="number" min="0" value={r.quantity} onChange={e => update(idx, "quantity", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-0.5">
            <div className="text-muted-foreground text-[10px]">מחיר יחידה</div>
            <Input className="h-8 text-xs" type="number" min="0" value={r.unit_price} onChange={e => update(idx, "unit_price", e.target.value)} />
          </div>
          <div className="col-span-2 flex items-end justify-end gap-1">
            <RowTotal amount={calcAddon(r)} />
            <button type="button" onClick={() => setLines(p => p.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-red-500 mb-0.5">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, { description: "", quantity: 1, unit_price: 0 }])} className="gap-1 text-xs h-7">
        <Plus className="w-3 h-3" /> הוסף תוספת
      </Button>
    </div>
  );
}

function AdjustmentSection({ lines, setLines }) {
  const update = (idx, field, val) => {
    setLines(prev => prev.map((r, i) => (i !== idx ? r : { ...r, [field]: val })));
  };
  return (
    <div className="space-y-2">
      <SectionHeader title="התאמות / שינויים" subtitle="סכום חיובי = תוספת, שלילי = הנחה" />
      {lines.map((r, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end text-xs">
          <Input className="col-span-8 h-8 text-xs" placeholder="תיאור" value={r.description} onChange={e => update(idx, "description", e.target.value)} />
          <div className="col-span-2 space-y-0.5">
            <div className="text-muted-foreground text-[10px]">סכום (₪)</div>
            <Input className="h-8 text-xs" type="number" value={r.amount} onChange={e => update(idx, "amount", e.target.value)} />
          </div>
          <div className="col-span-2 flex items-end justify-end gap-1">
            <RowTotal amount={Number(r.amount)} />
            <button type="button" onClick={() => setLines(p => p.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-red-500 mb-0.5">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, { description: "", amount: 0 }])} className="gap-1 text-xs h-7">
        <Plus className="w-3 h-3" /> הוסף התאמה
      </Button>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function QuoteFormModal({ quote, group, onClose, onSaved }) {
  const isEdit = !!quote;

  const [form, setForm] = useState({
    quote_number:    quote?.quote_number    || "",
    version:         quote?.version         || 1,
    status:          quote?.status          || "DRAFT",
    client_name:     quote?.client_name     || group?.contact_name  || "",
    client_phone:    quote?.client_phone    || group?.contact_phone || "",
    client_email:    quote?.client_email    || group?.contact_email || "",
    client_tax_id:   quote?.client_tax_id   || "",
    arrival_date:    quote?.arrival_date    || group?.arrival_date   || "",
    departure_date:  quote?.departure_date  || group?.departure_date || "",
    estimated_pax:   quote?.estimated_pax   || group?.total_pax     || "",
    staff_count:     quote?.staff_count     || group?.staff_count   || "",
    participant_count: quote?.participant_count || group?.participant_count || "",
    coffee_corner_pax: quote?.coffee_corner_pax || "",
    discount_percent:  quote?.discount_percent  || 0,
    payment_terms:   quote?.payment_terms   || "",
    valid_until:     quote?.valid_until     || "",
    internal_notes:  quote?.internal_notes  || "",
  });

  const [studentLodging, setStudentLodging] = useState(parse(quote?.student_lodging_lines, []));
  const [adultLodging,   setAdultLodging]   = useState(parse(quote?.adult_lodging_lines,  []));
  const [workshops,      setWorkshops]      = useState(parse(quote?.workshop_lines,        []));
  const [lectures,       setLectures]       = useState(parse(quote?.lecture_lines,         []));
  const [addons,         setAddons]         = useState(parse(quote?.addon_lines,           []));
  const [adjustments,    setAdjustments]    = useState(parse(quote?.adjustment_lines,      []));
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Live totals
  const studentLodgingTotal = studentLodging.reduce((s, r) => s + calcStudentLodging(r), 0);
  const adultLodgingTotal   = adultLodging.reduce((s, r) => s + calcAdultLodging(r), 0);
  const workshopTotal       = workshops.reduce((s, r) => s + calcWorkshop(r), 0);
  const lectureTotal        = lectures.reduce((s, r) => s + calcLecture(r), 0);
  const coffeeTotal         = Number(form.coffee_corner_pax || 0) * COFFEE_CORNER_RATE;
  const addonTotal          = addons.reduce((s, r) => s + calcAddon(r), 0);
  const adjustmentTotal     = adjustments.reduce((s, r) => s + Number(r.amount || 0), 0);

  const subtotal       = studentLodgingTotal + adultLodgingTotal + workshopTotal + lectureTotal + coffeeTotal + addonTotal + adjustmentTotal;
  const discountAmount = Math.round(subtotal * Number(form.discount_percent || 0) / 100);
  const total_price    = subtotal - discountAmount;
  const advance        = Math.round(total_price * 0.3);
  const balance        = total_price - advance;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      group_id: group.id,
      student_lodging_lines: JSON.stringify(studentLodging),
      adult_lodging_lines:   JSON.stringify(adultLodging),
      workshop_lines:        JSON.stringify(workshops),
      lecture_lines:         JSON.stringify(lectures),
      addon_lines:           JSON.stringify(addons),
      adjustment_lines:      JSON.stringify(adjustments),
      subtotal,
      discount_amount: discountAmount,
      total_price,
      advance_payment:  advance,
      balance_payment:  balance,
      version:          Number(form.version),
      estimated_pax:    form.estimated_pax    !== "" ? Number(form.estimated_pax)    : undefined,
      staff_count:      form.staff_count      !== "" ? Number(form.staff_count)      : undefined,
      participant_count: form.participant_count !== "" ? Number(form.participant_count) : undefined,
      coffee_corner_pax: form.coffee_corner_pax !== "" ? Number(form.coffee_corner_pax) : undefined,
      discount_percent: Number(form.discount_percent || 0),
    };
    if (isEdit) await base44.entities.Quote.update(quote.id, payload);
    else await base44.entities.Quote.create(payload);
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{isEdit ? "עריכת הצעת מחיר" : "הצעת מחיר חדשה"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 text-sm">

          {/* ── Header ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>מספר הצעה</Label>
              <Input value={form.quote_number} onChange={e => set("quote_number", e.target.value)} placeholder="Q-2026-001" />
            </div>
            <div className="space-y-1">
              <Label>גרסה</Label>
              <Input type="number" min="1" value={form.version} onChange={e => set("version", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>סטטוס</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["DRAFT","SENT","APPROVED","REJECTED","EXPIRED"].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>תאריך הגעה</Label>
              <Input type="date" value={form.arrival_date} onChange={e => set("arrival_date", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>תאריך עזיבה</Label>
              <Input type="date" value={form.departure_date} onChange={e => set("departure_date", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>בתוקף עד</Label>
              <Input type="date" value={form.valid_until} onChange={e => set("valid_until", e.target.value)} />
            </div>
          </div>

          {/* ── Client ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>שם לקוח / ארגון</Label>
              <Input value={form.client_name} onChange={e => set("client_name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>ח.פ / ע.מ</Label>
              <Input value={form.client_tax_id} onChange={e => set("client_tax_id", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>טלפון</Label>
              <Input value={form.client_phone} onChange={e => set("client_phone", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>אימייל</Label>
              <Input type="email" value={form.client_email} onChange={e => set("client_email", e.target.value)} />
            </div>
          </div>

          {/* ── Headcounts ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>סה"כ משתתפים (הערכה)</Label>
              <Input type="number" min="0" value={form.estimated_pax} onChange={e => set("estimated_pax", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>צוות</Label>
              <Input type="number" min="0" value={form.staff_count} onChange={e => set("staff_count", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>תלמידים / חניכים</Label>
              <Input type="number" min="0" value={form.participant_count} onChange={e => set("participant_count", e.target.value)} />
            </div>
          </div>

          {/* ── Pricing sections ── */}
          <StudentLodgingSection lines={studentLodging} setLines={setStudentLodging} />
          <AdultLodgingSection   lines={adultLodging}   setLines={setAdultLodging} />
          <WorkshopSection       lines={workshops}       setLines={setWorkshops} />
          <LectureSection        lines={lectures}        setLines={setLectures} />

          {/* Coffee Corner */}
          <div className="space-y-2">
            <SectionHeader title="פינת קפה" subtitle={`₪${COFFEE_CORNER_RATE} לאדם`} />
            <div className="flex items-end gap-4">
              <div className="space-y-1 w-40">
                <Label className="text-xs">מס' אנשים</Label>
                <Input type="number" min="0" value={form.coffee_corner_pax} onChange={e => set("coffee_corner_pax", e.target.value)} />
              </div>
              <div className="text-sm font-semibold pb-2">= ₪{coffeeTotal.toLocaleString()}</div>
            </div>
          </div>

          <AddonSection      lines={addons}      setLines={setAddons} />
          <AdjustmentSection lines={adjustments} setLines={setAdjustments} />

          {/* ── Totals ── */}
          <div className="border-t pt-4 space-y-3 bg-muted/20 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
              <div>לינה סטודנטים: <span className="font-medium text-foreground">₪{Math.round(studentLodgingTotal).toLocaleString()}</span></div>
              <div>לינה מבוגרים: <span className="font-medium text-foreground">₪{Math.round(adultLodgingTotal).toLocaleString()}</span></div>
              <div>סדנאות: <span className="font-medium text-foreground">₪{Math.round(workshopTotal).toLocaleString()}</span></div>
              <div>הרצאות: <span className="font-medium text-foreground">₪{Math.round(lectureTotal).toLocaleString()}</span></div>
              <div>פינת קפה: <span className="font-medium text-foreground">₪{Math.round(coffeeTotal).toLocaleString()}</span></div>
              <div>תוספות: <span className="font-medium text-foreground">₪{Math.round(addonTotal + adjustmentTotal).toLocaleString()}</span></div>
            </div>

            <div className="grid grid-cols-3 gap-3 items-end border-t pt-3">
              <div>
                <div className="text-xs text-muted-foreground">סכום ביניים</div>
                <div className="text-base font-semibold">₪{Math.round(subtotal).toLocaleString()}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">הנחה (%)</Label>
                <Input type="number" min="0" max="100" value={form.discount_percent} onChange={e => set("discount_percent", e.target.value)} />
                {discountAmount > 0 && <div className="text-xs text-muted-foreground">= ₪{discountAmount.toLocaleString()}</div>}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">סה"כ לתשלום</div>
                <div className="text-lg font-bold text-primary">₪{Math.round(total_price).toLocaleString()}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs border-t pt-2">
              <div className="text-muted-foreground">מקדמה 30%: <span className="font-medium text-foreground">₪{advance.toLocaleString()}</span></div>
              <div className="text-muted-foreground">יתרה 70%: <span className="font-medium text-foreground">₪{balance.toLocaleString()}</span></div>
            </div>
          </div>

          {/* Footer */}
          <div className="space-y-1">
            <Label>תנאי תשלום</Label>
            <Input value={form.payment_terms} onChange={e => set("payment_terms", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>הערות פנימיות</Label>
            <Textarea rows={2} value={form.internal_notes} onChange={e => set("internal_notes", e.target.value)} />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose}>ביטול</Button>
            <Button type="submit" disabled={saving}>{saving ? "שומר..." : isEdit ? "שמור" : "צור הצעה"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}