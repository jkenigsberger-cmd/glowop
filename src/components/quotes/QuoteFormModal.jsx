import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

// ── helpers ──────────────────────────────────────────────────────────────────
const parse = (str, fallback) => { try { return JSON.parse(str); } catch { return fallback; } };
const emptyLodging  = () => ({ type: "STANDARD", pax: 0, nights: 1, rate_per_person_per_night: 0, total: 0 });
const emptyActivity = () => ({ name: "", pax: 0, rate_per_person: 0, fixed_price: null, total: 0 });
const emptyCatering = () => ({ type: "MEAL", pax: 0, count: 1, rate: 0, notes: "", total: 0 });
const emptyAddon    = () => ({ description: "", quantity: 1, unit_price: 0, total: 0 });

const calcLodging  = (r) => Number(r.pax) * Number(r.nights) * Number(r.rate_per_person_per_night);
const calcActivity = (r) => r.fixed_price !== null && r.fixed_price !== "" ? Number(r.fixed_price) : Number(r.pax) * Number(r.rate_per_person);
const calcCatering = (r) => Number(r.pax) * Number(r.count) * Number(r.rate);
const calcAddon    = (r) => Number(r.quantity) * Number(r.unit_price);

const CATERING_LABELS = {
  MEAL: "ארוחה",
  COFFEE_STANDARD: "קפה סטנדרטי",
  COFFEE_UPGRADED: "קפה משודרג",
  COFFEE_CORNER: "פינת קפה",
};

// ── section sub-components ────────────────────────────────────────────────────
function SectionHeader({ title }) {
  return <div className="font-semibold text-sm text-primary border-b border-primary/20 pb-1 mb-2">{title}</div>;
}

function LodgingSection({ lines, setLines }) {
  const update = (idx, field, val) => {
    setLines(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const u = { ...r, [field]: val };
      u.total = calcLodging(u);
      return u;
    }));
  };
  return (
    <div className="space-y-2">
      <SectionHeader title="לינה" />
      {lines.map((r, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs">
          <Select value={r.type} onValueChange={v => update(idx, "type", v)}>
            <SelectTrigger className="col-span-3 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="STANDARD">סטנדרטי</SelectItem>
              <SelectItem value="VIP">VIP</SelectItem>
            </SelectContent>
          </Select>
          <div className="col-span-2 space-y-0.5">
            <div className="text-muted-foreground text-[10px]">משתתפים</div>
            <Input className="h-8 text-xs" type="number" min="0" value={r.pax} onChange={e => update(idx, "pax", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-0.5">
            <div className="text-muted-foreground text-[10px]">לילות</div>
            <Input className="h-8 text-xs" type="number" min="1" value={r.nights} onChange={e => update(idx, "nights", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-0.5">
            <div className="text-muted-foreground text-[10px]">₪ לאדם/לילה</div>
            <Input className="h-8 text-xs" type="number" min="0" value={r.rate_per_person_per_night} onChange={e => update(idx, "rate_per_person_per_night", e.target.value)} />
          </div>
          <div className="col-span-2 text-left font-medium text-xs text-muted-foreground pt-3">
            ₪{calcLodging(r).toLocaleString()}
          </div>
          <button type="button" onClick={() => setLines(p => p.filter((_, i) => i !== idx))} className="col-span-1 text-muted-foreground hover:text-red-500 pt-3">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, emptyLodging()])} className="gap-1 text-xs h-7">
        <Plus className="w-3 h-3" /> הוסף שורת לינה
      </Button>
    </div>
  );
}

function ActivitySection({ lines, setLines }) {
  const update = (idx, field, val) => {
    setLines(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const u = { ...r, [field]: field === "fixed_price" && val === "" ? null : val };
      u.total = calcActivity(u);
      return u;
    }));
  };
  return (
    <div className="space-y-2">
      <SectionHeader title="פעילויות / הרצאות / סדנאות" />
      {lines.map((r, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs">
          <Input className="col-span-4 h-8 text-xs" placeholder="שם הפעילות" value={r.name} onChange={e => update(idx, "name", e.target.value)} />
          <div className="col-span-2 space-y-0.5">
            <div className="text-muted-foreground text-[10px]">משתתפים</div>
            <Input className="h-8 text-xs" type="number" min="0" value={r.pax} onChange={e => update(idx, "pax", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-0.5">
            <div className="text-muted-foreground text-[10px]">₪ לאדם</div>
            <Input className="h-8 text-xs" type="number" min="0" value={r.rate_per_person} onChange={e => update(idx, "rate_per_person", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-0.5">
            <div className="text-muted-foreground text-[10px]">מחיר קבוע</div>
            <Input className="h-8 text-xs" type="number" min="0" placeholder="—" value={r.fixed_price ?? ""} onChange={e => update(idx, "fixed_price", e.target.value)} />
          </div>
          <div className="col-span-1 text-left font-medium text-xs text-muted-foreground pt-3">
            ₪{calcActivity(r).toLocaleString()}
          </div>
          <button type="button" onClick={() => setLines(p => p.filter((_, i) => i !== idx))} className="col-span-1 text-muted-foreground hover:text-red-500 pt-3">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, emptyActivity()])} className="gap-1 text-xs h-7">
        <Plus className="w-3 h-3" /> הוסף פעילות
      </Button>
    </div>
  );
}

function CateringSection({ lines, setLines }) {
  const update = (idx, field, val) => {
    setLines(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const u = { ...r, [field]: val };
      u.total = calcCatering(u);
      return u;
    }));
  };
  return (
    <div className="space-y-2">
      <SectionHeader title="קייטרינג / קפה" />
      {lines.map((r, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs">
          <Select value={r.type} onValueChange={v => update(idx, "type", v)}>
            <SelectTrigger className="col-span-3 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CATERING_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="col-span-2 space-y-0.5">
            <div className="text-muted-foreground text-[10px]">משתתפים</div>
            <Input className="h-8 text-xs" type="number" min="0" value={r.pax} onChange={e => update(idx, "pax", e.target.value)} />
          </div>
          <div className="col-span-1 space-y-0.5">
            <div className="text-muted-foreground text-[10px]">פעמים</div>
            <Input className="h-8 text-xs" type="number" min="1" value={r.count} onChange={e => update(idx, "count", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-0.5">
            <div className="text-muted-foreground text-[10px]">₪ לאדם/פעם</div>
            <Input className="h-8 text-xs" type="number" min="0" value={r.rate} onChange={e => update(idx, "rate", e.target.value)} />
          </div>
          <Input className="col-span-2 h-8 text-xs" placeholder="הערה" value={r.notes} onChange={e => update(idx, "notes", e.target.value)} />
          <div className="col-span-1 text-left font-medium text-xs text-muted-foreground pt-0">
            ₪{calcCatering(r).toLocaleString()}
          </div>
          <button type="button" onClick={() => setLines(p => p.filter((_, i) => i !== idx))} className="col-span-1 text-muted-foreground hover:text-red-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, emptyCatering()])} className="gap-1 text-xs h-7">
        <Plus className="w-3 h-3" /> הוסף שורת קייטרינג
      </Button>
    </div>
  );
}

function AddonSection({ lines, setLines }) {
  const update = (idx, field, val) => {
    setLines(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const u = { ...r, [field]: val };
      u.total = calcAddon(u);
      return u;
    }));
  };
  return (
    <div className="space-y-2">
      <SectionHeader title="תוספות / התאמות" />
      {lines.map((r, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-center text-xs">
          <Input className="col-span-5 h-8 text-xs" placeholder="תיאור" value={r.description} onChange={e => update(idx, "description", e.target.value)} />
          <div className="col-span-2 space-y-0.5">
            <div className="text-muted-foreground text-[10px]">כמות</div>
            <Input className="h-8 text-xs" type="number" min="0" value={r.quantity} onChange={e => update(idx, "quantity", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-0.5">
            <div className="text-muted-foreground text-[10px]">מחיר יחידה</div>
            <Input className="h-8 text-xs" type="number" min="0" value={r.unit_price} onChange={e => update(idx, "unit_price", e.target.value)} />
          </div>
          <div className="col-span-2 text-left font-medium text-xs text-muted-foreground pt-3">
            ₪{calcAddon(r).toLocaleString()}
          </div>
          <button type="button" onClick={() => setLines(p => p.filter((_, i) => i !== idx))} className="col-span-1 text-muted-foreground hover:text-red-500 pt-3">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setLines(p => [...p, emptyAddon()])} className="gap-1 text-xs h-7">
        <Plus className="w-3 h-3" /> הוסף תוספת
      </Button>
    </div>
  );
}

// ── main modal ────────────────────────────────────────────────────────────────
export default function QuoteFormModal({ quote, group, onClose, onSaved }) {
  const isEdit = !!quote;

  const [form, setForm] = useState({
    quote_number: quote?.quote_number || "",
    version: quote?.version || 1,
    status: quote?.status || "DRAFT",
    client_name: quote?.client_name || group?.contact_name || "",
    client_phone: quote?.client_phone || group?.contact_phone || "",
    client_email: quote?.client_email || group?.contact_email || "",
    arrival_date: quote?.arrival_date || group?.arrival_date || "",
    departure_date: quote?.departure_date || group?.departure_date || "",
    estimated_pax: quote?.estimated_pax || group?.total_pax || "",
    staff_count: quote?.staff_count || group?.staff_count || "",
    participant_count: quote?.participant_count || group?.participant_count || "",
    discount_amount: quote?.discount_amount || 0,
    discount_reason: quote?.discount_reason || "",
    payment_terms: quote?.payment_terms || "",
    valid_until: quote?.valid_until || "",
    internal_notes: quote?.internal_notes || "",
  });

  const [lodging,   setLodging]   = useState(parse(quote?.lodging_lines,  []));
  const [activity,  setActivity]  = useState(parse(quote?.activity_lines, []));
  const [catering,  setCatering]  = useState(parse(quote?.catering_lines, []));
  const [addons,    setAddons]    = useState(parse(quote?.addon_lines,    []));
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const lodgingTotal  = lodging.reduce((s, r)  => s + calcLodging(r),  0);
  const activityTotal = activity.reduce((s, r) => s + calcActivity(r), 0);
  const cateringTotal = catering.reduce((s, r) => s + calcCatering(r), 0);
  const addonTotal    = addons.reduce((s, r)   => s + calcAddon(r),    0);
  const subtotal      = lodgingTotal + activityTotal + cateringTotal + addonTotal;
  const total_price   = subtotal - Number(form.discount_amount || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      group_id: group.id,
      lodging_lines:  JSON.stringify(lodging),
      activity_lines: JSON.stringify(activity),
      catering_lines: JSON.stringify(catering),
      addon_lines:    JSON.stringify(addons),
      subtotal,
      total_price,
      discount_amount: Number(form.discount_amount || 0),
      version: Number(form.version),
      estimated_pax: form.estimated_pax !== "" ? Number(form.estimated_pax) : undefined,
      staff_count: form.staff_count !== "" ? Number(form.staff_count) : undefined,
      participant_count: form.participant_count !== "" ? Number(form.participant_count) : undefined,
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

          {/* Header */}
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
              <Label>בתוקף עד</Label>
              <Input type="date" value={form.valid_until} onChange={e => set("valid_until", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>תאריך הגעה</Label>
              <Input type="date" value={form.arrival_date} onChange={e => set("arrival_date", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>תאריך עזיבה</Label>
              <Input type="date" value={form.departure_date} onChange={e => set("departure_date", e.target.value)} />
            </div>
          </div>

          {/* Client */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>שם לקוח / ארגון</Label>
              <Input value={form.client_name} onChange={e => set("client_name", e.target.value)} />
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

          {/* Headcounts */}
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
              <Label>חניכים</Label>
              <Input type="number" min="0" value={form.participant_count} onChange={e => set("participant_count", e.target.value)} />
            </div>
          </div>

          {/* Pricing sections */}
          <LodgingSection  lines={lodging}  setLines={setLodging} />
          <ActivitySection lines={activity} setLines={setActivity} />
          <CateringSection lines={catering} setLines={setCatering} />
          <AddonSection    lines={addons}   setLines={setAddons} />

          {/* Summary */}
          <div className="border-t pt-4 space-y-3">
            <div className="grid grid-cols-4 gap-3 text-xs text-muted-foreground">
              <div>לינה: <span className="font-medium text-foreground">₪{lodgingTotal.toLocaleString()}</span></div>
              <div>פעילויות: <span className="font-medium text-foreground">₪{activityTotal.toLocaleString()}</span></div>
              <div>קייטרינג: <span className="font-medium text-foreground">₪{cateringTotal.toLocaleString()}</span></div>
              <div>תוספות: <span className="font-medium text-foreground">₪{addonTotal.toLocaleString()}</span></div>
            </div>
            <div className="grid grid-cols-3 gap-3 items-end">
              <div className="space-y-1">
                <Label>סכום ביניים</Label>
                <div className="text-base font-semibold">₪{subtotal.toLocaleString()}</div>
              </div>
              <div className="space-y-1">
                <Label>הנחה (₪)</Label>
                <Input type="number" min="0" value={form.discount_amount} onChange={e => set("discount_amount", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>סה"כ לתשלום</Label>
                <div className="text-lg font-bold text-primary">₪{total_price.toLocaleString()}</div>
              </div>
            </div>
            <div className="space-y-1">
              <Label>סיבת הנחה</Label>
              <Input value={form.discount_reason} onChange={e => set("discount_reason", e.target.value)} />
            </div>
          </div>

          {/* Footer fields */}
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