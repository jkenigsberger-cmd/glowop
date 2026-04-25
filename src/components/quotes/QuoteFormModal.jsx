import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  BED3:  { label: "אוהל 3 מיטות", rate: 340, capacity: 3 },
  BED68: { label: "אוהל 6/8 מיטות", rate: 250, capacity: 6 },
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

// Calculate nights between two date strings (YYYY-MM-DD)
const calcNights = (arrival, departure) => {
  if (!arrival || !departure) return 1;
  const diff = (new Date(departure) - new Date(arrival)) / (1000 * 60 * 60 * 24);
  return Math.max(1, Math.round(diff));
};

// Suggest weekend vs midweek from arrival date (Thu or Fri = weekend)
// Returns a suggested rate_type string; does NOT hard-lock anything.
const suggestLodgingRateType = (arrivalDate, groupType) => {
  if (groupType === "DAY_USE") return "day_activity";
  if (!arrivalDate) return "midweek_lodging";
  const day = new Date(arrivalDate).getDay(); // 0=Sun … 6=Sat
  return (day === 4 || day === 5) ? "weekend_lodging" : "midweek_lodging";
};

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

function StudentLodgingSection({ lines, setLines, suggestedRateType, groupType, defaultPax, defaultNights }) {
  const isDayUse = groupType === "DAY_USE";

  const update = (idx, field, val) => {
    setLines(prev => prev.map((r, i) => (i !== idx ? r : { ...r, [field]: val })));
  };

  const addRow = () => {
    const rateType = suggestedRateType || "midweek_lodging";
    const isDay = rateType === "day_activity";
    setLines(p => [...p, { rate_type: rateType, pax: defaultPax || 0, nights: isDay ? 1 : (defaultNights || 1) }]);
  };

  return (
    <div className="space-y-2">
      <SectionHeader
        title="לינה — תלמידים"
        subtitle={isDayUse ? "יום פעילות בלבד — ₪125 לאדם" : suggestedRateType === "weekend_lodging" ? "זוהה: לינת סוף שבוע (ניתן לשנות)" : "זוהה: לינת אמצע שבוע (ניתן לשנות)"}
      />
      {lines.map((r, idx) => {
        const isDay = r.rate_type === "day_activity";
        return (
          <div key={idx} className="grid grid-cols-12 gap-2 items-end text-xs">
            <div className="col-span-4 space-y-0.5">
              <div className="text-muted-foreground text-[10px]">סוג</div>
              <Select value={r.rate_type} onValueChange={v => update(idx, "rate_type", v)} disabled={isDayUse}>
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
            {!isDay && (
              <div className="col-span-2 space-y-0.5">
                <div className="text-muted-foreground text-[10px]">לילות</div>
                <Input className="h-8 text-xs" type="number" min="1" value={r.nights} onChange={e => update(idx, "nights", e.target.value)} />
              </div>
            )}
            <div className={!isDay ? "col-span-3" : "col-span-5"} />
            <div className="col-span-1 flex items-center gap-1 justify-end">
              <RowTotal amount={calcStudentLodging(r)} />
              <button type="button" onClick={() => setLines(p => p.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-red-500 mr-1">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1 text-xs h-7">
        <Plus className="w-3 h-3" /> הוסף שורה
      </Button>
    </div>
  );
}

function AdultLodgingSection({ lines, setLines, defaultNights, adultsCount }) {
  const update = (idx, field, val) => {
    setLines(prev => prev.map((r, i) => (i !== idx ? r : { ...r, [field]: val })));
  };

  // Capacity indicator
  const allocatedBeds = lines.reduce((sum, r) => {
    const cap = ADULT_TENT_RATES[r.tent_type]?.capacity ?? 0;
    return sum + (Number(r.tent_count) * cap);
  }, 0);
  const remaining = adultsCount - allocatedBeds;
  const hasAdults = adultsCount > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SectionHeader title="לינה — מבוגרים" subtitle="מחיר לאוהל ללילה" />
        {hasAdults && (
          <div className={`text-xs px-2 py-1 rounded-md font-medium ${
            remaining > 0 ? "bg-amber-50 text-amber-700 border border-amber-200" :
            remaining === 0 ? "bg-green-50 text-green-700 border border-green-200" :
            "bg-blue-50 text-blue-600 border border-blue-200"
          }`}>
            {remaining > 0
              ? `חסרות ${remaining} מקומות (${adultsCount} צוות, ${allocatedBeds} מוקצות)`
              : remaining === 0
              ? `✓ כל ${adultsCount} מקומות מכוסות`
              : `עודף ${Math.abs(remaining)} מקומות`
            }
          </div>
        )}
      </div>
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
      <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, { tent_type: "BED3", tent_count: 0, nights: defaultNights || 1 }])} className="gap-1 text-xs h-7">
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
  const isNewGroupFlow = !group; // creating Group + Quote together
  const groupType = group?.group_type || "LODGING";
  const navigate = useNavigate();

  // Group shell fields (only used when isNewGroupFlow)
  const [groupForm, setGroupForm] = useState({
    group_name:    "",
    group_type:    "LODGING",
    contact_name:  "",
    contact_phone: "",
    contact_email: "",
    client_tax_id: "",
  });
  const setGroup = (k, v) => setGroupForm(f => ({ ...f, [k]: v }));

  // Sync: when contact fields change in new-group flow, mirror to quote client fields
  const handleGroupContactChange = (k, v) => {
    setGroup(k, v);
    // Mirror to quote client fields (they remain editable/overridable)
    const mirrorMap = { contact_name: "client_name", contact_phone: "client_phone", contact_email: "client_email", client_tax_id: "client_tax_id" };
    if (mirrorMap[k]) setForm(f => ({ ...f, [mirrorMap[k]]: v }));
  };

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
    estimated_pax:   quote?.estimated_pax   ?? group?.total_pax     ?? "",
    staff_count:     quote?.staff_count     ?? group?.staff_count   ?? "",
    discount_percent: quote?.discount_percent ?? 0,
    payment_terms:   quote?.payment_terms   || "",
    valid_until:     quote?.valid_until     || "",
    internal_notes:  quote?.internal_notes  || "",
  });

  // Coffee Corner: yes/no toggle (not a pax count input)
  const [coffeeEnabled, setCoffeeEnabled] = useState(
    quote ? (quote.coffee_corner_pax > 0) : false
  );

  // Pre-compute initial values for auto-fill (used only during useState init for new quotes)
  const initArrival    = quote?.arrival_date    || group?.arrival_date    || "";
  const initDeparture  = quote?.departure_date  || group?.departure_date  || "";
  const initNights     = calcNights(initArrival, initDeparture);
  const initEstPax     = Number(quote?.estimated_pax   ?? group?.total_pax    ?? 0);
  const initStaff      = Number(quote?.staff_count     ?? group?.staff_count  ?? 0);
  const initParticipants = Math.max(0, initEstPax - initStaff);
  const initRateType   = suggestLodgingRateType(initArrival, group?.group_type || "LODGING");

  // For new quotes with no saved lines, auto-create a pre-filled student lodging row
  const initStudentLodging = () => {
    const saved = parse(quote?.student_lodging_lines, null);
    if (saved !== null) return saved; // editing: use saved data
    if (initParticipants === 0 && initNights === 1) return []; // no useful data yet
    const isDay = initRateType === "day_activity";
    return [{ rate_type: initRateType, pax: initParticipants, nights: isDay ? 1 : initNights }];
  };

  const [studentLodging, setStudentLodging] = useState(initStudentLodging);
  const [adultLodging,   setAdultLodging]   = useState(parse(quote?.adult_lodging_lines,  []));
  const [workshops,      setWorkshops]      = useState(parse(quote?.workshop_lines,        []));
  const [lectures,       setLectures]       = useState(parse(quote?.lecture_lines,         []));
  const [addons,         setAddons]         = useState(parse(quote?.addon_lines,           []));
  const [adjustments,    setAdjustments]    = useState(parse(quote?.adjustment_lines,      []));
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Derived: participant_count = estimated_pax - staff_count
  const estimatedPax   = Number(form.estimated_pax || 0);
  const staffCount     = Number(form.staff_count   || 0);
  const participantCount = Math.max(0, estimatedPax - staffCount);

  // Nights from current form dates (live)
  const nights = calcNights(form.arrival_date, form.departure_date);

  // Suggested lodging rate type from arrival date
  const suggestedRateType = suggestLodgingRateType(form.arrival_date, groupType);

  // Coffee: staff_count × ₪15, only if enabled and staff_count > 0
  const coffeeTotal = coffeeEnabled && staffCount > 0 ? staffCount * COFFEE_CORNER_RATE : 0;

  // Live totals
  const studentLodgingTotal = studentLodging.reduce((s, r) => s + calcStudentLodging(r), 0);
  const adultLodgingTotal   = adultLodging.reduce((s, r) => s + calcAdultLodging(r), 0);
  const workshopTotal       = workshops.reduce((s, r) => s + calcWorkshop(r), 0);
  const lectureTotal        = lectures.reduce((s, r) => s + calcLecture(r), 0);
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

    let resolvedGroupId = group?.id;

    // New-group flow: create Group shell first
    if (isNewGroupFlow) {
      const totalPax   = Number(form.estimated_pax || 0);
      const staffPax   = Number(form.staff_count   || 0);
      const newGroup = await base44.entities.Group.create({
        group_name:        groupForm.group_name,
        group_type:        groupForm.group_type,
        arrival_date:      form.arrival_date  || undefined,
        departure_date:    form.departure_date || undefined,
        total_pax:         totalPax  || undefined,
        staff_count:       staffPax  || undefined,
        participant_count: Math.max(0, totalPax - staffPax) || undefined,
        contact_name:      groupForm.contact_name  || undefined,
        contact_phone:     groupForm.contact_phone || undefined,
        contact_email:     groupForm.contact_email || undefined,
        status:            "DRAFT",
      });
      resolvedGroupId = newGroup.id;
    }

    const quotePayload = {
      ...form,
      group_id: resolvedGroupId,
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
      estimated_pax:    estimatedPax  || undefined,
      staff_count:      staffCount    || undefined,
      participant_count: participantCount || undefined,
      coffee_corner_pax: coffeeEnabled ? staffCount : 0,
      discount_percent: Number(form.discount_percent || 0),
    };

    if (isEdit) {
      await base44.entities.Quote.update(quote.id, quotePayload);
    } else {
      await base44.entities.Quote.create(quotePayload);
    }

    setSaving(false);

    if (isNewGroupFlow && resolvedGroupId) {
      navigate(`/groups/${resolvedGroupId}`);
      onClose();
    } else {
      onSaved();
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">
            {isEdit ? "עריכת הצעת מחיר" : isNewGroupFlow ? "יצירת הצעת מחיר — לקוח חדש" : "הצעת מחיר חדשה"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 text-sm">

          {/* ── Group Shell (new-group flow only) ── */}
          {isNewGroupFlow && (
            <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-primary border-b border-primary/20 pb-1">פרטי קבוצה</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>שם קבוצה / ארגון *</Label>
                  <Input
                    required
                    value={groupForm.group_name}
                    onChange={e => setGroup("group_name", e.target.value)}
                    placeholder="שם בית הספר / הארגון"
                  />
                </div>
                <div className="space-y-1">
                  <Label>סוג</Label>
                  <Select value={groupForm.group_type} onValueChange={v => setGroup("group_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LODGING">לינה</SelectItem>
                      <SelectItem value="DAY_USE">יום כיף</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="text-xs font-semibold text-muted-foreground mt-2">איש קשר ופרטי חיוב</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>שם איש קשר</Label>
                  <Input value={groupForm.contact_name} onChange={e => handleGroupContactChange("contact_name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>ח.פ / ע.מ</Label>
                  <Input value={groupForm.client_tax_id} onChange={e => handleGroupContactChange("client_tax_id", e.target.value)} placeholder="מספר חברה / עוסק" />
                </div>
                <div className="space-y-1">
                  <Label>טלפון</Label>
                  <Input value={groupForm.contact_phone} onChange={e => handleGroupContactChange("contact_phone", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>אימייל</Label>
                  <Input type="email" value={groupForm.contact_email} onChange={e => handleGroupContactChange("contact_email", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ── Quote Header ── */}
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
              <Label>חניכים (מחושב)</Label>
              <div className="h-9 flex items-center px-3 rounded-md border bg-muted/40 text-sm font-medium">
                {participantCount}
              </div>
            </div>
          </div>

          {/* ── Pricing sections ── */}
          <StudentLodgingSection
            lines={studentLodging}
            setLines={setStudentLodging}
            suggestedRateType={suggestedRateType}
            groupType={groupType}
            defaultPax={participantCount}
            defaultNights={nights}
          />
          <AdultLodgingSection lines={adultLodging} setLines={setAdultLodging} defaultNights={nights} adultsCount={staffCount} />
          <WorkshopSection       lines={workshops}       setLines={setWorkshops} />
          <LectureSection        lines={lectures}        setLines={setLectures} />

          {/* Coffee Corner */}
          <div className="space-y-2">
            <SectionHeader title="פינת קפה" subtitle={`₪${COFFEE_CORNER_RATE} לאיש צוות`} />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={coffeeEnabled}
                  onChange={e => setCoffeeEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">כלול פינת קפה</span>
              </label>
              {coffeeEnabled && (
                <span className="text-sm text-muted-foreground">
                  {staffCount} אנשי צוות × ₪{COFFEE_CORNER_RATE}
                  {" = "}
                  <span className="font-semibold text-foreground">₪{coffeeTotal.toLocaleString()}</span>
                </span>
              )}
              {coffeeEnabled && staffCount === 0 && (
                <span className="text-xs text-amber-700">הזן מספר אנשי צוות לחישוב</span>
              )}
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