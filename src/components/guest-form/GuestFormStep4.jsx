import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";

const LOCATION_OPTIONS = [
  { value: "כיתה",          label: "כיתה" },
  { value: "מתחם חוץ",      label: "מתחם חוץ" },
  { value: "מחוץ לחווה",   label: "מחוץ לחווה" },
];

function ActivityRow({ row, index, onChange, onRemove }) {
  const set = (k, v) => onChange(index, { ...row, [k]: v });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
      {/* Row header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400">פעילות {index + 1}</span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-slate-300 hover:text-red-400 transition-colors p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Activity name */}
      <div className="space-y-1">
        <Label className="text-sm text-slate-600">שם / כותרת הפעילות</Label>
        <Input
          value={row.activity}
          onChange={e => set("activity", e.target.value)}
          placeholder="לדוגמה: פעילות פתיחה, סדנה, הרצאה..."
        />
      </div>

      {/* Date + Location */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-sm text-slate-600">תאריך</Label>
          <Input
            type="date"
            value={row.date}
            onChange={e => set("date", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm text-slate-600">איפה?</Label>
          <Select value={row.location} onValueChange={v => set("location", v)}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="בחר מיקום..." />
            </SelectTrigger>
            <SelectContent>
              {LOCATION_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Times + Pax */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-sm text-slate-600">שעת התחלה</Label>
          <Input
            type="time"
            value={row.start_time}
            onChange={e => set("start_time", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm text-slate-600">שעת סיום</Label>
          <Input
            type="time"
            value={row.end_time}
            onChange={e => set("end_time", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm text-slate-600">מספר משתתפים</Label>
          <Input
            type="number"
            min="0"
            value={row.pax}
            onChange={e => set("pax", e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <Label className="text-sm text-slate-600">הערות / בקשות מיוחדות</Label>
        <textarea
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[64px] focus:outline-none focus:ring-1 focus:ring-primary bg-white resize-none"
          placeholder="ציוד מיוחד, דרישות חשמל, בקשות נגישות..."
          value={row.notes}
          onChange={e => set("notes", e.target.value)}
        />
      </div>
    </div>
  );
}

function emptyRow(defaultDate, defaultPax) {
  return {
    date:       defaultDate || "",
    start_time: "",
    end_time:   "",
    location:   "",
    pax:        defaultPax  || "",
    activity:   "",
    notes:      "",
  };
}

export default function GuestFormStep4({ rows, setRows, quoteData }) {
  const defaultDate = quoteData?.arrival_date || "";
  const defaultPax  = quoteData?.total_pax    || quoteData?.participant_count || "";

  const handleChange = (index, updated) => {
    setRows(prev => prev.map((r, i) => i === index ? updated : r));
  };

  const handleRemove = (index) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    setRows(prev => [...prev, emptyRow(defaultDate, defaultPax)]);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        פרטו את לוח הפעילויות המתוכנן. מידע זה יסייע לנו להכין את המתחמים בהתאם לצרכים שלכם.
      </p>

      {rows.length === 0 && (
        <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl">
          <p className="text-2xl mb-2">📋</p>
          <p>אין פעילויות עדיין</p>
          <p className="text-xs mt-1">לחצו על "הוסף פעילות" להתחיל</p>
        </div>
      )}

      {rows.map((row, index) => (
        <ActivityRow
          key={index}
          row={row}
          index={index}
          onChange={handleChange}
          onRemove={handleRemove}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={handleAdd}
        className="w-full gap-2 border-dashed border-slate-300 text-slate-600 hover:border-primary hover:text-primary"
      >
        <Plus className="w-4 h-4" />
        הוסף פעילות
      </Button>
    </div>
  );
}