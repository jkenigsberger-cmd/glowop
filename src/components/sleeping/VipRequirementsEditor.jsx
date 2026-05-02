import { Plus, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const VIP_MAX = 10;
const VIP_MAX_PER_TENT = 3;

const PURPOSE_OPTIONS = [
  { value: "STAFF",    label: "צוות" },
  { value: "DRIVER",   label: "נהג" },
  { value: "SECURITY", label: "אבטחה" },
  { value: "GUIDE",    label: "מדריך" },
  { value: "OTHER",    label: "אחר" },
];

const GENDER_OPTIONS = [
  { value: "MEN",   label: "גברים" },
  { value: "WOMEN", label: "נשים" },
];

const EMPTY_ROW = () => ({ gender_group: "", people_count: 1, purpose: "STAFF", notes: "" });

function VipSummary({ rows }) {
  const total      = rows.length;
  const menRows    = rows.filter(r => r.gender_group === "MEN");
  const womenRows  = rows.filter(r => r.gender_group === "WOMEN");
  const menPeople  = menRows.reduce((s, r) => s + (r.people_count || 0), 0);
  const womenPeople= womenRows.reduce((s, r) => s + (r.people_count || 0), 0);
  const exceedsMax = total > VIP_MAX;
  const hasOverPax = rows.some(r => r.people_count > VIP_MAX_PER_TENT);

  if (total === 0) return null;

  return (
    <div className={`rounded-lg border px-3 py-2.5 text-xs space-y-1 ${exceedsMax || hasOverPax ? "bg-red-50 border-red-300 text-red-700" : "bg-purple-50 border-purple-200 text-purple-700"}`}>
      <p className="font-semibold flex items-center gap-1.5">
        {exceedsMax || hasOverPax
          ? <><AlertTriangle className="w-3.5 h-3.5" /> שגיאות VIP</>
          : <><CheckCircle2 className="w-3.5 h-3.5" /> סיכום VIP</>
        }
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span>סה"כ אוהלי VIP: <strong>{total}</strong> / {VIP_MAX}</span>
        <span>סה"כ אנשים: <strong>{menPeople + womenPeople}</strong></span>
        <span>גברים: {menRows.length} אוהלים · {menPeople} אנשים</span>
        <span>נשים: {womenRows.length} אוהלים · {womenPeople} אנשים</span>
      </div>
      {exceedsMax  && <p className="text-red-600">⚠️ חריגה מהמקסימום ({VIP_MAX} אוהלי VIP בסה"כ)</p>}
      {hasOverPax  && <p className="text-red-600">⚠️ יש שורה עם יותר מ-{VIP_MAX_PER_TENT} אנשים לאוהל</p>}
      <p className="text-[10px] opacity-60">אוהלי VIP 80–89. שיבוץ ספציפי ייעשה ע"י משק הבית.</p>
    </div>
  );
}

export default function VipRequirementsEditor({ rows, onChange }) {
  const addRow    = () => onChange([...rows, EMPTY_ROW()]);
  const removeRow = (i) => onChange(rows.filter((_, idx) => idx !== i));
  const updateRow = (i, field, val) => {
    const next = [...rows];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-slate-500">כל שורה = אוהל VIP אחד נדרש (לא מוקצה פיזית)</p>
        <div className="flex gap-1.5 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => onChange([...rows, { ...EMPTY_ROW(), purpose: "SECURITY", gender_group: "" }])}
            className="text-xs gap-1 h-7 border-amber-300 text-amber-700 hover:bg-amber-50" disabled={rows.length >= 10}>
            <Plus className="w-3 h-3" /> אבטחה
          </Button>
          <Button size="sm" variant="outline" onClick={() => onChange([...rows, { ...EMPTY_ROW(), purpose: "DRIVER", gender_group: "" }])}
            className="text-xs gap-1 h-7 border-blue-300 text-blue-700 hover:bg-blue-50" disabled={rows.length >= 10}>
            <Plus className="w-3 h-3" /> נהג
          </Button>
          <Button size="sm" variant="outline" onClick={addRow} className="text-xs gap-1 h-7" disabled={rows.length >= 10}>
            <Plus className="w-3 h-3" /> הוסף אוהל VIP
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-3 border-2 border-dashed border-slate-200 rounded-lg">
          אין דרישות VIP — לחץ "הוסף אוהל VIP"
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => {
            const overPax    = row.people_count > VIP_MAX_PER_TENT;
            const missingGender = !row.gender_group;
            const missingPax    = !row.people_count;
            const hasError = overPax || missingGender || missingPax;

            return (
              <div key={i} className={`border rounded-lg p-3 space-y-2 ${hasError ? "border-red-300 bg-red-50/40" : "border-slate-200 bg-white"}`}>
                <div className="grid grid-cols-12 gap-2 items-end">
                  {/* Gender */}
                  <div className="col-span-3 space-y-1">
                    <label className="text-[11px] text-slate-500">מגדר *</label>
                    <Select value={row.gender_group || ""} onValueChange={v => updateRow(i, "gender_group", v)}>
                      <SelectTrigger className={`h-7 text-xs ${missingGender ? "border-red-400" : ""}`}>
                        <SelectValue placeholder="בחר..." />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* People count */}
                  <div className="col-span-2 space-y-1">
                    <label className="text-[11px] text-slate-500">אנשים *</label>
                    <Input
                      type="number" min="1" max="3"
                      value={row.people_count || ""}
                      onChange={e => updateRow(i, "people_count", e.target.value === "" ? "" : Number(e.target.value))}
                      className={`h-7 text-xs text-center ${overPax || missingPax ? "border-red-400 bg-red-50" : ""}`}
                    />
                  </div>

                  {/* Purpose */}
                  <div className="col-span-3 space-y-1">
                    <label className="text-[11px] text-slate-500">מיועד ל</label>
                    <Select value={row.purpose || "STAFF"} onValueChange={v => updateRow(i, "purpose", v)}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PURPOSE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Notes */}
                  <div className="col-span-3 space-y-1">
                    <label className="text-[11px] text-slate-500">הערות</label>
                    <Input
                      value={row.notes || ""}
                      onChange={e => updateRow(i, "notes", e.target.value)}
                      placeholder="הערה..."
                      className="h-7 text-xs"
                    />
                  </div>

                  {/* Delete */}
                  <div className="col-span-1 flex justify-center pb-0.5">
                    <button onClick={() => removeRow(i)} className="text-slate-300 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Row-level errors */}
                {hasError && (
                  <div className="text-[11px] text-red-600 space-y-0.5">
                    {missingGender && <p>• חסר מגדר</p>}
                    {missingPax    && <p>• חסר מספר אנשים</p>}
                    {overPax       && <p>• מקסימום {VIP_MAX_PER_TENT} אנשים לאוהל VIP</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <VipSummary rows={rows} />
    </div>
  );
}