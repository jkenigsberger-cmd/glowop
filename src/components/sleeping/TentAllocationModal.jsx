import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TentAllocationModal({ tent, neighborhood, groupId, profile, onSave, onClose }) {
  const isVip = neighborhood?.is_vip === true;
  const defaultType = isVip ? "STAFF" : "STUDENT";

  const [form, setForm] = useState({
    allocation_type: defaultType,
    gender_group: defaultType === "STAFF" ? "MEN" : "BOYS",
    allocated_pax: 1,
    notes: "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const genderOptions = form.allocation_type === "STUDENT"
    ? [{ value: "BOYS", label: "בנים 👦" }, { value: "GIRLS", label: "בנות 👧" }]
    : [{ value: "MEN", label: "גברים 👨" }, { value: "WOMEN", label: "נשים 👩" }];

  const handleTypeChange = (v) => {
    set("allocation_type", v);
    set("gender_group", v === "STUDENT" ? "BOYS" : "MEN");
  };

  const handleSave = () => {
    if (form.allocated_pax < 1 || form.allocated_pax > tent.capacity) return;
    onSave({
      tent_id: tent.id,
      neighborhood_id: neighborhood.id,
      group_id: groupId,
      operational_group_profile_id: profile.id,
      arrival_date: profile.arrival_date || profile.group_arrival_date,
      departure_date: profile.departure_date || profile.group_departure_date,
      allocated_pax: Number(form.allocated_pax),
      allocation_type: form.allocation_type,
      gender_group: form.gender_group,
      notes: form.notes,
      status: "DRAFT",
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-sm">
            הקצה אוהל {tent.code}
            <span className="text-slate-400 font-normal mr-2 text-xs">קיבולת: {tent.capacity}</span>
            {tent.is_accessible && <span className="text-xs text-blue-600 mr-1">♿ נגיש</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">סוג הקצאה</Label>
            <Select value={form.allocation_type} onValueChange={handleTypeChange}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="STUDENT">חניכים</SelectItem>
                <SelectItem value="STAFF">צוות</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">מגדר</Label>
            <Select value={form.gender_group} onValueChange={v => set("gender_group", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {genderOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">מספר משתתפים (מקסימום: {tent.capacity})</Label>
            <Input
              type="number"
              min="1"
              max={tent.capacity}
              value={form.allocated_pax}
              onChange={e => set("allocated_pax", Number(e.target.value))}
              className="h-8 text-xs"
            />
            {form.allocated_pax > tent.capacity && (
              <p className="text-xs text-red-500">חורג מקיבולת האוהל ({tent.capacity})</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-500">הערות</Label>
            <Input
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              className="h-8 text-xs"
              placeholder="הערות אופציונלי..."
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>ביטול</Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={form.allocated_pax < 1 || form.allocated_pax > tent.capacity}
            >
              הוסף כטיוטה
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}