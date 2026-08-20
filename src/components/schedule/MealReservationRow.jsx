import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Check, X, ChevronDown, ChevronUp, Lock, LockOpen } from "lucide-react";
import RoleGate from "@/components/RoleGate";

const MEAL_LABELS = { BREAKFAST: "ארוחת בוקר", LUNCH: "ארוחת צהריים", DINNER: "ארוחת ערב", OTHER: "אחר" };

// Default times used when editing (same as sync defaults)
const MEAL_DEFAULTS = {
  BREAKFAST: { start_time: "08:00", end_time: "10:00" },
  LUNCH:     { start_time: "12:45", end_time: "14:00" },
  DINNER:    { start_time: "18:30", end_time: "20:00" },
  OTHER:     { start_time: "12:00", end_time: "13:00" },
};

const DIET_LABELS = [
  { key: "vegetarian_count",      label: "צמחוני",              emoji: "🥦" },
  { key: "vegan_count",           label: "טבעוני",              emoji: "🌱" },
  { key: "glutenFree_count",      label: "ללא גלוטן",           emoji: "🌾" },
  { key: "lactoseFree_count",     label: "ללא לקטוז",           emoji: "🥛" },
  { key: "eggFree_count",         label: "ללא ביצים",           emoji: "🥚" },
  { key: "nutFree_count",         label: "ללא אגוזים",          emoji: "🥜" },
  { key: "mehadrinKosher_count",  label: "מהדרין",              emoji: "✡️" },
  { key: "lifeThreatening_count", label: "אלרגיה מסכנת חיים",  emoji: "⚠️" },
];

function parseDiets(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function DietBadges({ raw }) {
  const diets = parseDiets(raw);
  if (!diets) return null;
  const items = DIET_LABELS.filter(l => Number(diets[l.key]) > 0);
  const hasLifeThreat = Number(diets.lifeThreatening_count) > 0;
  if (!items.length && !diets.diet_notes) return null;

  return (
    <div className={`rounded-lg px-3 py-2 text-xs space-y-1 ${hasLifeThreat ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"}`}>
      <p className="font-semibold text-slate-700 text-[11px]">🍽️ דיאטות מיוחדות:</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(l => (
          <span
            key={l.key}
            className={`px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${l.key === "lifeThreatening_count" ? "bg-red-100 text-red-700" : "bg-white text-slate-600 border border-slate-200"}`}
          >
            <span>{l.emoji}</span>
            {l.label}: {diets[l.key]}
          </span>
        ))}
      </div>
      {diets.diet_notes && (
        <p className="text-slate-600 text-[11px]">הערה: {diets.diet_notes}</p>
      )}
    </div>
  );
}

export default function MealReservationRow({ item, onSave, onCancel, onToggleLock, saving, profileDiets = null }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Prefer current profile diet over stale MealReservation.special_diets_summary
  const effectiveDietsRaw = profileDiets || item.special_diets_summary;
  const parsedDietsInit = parseDiets(effectiveDietsRaw) || {};
  const initDiets = {};
  DIET_LABELS.forEach(l => { initDiets[l.key] = parsedDietsInit[l.key] ?? 0; });
  initDiets.diet_notes = parsedDietsInit.diet_notes || "";

  const [form, setForm] = useState({ ...item });
  const [dietForm, setDietForm] = useState(initDiets);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setDiet = (k, v) => setDietForm(f => ({ ...f, [k]: v }));

  const handleMealTypeChange = (v) => {
    const defaults = MEAL_DEFAULTS[v] || MEAL_DEFAULTS.OTHER;
    setForm(f => ({ ...f, meal_type: v, start_time: defaults.start_time, end_time: defaults.end_time }));
  };

  const handleStartChange = (v) => {
    setForm(f => ({ ...f, start_time: v }));
  };

  const handleSave = async () => {
    // Merge updated diet counts back into special_diets_summary
    const updatedForm = {
      ...form,
      special_diets_summary: JSON.stringify(dietForm),
    };
    await onSave(updatedForm, item);
    setEditing(false);
  };

  const handleCancel = () => {
    setForm({ ...item });
    const pd = parseDiets(effectiveDietsRaw) || {};
    const reset = {};
    DIET_LABELS.forEach(l => { reset[l.key] = pd[l.key] ?? 0; });
    reset.diet_notes = pd.diet_notes || "";
    setDietForm(reset);
    setEditing(false);
  };

  // Use current profile diets for display (prefer over stale snapshot)
  const effectiveDiets = parseDiets(effectiveDietsRaw);
  const hasDiets = effectiveDiets
    ? (DIET_LABELS.some(l => Number(effectiveDiets[l.key]) > 0) || !!effectiveDiets.diet_notes)
    : false;
  const hasLifeThreat = effectiveDiets && Number(effectiveDiets.lifeThreatening_count) > 0;

  if (editing) {
    return (
      <div className="bg-slate-50 border border-primary/30 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-500">תאריך</label>
            <Input type="date" value={form.date} onChange={e => set("date", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">סוג ארוחה</label>
            <Select value={form.meal_type} onValueChange={handleMealTypeChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(MEAL_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">שעת התחלה</label>
            <Input type="time" value={form.start_time} onChange={e => handleStartChange(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">שעת סיום</label>
            <Input type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">מספר אנשים</label>
            <Input type="number" min="0" value={form.pax || ""} onChange={e => set("pax", e.target.value)} />
          </div>
          <div className="space-y-1 flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id={`sandwich-${item.id}`}
              checked={!!form.sandwich_option}
              onChange={e => set("sandwich_option", e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor={`sandwich-${item.id}`} className="text-xs text-slate-600">כריכים במקום ארוחה חמה</label>
          </div>
          <div className="space-y-1 col-span-2">
            <label className="text-xs text-slate-500">הערות למטבח</label>
            <Input value={form.notes || ""} onChange={e => set("notes", e.target.value)} placeholder="הערות..." />
          </div>
        </div>

        {/* Diet counts */}
        <div className="border-t border-slate-200 pt-3 space-y-2">
          <p className="text-xs font-semibold text-slate-600">🍽️ דיאטות מיוחדות</p>
          <div className="grid grid-cols-2 gap-2">
            {DIET_LABELS.map(l => (
              <div key={l.key} className="flex items-center gap-2">
                <span className="text-base">{l.emoji}</span>
                <label className="text-xs text-slate-600 flex-1">{l.label}</label>
                <Input
                  type="number"
                  min="0"
                  value={dietForm[l.key] || ""}
                  onChange={e => setDiet(l.key, Number(e.target.value) || 0)}
                  className="w-16 text-center text-xs h-7"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">הערות תזונה</label>
            <Input value={dietForm.diet_notes || ""} onChange={e => setDiet("diet_notes", e.target.value)} placeholder="הערות תזונה..." />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={handleCancel} className="gap-1">
            <X className="w-3.5 h-3.5" /> ביטול
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
            <Check className="w-3.5 h-3.5" /> {saving ? "שומר..." : "שמור"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card border rounded-xl overflow-hidden ${item.status === "CANCELLED" ? "opacity-50" : hasLifeThreat ? "border-red-300" : "border-border"}`}>
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{MEAL_LABELS[item.meal_type] || item.meal_type}</span>
            {item.sandwich_option && (
              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5">🥪 כריכים</span>
            )}
            {hasLifeThreat && (
              <span className="text-xs bg-red-100 text-red-700 border border-red-300 rounded px-1.5 font-semibold">⚠️ אלרגיה מסכנת חיים</span>
            )}
            {item.source === "manual" && (
              <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5">ידני</span>
            )}
            {item.status === "CANCELLED" && (
              <span className="text-xs bg-red-50 text-red-600 border border-red-200 rounded px-1.5">בוטל</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>{item.date} · {item.start_time}–{item.end_time} · {item.pax} אנשים</span>
            {item.status !== "CANCELLED" && (
              <RoleGate permission="MANAGE_MEALS">
                <button
                  type="button"
                  onClick={() => onToggleLock(item, item.pax_sync_locked !== true)}
                  disabled={saving}
                  title={item.pax_sync_locked === true ? "נעול — מספר הסועדים לא יתעדכן אוטומטית לפי הקבוצה" : "מתעדכן אוטומטית לפי מספר המשתתפים בקבוצה"}
                  aria-label={item.pax_sync_locked === true ? "בטל נעילת מספר סועדים" : "נעל מספר סועדים"}
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                >
                  {item.pax_sync_locked === true ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                </button>
              </RoleGate>
            )}
          </div>
          {item.notes && (
            <p className="text-xs text-slate-600 whitespace-pre-line">{item.notes}</p>
          )}
          {hasDiets && !expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline"
            >
              <ChevronDown className="w-3 h-3" /> הצג דיאטות מיוחדות
            </button>
          )}
          {hasDiets && expanded && (
            <>
              <DietBadges raw={effectiveDietsRaw} />
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="text-xs text-slate-400 flex items-center gap-1 hover:underline"
              >
                <ChevronUp className="w-3 h-3" /> הסתר
              </button>
            </>
          )}
        </div>
        {item.status !== "CANCELLED" && (
          <RoleGate permission="MANAGE_MEALS">
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="h-7 w-7 p-0">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onCancel(item.id)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </RoleGate>
        )}
      </div>
    </div>
  );
}