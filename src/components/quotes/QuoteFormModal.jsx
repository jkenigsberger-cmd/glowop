import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

const emptyItem = () => ({ description: "", quantity: 1, unit_price: 0, total: 0 });

export default function QuoteFormModal({ quote, group, onClose, onSaved }) {
  const isEdit = !!quote;

  const parseItems = (q) => {
    if (!q?.line_items) return [emptyItem()];
    try { return JSON.parse(q.line_items); } catch { return [emptyItem()]; }
  };

  const [form, setForm] = useState({
    status: quote?.status || "DRAFT",
    version: quote?.version || 1,
    client_details: quote?.client_details || group?.contact_name || "",
    payment_terms: quote?.payment_terms || "",
    valid_until: quote?.valid_until || "",
    includes_meals: quote?.includes_meals ?? false,
    includes_activities: quote?.includes_activities ?? false,
    discount: quote?.discount || 0,
    internal_notes: quote?.internal_notes || "",
  });
  const [items, setItems] = useState(parseItems(quote));
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const updateItem = (idx, field, val) => {
    setItems(prev => {
      const next = prev.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, [field]: val };
        updated.total = Number(updated.quantity) * Number(updated.unit_price);
        return updated;
      });
      return next;
    });
  };

  const subtotal = items.reduce((s, it) => s + (Number(it.total) || 0), 0);
  const total_price = subtotal - Number(form.discount || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const snapshot = JSON.stringify({ group_name: group?.group_name, arrival_date: group?.arrival_date, departure_date: group?.departure_date, total_pax: group?.total_pax });
    const payload = {
      ...form,
      group_id: group.id,
      line_items: JSON.stringify(items),
      subtotal,
      total_price,
      discount: Number(form.discount || 0),
      version: Number(form.version),
      snapshot,
    };
    if (isEdit) await base44.entities.Quote.update(quote.id, payload);
    else await base44.entities.Quote.create(payload);
    setSaving(false);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">{isEdit ? "עריכת הצעת מחיר" : "הצעת מחיר חדשה"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 text-sm">
          <div className="grid grid-cols-3 gap-3">
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
              <Label>גרסה</Label>
              <Input type="number" min="1" value={form.version} onChange={e => set("version", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>בתוקף עד</Label>
              <Input type="date" value={form.valid_until} onChange={e => set("valid_until", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>פרטי לקוח (snapshot)</Label>
            <Input value={form.client_details} onChange={e => set("client_details", e.target.value)} />
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <Label>סעיפי מחיר</Label>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-5" placeholder="תיאור" value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} />
                  <Input className="col-span-2" type="number" min="0" placeholder="כמות" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} />
                  <Input className="col-span-2" type="number" min="0" placeholder="מחיר ליח'" value={item.unit_price} onChange={e => updateItem(idx, "unit_price", e.target.value)} />
                  <div className="col-span-2 text-left font-medium text-xs text-muted-foreground">
                    ₪{(Number(item.quantity) * Number(item.unit_price)).toLocaleString()}
                  </div>
                  <button type="button" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="col-span-1 text-muted-foreground hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setItems(prev => [...prev, emptyItem()])} className="gap-1">
              <Plus className="w-3 h-3" /> הוסף סעיף
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t pt-3">
            <div className="space-y-1">
              <Label>סכום ביניים</Label>
              <div className="text-base font-semibold">₪{subtotal.toLocaleString()}</div>
            </div>
            <div className="space-y-1">
              <Label>הנחה (₪)</Label>
              <Input type="number" min="0" value={form.discount} onChange={e => set("discount", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>סה"כ לתשלום</Label>
              <div className="text-base font-bold text-primary">₪{total_price.toLocaleString()}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="meals" checked={form.includes_meals} onChange={e => set("includes_meals", e.target.checked)} />
              <Label htmlFor="meals">כולל ארוחות</Label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="activities" checked={form.includes_activities} onChange={e => set("includes_activities", e.target.checked)} />
              <Label htmlFor="activities">כולל פעילויות</Label>
            </div>
          </div>

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