import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function GuestForm() {
  const urlParams = new URLSearchParams(window.location.search);
  const quoteId = urlParams.get("quote") || urlParams.get("q");

  const [quoteData, setQuoteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    total_pax: "",
    staff_count: "",
    boys_count: "",
    girls_count: "",
    special_diets: "",
    tent_distribution_notes: "",
    schedule_notes: "",
    general_notes: "",
  });

  useEffect(() => {
    if (!quoteId) {
      setError("קישור לא תקין");
      setLoading(false);
      return;
    }
    base44.functions.invoke("getQuotePublicData", { quote_id: quoteId })
      .then(res => {
        const data = res.data;
        setQuoteData(data);
        setForm(f => ({
          ...f,
          contact_name: data.client_name || "",
          contact_phone: data.client_phone || "",
          contact_email: data.client_email || "",
          total_pax: data.estimated_pax || "",
          staff_count: data.staff_count || "",
        }));
      })
      .catch(() => setError("הצעת המחיר אינה זמינה"))
      .finally(() => setLoading(false));
  }, [quoteId]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await base44.functions.invoke("submitGuestForm", {
      quote_id: quoteId,
      group_id: quoteData.group_id,
      ...form,
      total_pax: Number(form.total_pax) || undefined,
      staff_count: Number(form.staff_count) || undefined,
      boys_count: Number(form.boys_count) || undefined,
      girls_count: Number(form.girls_count) || undefined,
    });
    setSubmitted(true);
    setSubmitting(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" dir="rtl">
      <div className="text-center space-y-2">
        <p className="text-xl font-semibold text-destructive">{error}</p>
        <p className="text-muted-foreground text-sm">אנא פנו אלינו לקבלת קישור תקין.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center" dir="rtl">
      <div className="text-center space-y-3">
        <div className="text-5xl">✅</div>
        <p className="text-xl font-bold">תודה! הפרטים התקבלו בהצלחה.</p>
        <p className="text-muted-foreground text-sm">נחזור אליכם בהקדם.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background py-10 px-4" dir="rtl">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">טופס פרטי קבוצה</h1>
          {quoteData?.quote_number && (
            <p className="text-sm text-muted-foreground">הצעה מס׳ {quoteData.quote_number}</p>
          )}
          {quoteData?.arrival_date && (
            <p className="text-sm text-muted-foreground">
              הגעה: {quoteData.arrival_date}
              {quoteData.departure_date && ` — עזיבה: ${quoteData.departure_date}`}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card border border-border rounded-xl p-6">

          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">פרטי איש קשר</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>שם מלא *</Label>
              <Input required value={form.contact_name} onChange={e => set("contact_name", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>טלפון *</Label>
              <Input required value={form.contact_phone} onChange={e => set("contact_phone", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>אימייל</Label>
              <Input type="email" value={form.contact_email} onChange={e => set("contact_email", e.target.value)} />
            </div>
          </div>

          <hr />

          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">הרכב הקבוצה</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>סה"כ משתתפים</Label>
              <Input type="number" min="0" value={form.total_pax} onChange={e => set("total_pax", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>צוות</Label>
              <Input type="number" min="0" value={form.staff_count} onChange={e => set("staff_count", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>חניכים (מחושב)</Label>
              <div className="h-9 flex items-center px-3 rounded-md border bg-muted/40 text-sm font-medium">
                {Math.max(0, Number(form.total_pax || 0) - Number(form.staff_count || 0))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>בנים</Label>
              <Input type="number" min="0" value={form.boys_count} onChange={e => set("boys_count", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>בנות</Label>
              <Input type="number" min="0" value={form.girls_count} onChange={e => set("girls_count", e.target.value)} />
            </div>
          </div>

          <hr />

          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">פרטים נוספים</p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>דיאטות מיוחדות / אלרגיות</Label>
              <Textarea rows={2} value={form.special_diets} onChange={e => set("special_diets", e.target.value)} placeholder="צליאק, אלרגיה לאגוזים וכו׳..." />
            </div>
            <div className="space-y-1">
              <Label>הערות חלוקת אוהלים</Label>
              <Textarea rows={2} value={form.tent_distribution_notes} onChange={e => set("tent_distribution_notes", e.target.value)} placeholder="בנים/בנות נפרד, דרישות מיוחדות..." />
            </div>
            <div className="space-y-1">
              <Label>הערות לוח זמנים</Label>
              <Textarea rows={2} value={form.schedule_notes} onChange={e => set("schedule_notes", e.target.value)} placeholder="שעת הגעה משוערת, בקשות לוח זמנים..." />
            </div>
            <div className="space-y-1">
              <Label>הערות כלליות</Label>
              <Textarea rows={3} value={form.general_notes} onChange={e => set("general_notes", e.target.value)} />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "שולח..." : "שליחת פרטים"}
          </Button>
        </form>
      </div>
    </div>
  );
}