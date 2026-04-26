import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, CalendarDays, Users, Coffee, BookOpen, Mic2, Tag, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";

// ── Catalog ───────────────────────────────────────────────────────────────────
const STUDENT_LODGING_RATES = {
  day_activity:    { label: "יום פעילות",       rate: 125 },
  midweek_lodging: { label: "לינה אמצע שבוע",   rate: 190 },
  weekend_lodging: { label: "לינה סוף שבוע",     rate: 250 },
};
const ADULT_TENT_RATES = {
  BED3:  { label: "אוהל 3 מיטות",   rate: 340, capacity: 3 },
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
  { name: "פדגוגיה של תקווה",      lecturer: "שירלי רימון ברכה", base_price: 2500, vat_included: false },
  { name: "חינוך כמעשה נרטיבי",    lecturer: "שירלי רימון ברכה", base_price: 2500, vat_included: false },
  { name: "יהודית ודמוקרטית",      lecturer: "שירלי רימון ברכה", base_price: 2500, vat_included: false },
  { name: "בניית אקוסיסטם חינוכי", lecturer: "רותי אנזל",         base_price: 1500, vat_included: false },
  { name: "לצאת מדעתנו",           lecturer: "מירב לשם גונן",     base_price: 5000, vat_included: true  },
];
const VAT_RATE = 0.18;
const COFFEE_CORNER_RATE = 15;

// ── Helpers ───────────────────────────────────────────────────────────────────
const parse = (str, fallback) => { try { const r = JSON.parse(str); return Array.isArray(r) ? r : fallback; } catch { return fallback; } };
const fmtMoney = (n) => `₪${Math.round(Number(n) || 0).toLocaleString("he-IL")}`;
const fmtDate  = (d) => { if (!d) return null; try { return new Date(d).toLocaleDateString("he-IL"); } catch { return d; } };

const calcNights = (arrival, departure) => {
  if (!arrival || !departure) return 0;
  return Math.max(0, Math.round((new Date(departure) - new Date(arrival)) / 86400000));
};
const suggestLodgingRateType = (arrivalDate, groupType) => {
  if (groupType === "DAY_USE") return "day_activity";
  if (!arrivalDate) return "midweek_lodging";
  const day = new Date(arrivalDate).getDay();
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
const calcLecture  = (r) => { const base = Number(r.base_price ?? 0); return r.vat_included ? base * (1 + VAT_RATE) : base; };
const calcAddon    = (r) => Number(r.quantity) * Number(r.unit_price);

// ── Design tokens ─────────────────────────────────────────────────────────────
const CARD = "bg-white rounded-2xl border border-slate-200 shadow-sm";
const SEC_TITLE = "flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3";

// ── Reusable UI atoms ─────────────────────────────────────────────────────────
function FieldLabel({ children }) {
  return <div className="text-[11px] text-slate-400 font-medium mb-0.5">{children}</div>;
}

function SectionCard({ icon: Icon, title, subtitle, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={CARD}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-right"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-primary/70" />}
          <span className="font-semibold text-sm text-slate-700">{title}</span>
          {subtitle && <span className="text-xs text-slate-400 font-normal">{subtitle}</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-3">{children}</div>}
    </div>
  );
}

function RowTotal({ amount }) {
  return <div className="text-xs font-semibold text-primary whitespace-nowrap">{fmtMoney(amount)}</div>;
}

// ── Section sub-components (logic unchanged) ──────────────────────────────────
function StudentLodgingSection({ lines, setLines, suggestedRateType, groupType, defaultPax, defaultNights }) {
  const isDayUse = groupType === "DAY_USE";
  const update = (idx, field, val) => setLines(prev => prev.map((r, i) => i !== idx ? r : { ...r, [field]: val }));
  const addRow = () => {
    const rateType = suggestedRateType || "midweek_lodging";
    const isDay = rateType === "day_activity";
    setLines(p => [...p, { rate_type: rateType, pax: defaultPax || 0, nights: isDay ? 1 : (defaultNights || 1) }]);
  };
  return (
    <div className="space-y-2">
      {lines.map((r, idx) => {
        const isDay = r.rate_type === "day_activity";
        return (
          <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-slate-50 rounded-xl p-2.5">
            <div className="col-span-4 space-y-0.5">
              <FieldLabel>סוג</FieldLabel>
              <Select value={r.rate_type} onValueChange={v => update(idx, "rate_type", v)} disabled={isDayUse}>
                <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STUDENT_LODGING_RATES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label} — ₪{v.rate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-0.5">
              <FieldLabel>תלמידים</FieldLabel>
              <Input className="h-8 text-xs bg-white" type="number" min="0" value={r.pax} onChange={e => update(idx, "pax", e.target.value)} />
            </div>
            {!isDay && (
              <div className="col-span-2 space-y-0.5">
                <FieldLabel>לילות</FieldLabel>
                <Input className="h-8 text-xs bg-white" type="number" min="1" value={r.nights} onChange={e => update(idx, "nights", e.target.value)} />
              </div>
            )}
            <div className={!isDay ? "col-span-3" : "col-span-5"} />
            <div className="col-span-1 flex items-center gap-1 justify-end">
              <RowTotal amount={calcStudentLodging(r)} />
              <button type="button" onClick={() => setLines(p => p.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1.5 text-xs h-7 border-dashed">
        <Plus className="w-3 h-3" /> הוסף שורה
      </Button>
    </div>
  );
}

function AdultLodgingSection({ lines, setLines, defaultNights, adultsCount }) {
  const update = (idx, field, val) => setLines(prev => prev.map((r, i) => i !== idx ? r : { ...r, [field]: val }));
  const allocatedBeds = lines.reduce((sum, r) => {
    const cap = r.tent_type === "BED68" ? (r.actual_beds || 6) : (ADULT_TENT_RATES[r.tent_type]?.capacity ?? 0);
    return sum + (Number(r.tent_count) * cap);
  }, 0);
  const remaining = adultsCount - allocatedBeds;
  return (
    <div className="space-y-2">
      {adultsCount > 0 && (
        <div className={`text-xs px-3 py-1.5 rounded-lg font-medium inline-flex ${
          remaining > 0 ? "bg-amber-50 text-amber-700 border border-amber-200" :
          remaining === 0 ? "bg-green-50 text-green-700 border border-green-200" :
          "bg-blue-50 text-blue-600 border border-blue-200"
        }`}>
          {remaining > 0 ? `חסרות ${remaining} מקומות` : remaining === 0 ? `✓ כל ${adultsCount} מקומות מכוסות` : `עודף ${Math.abs(remaining)} מקומות`}
        </div>
      )}
      {lines.map((r, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-slate-50 rounded-xl p-2.5">
          <div className="col-span-4 space-y-0.5">
            <FieldLabel>סוג אוהל</FieldLabel>
            <Select value={r.tent_type} onValueChange={v => update(idx, "tent_type", v)}>
              <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ADULT_TENT_RATES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label} — ₪{v.rate}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-0.5">
            <FieldLabel>אוהלים</FieldLabel>
            <Input className="h-8 text-xs bg-white" type="number" min="0" value={r.tent_count} onChange={e => update(idx, "tent_count", e.target.value)} />
          </div>
          {r.tent_type === "BED68" && (
            <div className="col-span-2 space-y-0.5">
              <FieldLabel>מיטות</FieldLabel>
              <Select value={String(r.actual_beds || 6)} onValueChange={v => update(idx, "actual_beds", Number(v))}>
                <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 מיטות</SelectItem>
                  <SelectItem value="8">8 מיטות</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="col-span-2 space-y-0.5">
            <FieldLabel>לילות</FieldLabel>
            <Input className="h-8 text-xs bg-white" type="number" min="1" value={r.nights} onChange={e => update(idx, "nights", e.target.value)} />
          </div>
          <div className={r.tent_type === "BED68" ? "col-span-1" : "col-span-3"} />
          <div className="col-span-1 flex items-center gap-1 justify-end">
            <RowTotal amount={calcAdultLodging(r)} />
            <button type="button" onClick={() => setLines(p => p.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-400">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, { tent_type: "BED3", tent_count: 0, nights: defaultNights || 1 }])} className="gap-1.5 text-xs h-7 border-dashed">
        <Plus className="w-3 h-3" /> הוסף שורה
      </Button>
    </div>
  );
}

function WorkshopSection({ lines, setLines }) {
  const update = (idx, field, val) => setLines(prev => prev.map((r, i) => {
    if (i !== idx) return r;
    const u = { ...r, [field]: val };
    if (field === "name" || field === "audience") {
      const cat = WORKSHOP_CATALOG.find(c => c.name === (field === "name" ? val : u.name));
      if (cat) { const aud = field === "audience" ? val : u.audience; u.rate = aud === "STUDENTS" ? (cat.students ?? 0) : (cat.adults ?? 0); }
    }
    return u;
  }));
  const addRow = () => { const cat = WORKSHOP_CATALOG[0]; setLines(p => [...p, { name: cat.name, audience: "STUDENTS", rate: cat.students }]); };
  return (
    <div className="space-y-2">
      {lines.map((r, idx) => {
        const cat = WORKSHOP_CATALOG.find(c => c.name === r.name);
        return (
          <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-slate-50 rounded-xl p-2.5">
            <div className="col-span-5 space-y-0.5">
              <FieldLabel>סדנה</FieldLabel>
              <Select value={r.name} onValueChange={v => update(idx, "name", v)}>
                <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>{WORKSHOP_CATALOG.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-3 space-y-0.5">
              <FieldLabel>קהל</FieldLabel>
              <Select value={r.audience} onValueChange={v => update(idx, "audience", v)} disabled={cat && cat.adults === null}>
                <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENTS">תלמידים</SelectItem>
                  {cat?.adults !== null && <SelectItem value="ADULTS">מבוגרים</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-0.5">
              <FieldLabel>מחיר (₪)</FieldLabel>
              <Input className="h-8 text-xs bg-white" type="number" min="0" value={r.rate} onChange={e => update(idx, "rate", Number(e.target.value))} />
            </div>
            <div className="col-span-2 flex items-center gap-1 justify-end">
              <RowTotal amount={calcWorkshop(r)} />
              <button type="button" onClick={() => setLines(p => p.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1.5 text-xs h-7 border-dashed"><Plus className="w-3 h-3" /> הוסף סדנה</Button>
    </div>
  );
}

function LectureSection({ lines, setLines }) {
  const update = (idx, field, val) => setLines(prev => prev.map((r, i) => {
    if (i !== idx) return r;
    const u = { ...r, [field]: val };
    if (field === "name") { const cat = LECTURE_CATALOG.find(c => c.name === val); if (cat) { u.lecturer = cat.lecturer; u.base_price = cat.base_price; u.vat_included = cat.vat_included; } }
    return u;
  }));
  const addRow = () => { const cat = LECTURE_CATALOG[0]; setLines(p => [...p, { name: cat.name, lecturer: cat.lecturer, base_price: cat.base_price, vat_included: cat.vat_included }]); };
  return (
    <div className="space-y-2">
      {lines.map((r, idx) => {
        const vatAmount = r.vat_included ? Math.round(Number(r.base_price) * VAT_RATE) : 0;
        return (
          <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-slate-50 rounded-xl p-2.5">
            <div className="col-span-5 space-y-0.5">
              <FieldLabel>הרצאה</FieldLabel>
              <Select value={r.name} onValueChange={v => update(idx, "name", v)}>
                <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>{LECTURE_CATALOG.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-0.5">
              <FieldLabel>מרצה</FieldLabel>
              <div className="h-8 flex items-center text-xs text-slate-400 border rounded-lg px-2 bg-white truncate">{r.lecturer}</div>
            </div>
            <div className="col-span-2 space-y-0.5">
              <FieldLabel>מחיר בסיס (₪)</FieldLabel>
              <Input className="h-8 text-xs bg-white" type="number" min="0" value={r.base_price} onChange={e => update(idx, "base_price", Number(e.target.value))} />
            </div>
            <div className="col-span-1 flex flex-col items-center gap-0.5 pt-4">
              <FieldLabel>מע״מ</FieldLabel>
              <input type="checkbox" checked={r.vat_included} onChange={e => update(idx, "vat_included", e.target.checked)} className="w-4 h-4 accent-primary" />
            </div>
            <div className="col-span-2 flex items-end gap-1 justify-end">
              <div className="text-right">
                <RowTotal amount={calcLecture(r)} />
                {r.vat_included && <div className="text-[10px] text-slate-400">+₪{vatAmount.toLocaleString()} מע״מ</div>}
              </div>
              <button type="button" onClick={() => setLines(p => p.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-400 mb-0.5"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1.5 text-xs h-7 border-dashed"><Plus className="w-3 h-3" /> הוסף הרצאה</Button>
    </div>
  );
}

function AddonSection({ lines, setLines }) {
  const update = (idx, field, val) => setLines(prev => prev.map((r, i) => i !== idx ? r : { ...r, [field]: val }));
  return (
    <div className="space-y-2">
      {lines.map((r, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-slate-50 rounded-xl p-2.5">
          <div className="col-span-5"><Input className="h-8 text-xs bg-white" placeholder="תיאור" value={r.description} onChange={e => update(idx, "description", e.target.value)} /></div>
          <div className="col-span-2 space-y-0.5"><FieldLabel>כמות</FieldLabel><Input className="h-8 text-xs bg-white" type="number" min="0" value={r.quantity} onChange={e => update(idx, "quantity", e.target.value)} /></div>
          <div className="col-span-2 space-y-0.5"><FieldLabel>מחיר יחידה</FieldLabel><Input className="h-8 text-xs bg-white" type="number" min="0" value={r.unit_price} onChange={e => update(idx, "unit_price", e.target.value)} /></div>
          <div className="col-span-2 flex items-end justify-end gap-1"><RowTotal amount={calcAddon(r)} /><button type="button" onClick={() => setLines(p => p.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-400 mb-0.5"><Trash2 className="w-3.5 h-3.5" /></button></div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, { description: "", quantity: 1, unit_price: 0 }])} className="gap-1.5 text-xs h-7 border-dashed"><Plus className="w-3 h-3" /> הוסף תוספת</Button>
    </div>
  );
}

function AdjustmentSection({ lines, setLines }) {
  const update = (idx, field, val) => setLines(prev => prev.map((r, i) => i !== idx ? r : { ...r, [field]: val }));
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-400">סכום חיובי = תוספת, שלילי = הנחה</p>
      {lines.map((r, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-slate-50 rounded-xl p-2.5">
          <div className="col-span-8"><Input className="h-8 text-xs bg-white" placeholder="תיאור" value={r.description} onChange={e => update(idx, "description", e.target.value)} /></div>
          <div className="col-span-2 space-y-0.5"><FieldLabel>סכום (₪)</FieldLabel><Input className="h-8 text-xs bg-white" type="number" value={r.amount} onChange={e => update(idx, "amount", e.target.value)} /></div>
          <div className="col-span-2 flex items-end justify-end gap-1"><RowTotal amount={Number(r.amount)} /><button type="button" onClick={() => setLines(p => p.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-400 mb-0.5"><Trash2 className="w-3.5 h-3.5" /></button></div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, { description: "", amount: 0 }])} className="gap-1.5 text-xs h-7 border-dashed"><Plus className="w-3 h-3" /> הוסף התאמה</Button>
    </div>
  );
}

// ── Right Sidebar ─────────────────────────────────────────────────────────────
function CalendarCard({ arrival, departure, nights, isDayUse }) {
  const hasDate = arrival;
  return (
    <div className={`${CARD} p-4`}>
      <div className={SEC_TITLE}><CalendarDays className="w-4 h-4 text-primary" />תאריכי פעילות</div>
      {hasDate ? (
        <div className="space-y-2">
          {isDayUse ? (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">תאריך פעילות</span>
              <span className="font-semibold text-slate-700">{fmtDate(arrival)}</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">הגעה</span>
                <span className="font-semibold text-slate-700">{fmtDate(arrival)}</span>
              </div>
              {departure && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">עזיבה</span>
                  <span className="font-semibold text-slate-700">{fmtDate(departure)}</span>
                </div>
              )}
            </>
          )}
          <div className="mt-2 bg-primary/5 border border-primary/15 rounded-xl py-2 text-center">
            <div className="text-2xl font-bold text-primary">{isDayUse ? "יום" : (nights > 0 ? nights : "יום")}</div>
            <div className="text-xs text-slate-400">{isDayUse ? "פעילות" : (nights > 0 ? "לילות" : "פעילות")}</div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-slate-400 text-center py-4">בחר תאריך בטופס</div>
      )}
    </div>
  );
}

function SummaryCard({ groupName, activityType, totalPax, staffCount, participantCount, workshops, lectures, coffeeEnabled }) {
  return (
    <div className={`${CARD} p-4`}>
      <div className={SEC_TITLE}><Users className="w-4 h-4 text-primary" />סיכום קבוצה</div>
      <div className="space-y-2 text-sm">
        {groupName && <div className="font-semibold text-slate-700 truncate">{groupName}</div>}
        {activityType && <div className="text-xs text-slate-400">{activityType}</div>}
        <div className="border-t border-slate-100 pt-2 space-y-1.5">
          {totalPax > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">סה״כ משתתפים</span>
              <span className="font-medium">{totalPax}</span>
            </div>
          )}
          {staffCount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">צוות</span>
              <span className="font-medium">{staffCount}</span>
            </div>
          )}
          {participantCount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-400">חניכים</span>
              <span className="font-medium">{participantCount}</span>
            </div>
          )}
        </div>
        {(workshops.length > 0 || lectures.length > 0 || coffeeEnabled) && (
          <div className="border-t border-slate-100 pt-2 space-y-1">
            {workshops.map((w, i) => <div key={i} className="text-xs text-slate-500 flex items-center gap-1"><BookOpen className="w-3 h-3" />{w.name}</div>)}
            {lectures.map((l, i) => <div key={i} className="text-xs text-slate-500 flex items-center gap-1"><Mic2 className="w-3 h-3" />{l.name}</div>)}
            {coffeeEnabled && <div className="text-xs text-slate-500 flex items-center gap-1"><Coffee className="w-3 h-3" />פינת קפה</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function PricingCard({ subtotal, discountAmount, discountPct, totalPrice, advance, balance }) {
  const hasDiscount = discountAmount > 0;
  return (
    <div className={`${CARD} p-4 border-primary/20`}>
      <div className={SEC_TITLE}><Tag className="w-4 h-4 text-primary" />תמחור חי</div>
      <div className="space-y-2 text-sm">
        {hasDiscount && (
          <div className="flex justify-between text-slate-500">
            <span>סכום לפני הנחה</span>
            <span>{fmtMoney(subtotal)}</span>
          </div>
        )}
        {hasDiscount && (
          <div className="flex justify-between text-red-500">
            <span>הנחה {discountPct}%</span>
            <span>−{fmtMoney(discountAmount)}</span>
          </div>
        )}
        {!hasDiscount && (
          <div className="flex justify-between text-slate-500">
            <span>סכום ביניים</span>
            <span>{fmtMoney(subtotal)}</span>
          </div>
        )}

        {/* Big total */}
        <div className="bg-primary rounded-xl px-4 py-3 flex justify-between items-center">
          <span className="text-white font-semibold text-sm">סה״כ לתשלום</span>
          <span className="text-white font-bold text-lg">{fmtMoney(totalPrice)}</span>
        </div>

        <div className="border-t border-slate-100 pt-2 space-y-1.5">
          <div className="flex justify-between text-slate-500 text-xs">
            <span>מקדמה 30%</span>
            <span className="font-medium text-slate-700">{fmtMoney(advance)}</span>
          </div>
          <div className="flex justify-between text-slate-500 text-xs">
            <span>יתרה 70%</span>
            <span className="font-medium text-slate-700">{fmtMoney(balance)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function QuoteFormModal({ quote, group, onClose, onSaved }) {
  const isEdit = !!quote;
  const isNewGroupFlow = !group;
  const groupType = group?.group_type || "LODGING";
  const navigate = useNavigate();

  const [groupForm, setGroupForm] = useState({
    group_name: "", group_type: "LODGING",
    contact_name: "", contact_phone: "", contact_email: "", client_tax_id: "",
  });
  const setGroupField = (k, v) => setGroupForm(f => ({ ...f, [k]: v }));

  const handleGroupContactChange = (k, v) => {
    setGroupField(k, v);
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
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const [coffeeEnabled, setCoffeeEnabled] = useState(quote ? (quote.coffee_corner_pax > 0) : false);

  const initArrival    = quote?.arrival_date    || group?.arrival_date    || "";
  const initDeparture  = quote?.departure_date  || group?.departure_date  || "";
  const initNights     = calcNights(initArrival, initDeparture) || 1; // default 1 for row init
  const initEstPax     = Number(quote?.estimated_pax ?? group?.total_pax    ?? 0);
  const initStaff      = Number(quote?.staff_count   ?? group?.staff_count  ?? 0);
  const initParticipants = Math.max(0, initEstPax - initStaff);
  const initRateType   = suggestLodgingRateType(initArrival, group?.group_type || "LODGING");

  const initStudentLodging = () => {
    const saved = parse(quote?.student_lodging_lines, null);
    if (saved !== null) return saved;
    if (initParticipants === 0 && initNights === 1) return [];
    const isDay = initRateType === "day_activity";
    return [{ rate_type: initRateType, pax: initParticipants, nights: isDay ? 1 : initNights }];
  };

  const [studentLodging, setStudentLodging] = useState(initStudentLodging);
  const [adultLodging,   setAdultLodging]   = useState(parse(quote?.adult_lodging_lines, []));
  const [workshops,      setWorkshops]      = useState(parse(quote?.workshop_lines,       []));
  const [lectures,       setLectures]       = useState(parse(quote?.lecture_lines,        []));
  const [addons,         setAddons]         = useState(parse(quote?.addon_lines,          []));
  const [adjustments,    setAdjustments]    = useState(parse(quote?.adjustment_lines,     []));
  const [saving, setSaving] = useState(false);

  // ── Live calcs ──────────────────────────────────────────────────────────────
  const estimatedPax     = Number(form.estimated_pax || 0);
  const staffCount       = Number(form.staff_count   || 0);
  const participantCount = Math.max(0, estimatedPax - staffCount);
  const nights           = calcNights(form.arrival_date, form.departure_date);
  const suggestedRateType = suggestLodgingRateType(form.arrival_date, groupType);
  const coffeeTotal      = coffeeEnabled && staffCount > 0 ? staffCount * COFFEE_CORNER_RATE : 0;

  const studentLodgingTotal = studentLodging.reduce((s, r) => s + calcStudentLodging(r), 0);
  const adultLodgingTotal   = adultLodging.reduce((s, r) => s + calcAdultLodging(r), 0);
  const workshopTotal       = workshops.reduce((s, r) => s + calcWorkshop(r), 0);
  const lectureTotal        = lectures.reduce((s, r) => s + calcLecture(r), 0);
  const addonTotal          = addons.reduce((s, r) => s + calcAddon(r), 0);
  const adjustmentTotal     = adjustments.reduce((s, r) => s + Number(r.amount || 0), 0);
  const subtotal            = studentLodgingTotal + adultLodgingTotal + workshopTotal + lectureTotal + coffeeTotal + addonTotal + adjustmentTotal;
  const discountAmount      = Math.round(subtotal * Number(form.discount_percent || 0) / 100);
  const total_price         = subtotal - discountAmount;
  const advance             = Math.round(total_price * 0.3);
  const balance             = total_price - advance;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    let resolvedGroupId = group?.id;
    if (isNewGroupFlow) {
      const totalPax = Number(form.estimated_pax || 0);
      const staffPax = Number(form.staff_count   || 0);
      const newGroup = await base44.entities.Group.create({
        group_name: groupForm.group_name, group_type: groupForm.group_type,
        arrival_date: form.arrival_date || undefined, departure_date: form.departure_date || undefined,
        total_pax: totalPax || undefined, staff_count: staffPax || undefined,
        participant_count: Math.max(0, totalPax - staffPax) || undefined,
        contact_name: groupForm.contact_name || undefined, contact_phone: groupForm.contact_phone || undefined,
        contact_email: groupForm.contact_email || undefined, status: "DRAFT",
      });
      resolvedGroupId = newGroup.id;
    }
    const quotePayload = {
      ...form, group_id: resolvedGroupId,
      student_lodging_lines: JSON.stringify(studentLodging),
      adult_lodging_lines:   JSON.stringify(adultLodging),
      workshop_lines:        JSON.stringify(workshops),
      lecture_lines:         JSON.stringify(lectures),
      addon_lines:           JSON.stringify(addons),
      adjustment_lines:      JSON.stringify(adjustments),
      subtotal, discount_amount: discountAmount, total_price,
      advance_payment: advance, balance_payment: balance,
      version: Number(form.version), estimated_pax: estimatedPax || undefined,
      staff_count: staffCount || undefined, participant_count: participantCount || undefined,
      coffee_corner_pax: coffeeEnabled ? staffCount : 0,
      discount_percent: Number(form.discount_percent || 0),
    };
    if (isEdit) await base44.entities.Quote.update(quote.id, quotePayload);
    else await base44.entities.Quote.create(quotePayload);
    setSaving(false);
    if (isNewGroupFlow && resolvedGroupId) { navigate(`/groups/${resolvedGroupId}`); onClose(); }
    else onSaved();
  };

  const groupNameDisplay = isNewGroupFlow ? (groupForm.group_name || form.client_name) : (group?.group_name || form.client_name);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        className="max-w-[95vw] w-[1100px] max-h-[95vh] overflow-hidden p-0"
        dir="rtl"
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <DialogTitle className="text-base font-bold text-slate-800">
            {isEdit ? "עריכת הצעת מחיר" : isNewGroupFlow ? "הצעת מחיר — לקוח חדש" : "הצעת מחיר חדשה"}
          </DialogTitle>
          <div className="flex items-center gap-2 text-sm">
            {form.quote_number && <span className="text-slate-400 font-mono">{form.quote_number}</span>}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              form.status === "APPROVED" ? "bg-green-100 text-green-700" :
              form.status === "SENT"     ? "bg-blue-100 text-blue-700" :
              form.status === "REJECTED" ? "bg-red-100 text-red-700" :
              "bg-slate-100 text-slate-600"
            }`}>{form.status}</span>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex overflow-hidden" style={{ height: "calc(95vh - 65px)" }}>

          {/* ── Left: scrollable form ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <form id="quote-form" onSubmit={handleSubmit} className="space-y-4">

              {/* Group shell (new-group flow) */}
              {isNewGroupFlow && (
                <SectionCard icon={Users} title="פרטי קבוצה" subtitle="חדש">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-slate-500">שם קבוצה / ארגון *</Label>
                      <Input required value={groupForm.group_name} onChange={e => setGroupField("group_name", e.target.value)} placeholder="שם בית הספר / הארגון" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">סוג</Label>
                      <Select value={groupForm.group_type} onValueChange={v => setGroupField("group_type", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="LODGING">לינה</SelectItem><SelectItem value="DAY_USE">יום כיף</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">ח.פ / ע.מ</Label>
                      <Input value={groupForm.client_tax_id} onChange={e => handleGroupContactChange("client_tax_id", e.target.value)} placeholder="מספר חברה / עוסק" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">שם איש קשר</Label>
                      <Input value={groupForm.contact_name} onChange={e => handleGroupContactChange("contact_name", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">טלפון</Label>
                      <Input value={groupForm.contact_phone} onChange={e => handleGroupContactChange("contact_phone", e.target.value)} />
                    </div>
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs text-slate-500">אימייל</Label>
                      <Input type="email" value={groupForm.contact_email} onChange={e => handleGroupContactChange("contact_email", e.target.value)} />
                    </div>
                  </div>
                </SectionCard>
              )}

              {/* Quote meta */}
              <SectionCard icon={SlidersHorizontal} title="פרטי הצעה" defaultOpen={true}>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">מספר הצעה</Label>
                    <Input value={form.quote_number} onChange={e => set("quote_number", e.target.value)} placeholder="Q-2026-001" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">גרסה</Label>
                    <Input type="number" min="1" value={form.version} onChange={e => set("version", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">סטטוס</Label>
                    <Select value={form.status} onValueChange={v => set("status", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["DRAFT","SENT","APPROVED","REJECTED","EXPIRED"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {groupType === "DAY_USE" ? (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">תאריך פעילות</Label>
                        <Input type="date" value={form.arrival_date} onChange={e => { set("arrival_date", e.target.value); set("departure_date", e.target.value); }} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">בתוקף עד</Label>
                        <Input type="date" value={form.valid_until} onChange={e => set("valid_until", e.target.value)} />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">תאריך הגעה</Label>
                        <Input type="date" value={form.arrival_date} onChange={e => set("arrival_date", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">תאריך עזיבה</Label>
                        <Input type="date" value={form.departure_date} onChange={e => set("departure_date", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">בתוקף עד</Label>
                        <Input type="date" value={form.valid_until} onChange={e => set("valid_until", e.target.value)} />
                      </div>
                    </>
                  )}
                </div>

                {/* Client fields */}
                <div className="border-t border-slate-100 pt-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">שם לקוח / ארגון</Label>
                    <Input value={form.client_name} onChange={e => set("client_name", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">ח.פ / ע.מ</Label>
                    <Input value={form.client_tax_id} onChange={e => set("client_tax_id", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">טלפון</Label>
                    <Input value={form.client_phone} onChange={e => set("client_phone", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">אימייל</Label>
                    <Input type="email" value={form.client_email} onChange={e => set("client_email", e.target.value)} />
                  </div>
                </div>

                {/* Headcounts */}
                <div className="border-t border-slate-100 pt-3 grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">סה״כ משתתפים</Label>
                    <Input type="number" min="0" value={form.estimated_pax} onChange={e => set("estimated_pax", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">צוות</Label>
                    <Input type="number" min="0" value={form.staff_count} onChange={e => set("staff_count", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">חניכים (מחושב)</Label>
                    <div className="h-9 flex items-center px-3 rounded-md border bg-primary/5 text-sm font-semibold text-primary">{participantCount}</div>
                  </div>
                </div>
              </SectionCard>

              {/* Pricing sections */}
              <SectionCard icon={CalendarDays} title="לינה — תלמידים"
                subtitle={suggestedRateType === "weekend_lodging" ? "סוף שבוע" : groupType === "DAY_USE" ? "יום פעילות" : "אמצע שבוע"}>
                <StudentLodgingSection lines={studentLodging} setLines={setStudentLodging}
                  suggestedRateType={suggestedRateType} groupType={groupType}
                  defaultPax={participantCount} defaultNights={nights} />
              </SectionCard>

              <SectionCard icon={Users} title="לינה — מבוגרים" subtitle="מחיר לאוהל ללילה" defaultOpen={adultLodging.length > 0}>
                <AdultLodgingSection lines={adultLodging} setLines={setAdultLodging} defaultNights={nights} adultsCount={staffCount} />
              </SectionCard>

              <SectionCard icon={BookOpen} title="סדנאות" defaultOpen={workshops.length > 0}>
                <WorkshopSection lines={workshops} setLines={setWorkshops} />
              </SectionCard>

              <SectionCard icon={Mic2} title="הרצאות" defaultOpen={lectures.length > 0}>
                <LectureSection lines={lectures} setLines={setLectures} />
              </SectionCard>

              {/* Coffee */}
              <SectionCard icon={Coffee} title="פינת קפה" subtitle={`₪${COFFEE_CORNER_RATE} לאיש צוות`} defaultOpen={coffeeEnabled}>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={coffeeEnabled} onChange={e => setCoffeeEnabled(e.target.checked)} className="w-4 h-4 accent-primary" />
                  <span className="text-sm">כלול פינת קפה</span>
                </label>
                {coffeeEnabled && staffCount > 0 && (
                  <div className="text-sm text-slate-500 mt-1">{staffCount} אנשי צוות × ₪{COFFEE_CORNER_RATE} = <span className="font-semibold text-slate-700">₪{coffeeTotal.toLocaleString()}</span></div>
                )}
                {coffeeEnabled && staffCount === 0 && <p className="text-xs text-amber-600">הזן מספר אנשי צוות לחישוב</p>}
              </SectionCard>

              <SectionCard icon={Tag} title="תוספות חופשיות" defaultOpen={addons.length > 0}>
                <AddonSection lines={addons} setLines={setAddons} />
              </SectionCard>

              <SectionCard icon={SlidersHorizontal} title="התאמות / הנחות" defaultOpen={adjustments.length > 0}>
                <AdjustmentSection lines={adjustments} setLines={setAdjustments} />
              </SectionCard>

              {/* Discount + payment terms */}
              <div className={`${CARD} px-5 py-4`}>
                <div className={SEC_TITLE}><Tag className="w-4 h-4 text-primary" />הנחה ותנאי תשלום</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">הנחה (%)</Label>
                    <Input type="number" min="0" max="100" value={form.discount_percent} onChange={e => set("discount_percent", e.target.value)} />
                    {discountAmount > 0 && <div className="text-xs text-red-500">−{fmtMoney(discountAmount)}</div>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">תנאי תשלום</Label>
                    <Input value={form.payment_terms} onChange={e => set("payment_terms", e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Internal notes */}
              <div className={`${CARD} px-5 py-4`}>
                <Label className="text-xs text-slate-500 mb-1 block">הערות פנימיות</Label>
                <Textarea rows={2} value={form.internal_notes} onChange={e => set("internal_notes", e.target.value)} className="text-sm" />
              </div>

            </form>
          </div>

          {/* ── Right: sticky sidebar ── */}
          <div className="w-72 flex-shrink-0 bg-slate-50 border-r border-slate-200 overflow-y-auto px-4 py-5 space-y-4">

            <CalendarCard arrival={form.arrival_date} departure={form.departure_date} nights={nights} isDayUse={groupType === "DAY_USE"} />

            <SummaryCard
              groupName={groupNameDisplay}
              activityType={STUDENT_LODGING_RATES[suggestedRateType]?.label}
              totalPax={estimatedPax}
              staffCount={staffCount}
              participantCount={participantCount}
              workshops={workshops}
              lectures={lectures}
              coffeeEnabled={coffeeEnabled}
            />

            <PricingCard
              subtotal={subtotal}
              discountAmount={discountAmount}
              discountPct={form.discount_percent}
              totalPrice={total_price}
              advance={advance}
              balance={balance}
            />

            {/* Breakdown mini */}
            {subtotal > 0 && (
              <div className={`${CARD} px-4 py-3`}>
                <div className="text-xs font-semibold text-slate-500 mb-2">פירוט</div>
                <div className="space-y-1 text-xs text-slate-500">
                  {studentLodgingTotal > 0 && <div className="flex justify-between"><span>לינה תלמידים</span><span className="font-medium text-slate-700">{fmtMoney(studentLodgingTotal)}</span></div>}
                  {adultLodgingTotal   > 0 && <div className="flex justify-between"><span>לינה מבוגרים</span><span className="font-medium text-slate-700">{fmtMoney(adultLodgingTotal)}</span></div>}
                  {workshopTotal       > 0 && <div className="flex justify-between"><span>סדנאות</span><span className="font-medium text-slate-700">{fmtMoney(workshopTotal)}</span></div>}
                  {lectureTotal        > 0 && <div className="flex justify-between"><span>הרצאות</span><span className="font-medium text-slate-700">{fmtMoney(lectureTotal)}</span></div>}
                  {coffeeTotal         > 0 && <div className="flex justify-between"><span>פינת קפה</span><span className="font-medium text-slate-700">{fmtMoney(coffeeTotal)}</span></div>}
                  {(addonTotal + adjustmentTotal) !== 0 && <div className="flex justify-between"><span>תוספות</span><span className="font-medium text-slate-700">{fmtMoney(addonTotal + adjustmentTotal)}</span></div>}
                </div>
              </div>
            )}

            {/* Save button */}
            <Button
              type="submit"
              form="quote-form"
              disabled={saving}
              className="w-full h-11 text-sm font-semibold"
            >
              {saving ? "שומר..." : isEdit ? "שמור הצעת מחיר" : "צור הצעת מחיר"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="w-full text-sm">
              ביטול
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}