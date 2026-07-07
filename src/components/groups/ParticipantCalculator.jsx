import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users } from "lucide-react";

/**
 * ParticipantCalculator — הרכב הקבוצה
 * Live people-on-site calculator for the group create/edit modal.
 * Same calculation approach as the Quote headcount section, adapted to groups:
 *   LODGING:  חניכים = בנים + בנות (calculated) · סה״כ = חניכים + צוות (calculated)
 *   DAY_USE:  סה״כ + צוות editable · חניכים = סה״כ − צוות (calculated)
 */
export default function ParticipantCalculator({ form, set, isDayUse }) {
  const n = (v) => Math.max(0, Number(v) || 0);
  const boys = n(form.boys_count);
  const girls = n(form.girls_count);
  const staff = n(form.staff_count);
  const manualTotal = n(form.total_pax);

  const students = isDayUse ? Math.max(0, manualTotal - staff) : boys + girls;
  const total = isDayUse ? manualTotal : students + staff;

  const staffExceedsTotal = isDayUse && staff > manualTotal && manualTotal > 0;
  // Edit mode: stored total differs from computed breakdown (LODGING only)
  const storedTotalMismatch = !isDayUse && form.total_pax !== "" && manualTotal !== total && manualTotal > 0;
  const isConsistent = total > 0 && !staffExceedsTotal;

  const numInput = (key, value, onChange) => (
    <Input
      type="number" min="0" inputMode="numeric"
      className="h-9 bg-white text-center font-medium"
      value={value}
      onChange={e => (onChange || ((v) => set(key, v)))(e.target.value)}
    />
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
      {/* Title */}
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-slate-700">הרכב הקבוצה</span>
      </div>

      {isDayUse ? (
        /* ── Simplified DAY_USE mode ── */
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">סה״כ משתתפים</Label>
            {numInput("total_pax", form.total_pax)}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">צוות / מלווים</Label>
            {numInput("staff_count", form.staff_count)}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">חניכים (מחושב)</Label>
            <div className="h-9 flex items-center justify-center rounded-md border bg-primary/5 text-sm font-semibold text-primary">
              {students}
            </div>
          </div>
        </div>
      ) : (
        /* ── Full LODGING breakdown ── */
        <>
          {/* חניכים card */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">חניכים</span>
              <span className="text-[11px] bg-primary/10 text-primary font-semibold rounded-full px-2 py-0.5">
                סה״כ חניכים: {students}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">בנים</Label>
                {numInput("boys_count", form.boys_count)}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">בנות</Label>
                {numInput("girls_count", form.girls_count)}
              </div>
            </div>
          </div>

          {/* צוות card */}
          <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
            <span className="text-xs font-semibold text-slate-600">צוות / מלווים</span>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">צוות</Label>
                {numInput("staff_count", form.staff_count)}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Live total */}
      <div className="bg-primary rounded-xl px-4 py-3 flex justify-between items-center">
        <span className="text-primary-foreground font-semibold text-sm">סה״כ אנשים במקום</span>
        <span className="text-primary-foreground font-bold text-xl">{total}</span>
      </div>

      {/* Status messages */}
      {staffExceedsTotal && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠️ מספר הצוות ({staff}) גדול מסה״כ המשתתפים ({manualTotal})
        </div>
      )}
      {storedTotalMismatch && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠️ הסה״כ השמור ({manualTotal}) שונה מהחלוקה — בשמירה יעודכן ל-{total}
        </div>
      )}
      {isConsistent && !storedTotalMismatch && (
        <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          ✓ החלוקה תקינה — {students} חניכים + {staff} צוות = {total}
        </div>
      )}

      <p className="text-[11px] text-slate-400">החישוב נשמר בפרופיל התפעולי של הקבוצה</p>
    </div>
  );
}