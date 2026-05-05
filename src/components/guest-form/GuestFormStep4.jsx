import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";

const LOCATION_OPTIONS = [
  { value: "כיתה",        label: "כיתה" },
  { value: "מתחם חוץ",    label: "מתחם חוץ" },
  { value: "מחוץ לחווה", label: "מחוץ לחווה" },
];

const NEEDS_OPTIONS = [
  { key: "microphone", label: "מיקרופון" },
  { key: "projector",  label: "מקרן" },
  { key: "chairs",     label: "סידור כיסאות" },
  { key: "tables",     label: "שולחנות" },
  { key: "whiteboard", label: "לוח כתיבה" },
  { key: "other",      label: "אחר" },
];

function NeedsSection({ needs = {}, onNeedsChange }) {
  const toggle = (key) => onNeedsChange({ ...needs, [key]: !needs[key] });

  return (
    <div className="space-y-2">
      <Label className="text-sm text-slate-600">צרכים ובקשות לפעילות</Label>
      <div className="flex flex-wrap gap-2">
        {NEEDS_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              needs[key]
                ? "bg-primary text-white border-primary"
                : "bg-white text-slate-600 border-slate-300 hover:border-primary hover:text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {needs.other && (
        <Input
          value={needs.other_text || ""}
          onChange={e => onNeedsChange({ ...needs, other_text: e.target.value })}
          placeholder="פרטו בקשה נוספת"
          className="text-sm"
        />
      )}
    </div>
  );
}

function ActivityRow({ row, index, onChange, onRemove, minDate, maxDate }) {
  const set = (k, v) => onChange(index, { ...row, [k]: v });

  const timeError = row.start_time && row.end_time && row.start_time >= row.end_time
    ? "שעת הסיום חייבת להיות אחרי שעת ההתחלה"
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
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

      <div className="space-y-1">
        <Label className="text-sm text-slate-600">שם / כותרת הפעילות</Label>
        <Input
          value={row.activity}
          onChange={e => set("activity", e.target.value)}
          placeholder="לדוגמה: פעילות פתיחה, סדנה, הרצאה..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-sm text-slate-600">תאריך</Label>
          <Input
            type="date"
            value={row.date}
            min={minDate || undefined}
            max={maxDate || undefined}
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

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-sm text-slate-600">שעת התחלה</Label>
          <Input type="time" value={row.start_time} onChange={e => set("start_time", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-sm text-slate-600">שעת סיום</Label>
          <Input
            type="time"
            value={row.end_time}
            min={row.start_time || undefined}
            onChange={e => set("end_time", e.target.value)}
            className={timeError ? "border-red-400" : ""}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm text-slate-600">מספר משתתפים</Label>
          <Input type="number" min="0" value={row.pax} onChange={e => set("pax", e.target.value)} placeholder="0" />
        </div>
      </div>

      {timeError && <p className="text-xs text-red-500">{timeError}</p>}

      <NeedsSection needs={row.needs || {}} onNeedsChange={v => set("needs", v)} />

      <div className="space-y-1">
        <Label className="text-sm text-slate-600">הערות נוספות</Label>
        <textarea
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[56px] focus:outline-none focus:ring-1 focus:ring-primary bg-white resize-none"
          placeholder="הערות נוספות לפעילות..."
          value={row.notes}
          onChange={e => set("notes", e.target.value)}
        />
      </div>
    </div>
  );
}

function emptyRow(defaultDate, defaultPax) {
  return { date: defaultDate || "", start_time: "", end_time: "", location: "", pax: defaultPax || "", activity: "", needs: {}, notes: "" };
}

export default function GuestFormStep4({ rows, setRows, quoteData }) {
  const defaultDate = quoteData?.arrival_date || "";
  const defaultPax  = quoteData?.total_pax    || quoteData?.participant_count || "";

  const hasTimeErrors = rows.some(r => r.start_time && r.end_time && r.start_time >= r.end_time);

  const handleChange = (index, updated) => setRows(prev => prev.map((r, i) => i === index ? updated : r));
  const handleRemove = (index) => setRows(prev => prev.filter((_, i) => i !== index));
  const handleAdd    = () => setRows(prev => [...prev, emptyRow(defaultDate, defaultPax)]);

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
          minDate={quoteData?.arrival_date || undefined}
          maxDate={quoteData?.departure_date || undefined}
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

      {hasTimeErrors && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm text-center">
          ⚠️ יש שגיאות בשעות — שעת הסיום חייבת להיות אחרי שעת ההתחלה
        </div>
      )}
    </div>
  );
}