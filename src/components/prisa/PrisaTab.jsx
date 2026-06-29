import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Sandwich, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import RoleGate from "@/components/RoleGate";
import { PRISA_TYPE_LABELS, PRISA_SLOT_LABELS, computeEffectiveQuantity } from "@/lib/prisaLabels";

const EMPTY_FORM = () => ({
  date: "",
  quantity: "",
  pickup_slot: "AFTER_LUNCH",
  type: "REGULAR",
  notes: "",
});

export default function PrisaTab({ groupId, profile, group }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM());
  const [formError, setFormError] = useState(null);

  const profileId = profile?.id;
  const arrivalDate = group?.arrival_date || "";
  const departureDate = group?.departure_date || "";
  const groupType = group?.group_type || "LODGING";

  const minDate = arrivalDate;
  const maxDate = groupType === "DAY_USE" ? arrivalDate : (departureDate || arrivalDate);

  const { data: requests = [] } = useQuery({
    queryKey: ["prisaRequests", groupId],
    queryFn: () => base44.entities.PrisaRequest.filter({ group_id: groupId }),
    enabled: !!groupId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["prisaRequests", groupId] });

  const activeRequests = useMemo(() => requests
    .filter(r => r.status === "ACTIVE")
    .sort((a, b) => a.date.localeCompare(b.date)),
    [requests]);

  const effectivePreview = computeEffectiveQuantity(form.quantity, form.type);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM());
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (req) => {
    setEditingId(req.id);
    setForm({
      date: req.date || "",
      quantity: req.quantity != null ? String(req.quantity) : "",
      pickup_slot: req.pickup_slot || "AFTER_LUNCH",
      type: req.type || "REGULAR",
      notes: req.notes || "",
    });
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setFormError(null);
  };

  const validate = () => {
    if (!form.date) return "יש לבחור תאריך";
    if (minDate && form.date < minDate) return "התאריך מחוץ לטווח שהות הקבוצה";
    if (maxDate && form.date > maxDate) return "התאריך מחוץ לטווח שהות הקבוצה";
    if (!form.quantity || Number(form.quantity) <= 0) return "יש למלא כמות חיובית";
    if (!form.pickup_slot) return "יש לבחור זמן איסוף";
    if (!form.type) return "יש לבחור סוג";
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setFormError(err); return; }
    setSaving(true);
    const quantity = Number(form.quantity);
    const payload = {
      group_id: groupId,
      operational_group_profile_id: profileId,
      date: form.date,
      quantity,
      type: form.type,
      pickup_slot: form.pickup_slot,
      effective_quantity: computeEffectiveQuantity(quantity, form.type),
      notes: form.notes || null,
      source: "MANUAL",
      status: "ACTIVE",
    };
    if (editingId) {
      await base44.entities.PrisaRequest.update(editingId, payload);
      toast.success("פריסה עודכנה");
    } else {
      await base44.entities.PrisaRequest.create(payload);
      toast.success("פריסה נוספה");
    }
    setSaving(false);
    closeForm();
    invalidate();
  };

  const handleCancel = async (req) => {
    if (!window.confirm("לבטל פריסה זו?")) return;
    await base44.entities.PrisaRequest.update(req.id, {
      status: "CANCELLED",
      cancelled_date: new Date().toISOString(),
    });
    toast.success("פריסה בוטלה");
    invalidate();
  };

  if (!profile) return null;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2 text-slate-800">
          <Sandwich className="w-4 h-4 text-orange-600" /> פריסה
        </h3>
        <RoleGate permission="MANAGE_ACTIVITIES">
          <Button size="sm" variant="outline" onClick={formOpen ? closeForm : openAdd} className="gap-1">
            <Plus className="w-3.5 h-3.5" /> הוסף פריסה
          </Button>
        </RoleGate>
      </div>

      {/* Add / Edit Form */}
      {formOpen && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-orange-800">{editingId ? "ערוך פריסה" : "פריסה חדשה"}</p>

          {minDate && (
            <p className="text-xs text-slate-400">
              תאריכים מותרים: {minDate}{maxDate && maxDate !== minDate ? ` עד ${maxDate}` : ""}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <label className="text-xs text-slate-500">תאריך *</label>
              <Input
                type="date"
                value={form.date}
                min={minDate || undefined}
                max={maxDate || undefined}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500">כמות *</label>
              <Input
                type="number"
                min="1"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="0"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500">סוג *</label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="REGULAR">{PRISA_TYPE_LABELS.REGULAR}</SelectItem>
                  <SelectItem value="DOUBLE">{PRISA_TYPE_LABELS.DOUBLE}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 col-span-2">
              <label className="text-xs text-slate-500">זמן איסוף *</label>
              <Select value={form.pickup_slot} onValueChange={v => setForm(f => ({ ...f, pickup_slot: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AFTER_BREAKFAST">{PRISA_SLOT_LABELS.AFTER_BREAKFAST}</SelectItem>
                  <SelectItem value="AFTER_LUNCH">{PRISA_SLOT_LABELS.AFTER_LUNCH}</SelectItem>
                  <SelectItem value="AFTER_DINNER">{PRISA_SLOT_LABELS.AFTER_DINNER}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 col-span-2">
              <label className="text-xs text-slate-500">הערות</label>
              <Input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="הערות למטבח..."
              />
            </div>
          </div>

          {/* Effective quantity preview */}
          <div className="bg-orange-100 border border-orange-300 rounded-lg px-3 py-2">
            <p className="text-sm font-bold text-orange-900">
              כמות להכנה: {effectivePreview || 0}
            </p>
            {form.type === "DOUBLE" && Number(form.quantity) > 0 && (
              <p className="text-xs text-orange-700 mt-0.5">לפי: {Number(form.quantity)} × 2</p>
            )}
          </div>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
          )}

          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={closeForm}>ביטול</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">
              {saving ? "שומר..." : editingId ? "עדכן" : "הוסף"}
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      {activeRequests.length === 0 && !formOpen ? (
        <p className="text-sm text-muted-foreground text-center py-6 border-2 border-dashed border-orange-100 rounded-xl">
          אין בקשות פריסה עדיין — הוסף ידנית
        </p>
      ) : (
        <div className="space-y-3">
          {activeRequests.map(req => (
            <div key={req.id} className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sandwich className="w-4 h-4 text-orange-600 shrink-0" />
                    <span className="font-semibold text-orange-800 text-sm">פריסה</span>
                  </div>
                  <p className="text-sm text-slate-700 font-medium">
                    {req.date?.split("-").reverse().join("/")}
                  </p>
                  <p className="text-sm text-slate-600">⏰ איסוף: {PRISA_SLOT_LABELS[req.pickup_slot] || req.pickup_slot}</p>
                  <p className="text-sm text-slate-600">
                    כמות: {req.quantity} · סוג: {PRISA_TYPE_LABELS[req.type] || req.type}
                  </p>
                  <p className="text-sm font-bold text-orange-900">כמות להכנה: {req.effective_quantity}</p>
                  {req.notes && (
                    <p className="text-xs text-slate-500 mt-1">💬 {req.notes}</p>
                  )}
                </div>
                <RoleGate permission="MANAGE_ACTIVITIES">
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(req)} className="h-8 w-8 p-0">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleCancel(req)} className="h-8 w-8 p-0 text-red-400 hover:text-red-600">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </RoleGate>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}