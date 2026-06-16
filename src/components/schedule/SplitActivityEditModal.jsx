/**
 * SplitActivityEditModal — edit shared attributes + per-space pax/location
 * for a split activity group.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import LogisticsFields, { LOGISTICS_DEFAULTS } from "./LogisticsFields";

export default function SplitActivityEditModal({
  items,
  activitySpaces,
  groupDateRange,
  onSave,
  onClose,
  saving,
}) {
  const first = items[0];

  // Shared fields
  const [activityName, setActivityName] = useState(first.activity_name || "");
  const [date, setDate] = useState(first.date || "");
  const [startTime, setStartTime] = useState(first.start_time || "");
  const [endTime, setEndTime] = useState(first.end_time || "");

  // Per-row: space + pax + notes + logistics
  const [rows, setRows] = useState(
    items.map(item => ({
      id: item.id,
      activity_space_id: item.activity_space_id || "",
      pax: item.pax ?? "",
      notes: item.notes || "",
      needs_projector:    !!item.needs_projector,
      needs_screen:       !!item.needs_screen,
      needs_microphone:   !!item.needs_microphone,
      needs_sound:        !!item.needs_sound,
      needs_whiteboard:   !!item.needs_whiteboard,
      needs_chair_circle: !!item.needs_chair_circle,
      chairs_count:       item.chairs_count ?? "",
      logistics_other:    item.logistics_other || "",
      // carry-along fields needed by saveGroupScheduleItem
      group_id: item.group_id,
      operational_group_profile_id: item.operational_group_profile_id,
      quote_item_id: item.quote_item_id || null,
      split_group_id: item.split_group_id || null,
      split_index: item.split_index ?? null,
      split_total: item.split_total ?? null,
      source: item.source || "manual",
      status: item.status || "ACTIVE",
    }))
  );

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const updateRow = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const handleSave = async () => {
    setError("");
    setSubmitting(true);
    const payload = rows.map(r => ({
      ...r,
      activity_name: activityName,
      date,
      start_time: startTime,
      end_time: endTime,
      pax: Number(r.pax) || 0,
    }));
    const err = await onSave(payload);
    setSubmitting(false);
    if (err) {
      setError(err);
    } else {
      onClose();
    }
  };

  const { arrivalDate, departureDate } = groupDateRange || {};

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>עריכת פעילות מפוצלת</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Shared fields */}
          <div className="space-y-1">
            <Label>שם פעילות</Label>
            <Input value={activityName} onChange={e => setActivityName(e.target.value)} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>תאריך</Label>
              <Input
                type="date"
                value={date}
                min={arrivalDate || undefined}
                max={departureDate || undefined}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>שעת התחלה</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>שעת סיום</Label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>

          {/* Per-space rows */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">מרחבים, משתתפים וצרכים לוגיסטיים</Label>
            {rows.map((row, idx) => (
              <div key={row.id} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 w-4 shrink-0">{idx + 1}.</span>
                  <div className="flex-1">
                    <Select
                      value={row.activity_space_id || "none"}
                      onValueChange={v => updateRow(idx, "activity_space_id", v === "none" ? "" : v)}
                    >
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder="בחר מרחב" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">ללא מרחב</SelectItem>
                        {activitySpaces.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    placeholder="משתתפים"
                    value={row.pax}
                    onChange={e => updateRow(idx, "pax", e.target.value)}
                    className="w-24 text-xs h-8"
                  />
                </div>
                {/* Notes per row */}
                <Input
                  value={row.notes}
                  onChange={e => updateRow(idx, "notes", e.target.value)}
                  placeholder="הערות למרחב זה..."
                  className="text-xs h-7"
                />
                {/* Logistics per row */}
                <LogisticsFields
                  value={row}
                  onChange={patch => setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))}
                  compact
                />
              </div>
            ))}
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>ביטול</Button>
          <Button onClick={handleSave} disabled={submitting || saving}>
            {submitting ? "שומר..." : "שמור שינויים"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}