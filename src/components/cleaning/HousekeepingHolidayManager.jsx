/**
 * ימי חג בחודש — manual holiday-date manager for housekeeping payroll.
 * Dates marked here apply 150% to ALL housekeeping shifts on that date.
 * MVP: manual only, no automatic Hebrew calendar.
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { CalendarDays, Plus, Trash2, Power } from "lucide-react";

function fmtDate(d) {
  if (!d) return "";
  const [y, mo, day] = d.split("-");
  return `${day}/${mo}/${y}`;
}

export default function HousekeepingHolidayManager({ user }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const { data: holidays = [] } = useQuery({
    queryKey: ["housekeepingHolidays"],
    queryFn: () => base44.entities.HousekeepingHoliday.list("-date", 200),
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["housekeepingHolidays"] });
  };

  const handleAdd = async () => {
    setError(null);
    if (!date) return setError("יש לבחור תאריך");
    if (holidays.some((h) => h.date === date)) return setError("התאריך כבר מסומן כיום חג");
    setSaving(true);
    await base44.entities.HousekeepingHoliday.create({
      date,
      label: label || null,
      is_active: true,
      rate_multiplier: 1.5,
      created_by: user?.email || "",
      updated_by: user?.email || "",
    });
    setDate("");
    setLabel("");
    setSaving(false);
    refetch();
  };

  const toggleActive = async (h) => {
    await base44.entities.HousekeepingHoliday.update(h.id, {
      is_active: !h.is_active,
      updated_by: user?.email || "",
    });
    refetch();
  };

  const remove = async (h) => {
    await base44.entities.HousekeepingHoliday.delete(h.id);
    refetch();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" /> ימי חג בחודש (תעריף 150%)
        </h3>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)} className="gap-1">
          <Plus className="w-4 h-4" /> הוסף יום חג
        </Button>
      </div>

      <p className="text-xs text-slate-500">
        תאריכים המסומנים כאן יחושבו אוטומטית כ-150% עבור כל משמרות הניקיון באותו יום.
      </p>

      {open && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">תאריך</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">שם החג (אופציונלי)</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="לדוגמה: פסח"
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => { setOpen(false); setError(null); }}>ביטול</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving}>{saving ? "שומר..." : "שמור"}</Button>
          </div>
        </div>
      )}

      {holidays.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">לא הוגדרו ימי חג</p>
      ) : (
        <div className="space-y-2">
          {holidays.map((h) => (
            <div
              key={h.id}
              className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 border ${
                h.is_active ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200 opacity-60"
              }`}
            >
              <div className="flex items-center gap-3 text-sm">
                <span className="font-semibold text-slate-800">{fmtDate(h.date)}</span>
                {h.label && <span className="text-slate-500">{h.label}</span>}
                <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${h.is_active ? "bg-amber-100 text-amber-700 border border-amber-300" : "bg-slate-200 text-slate-500"}`}>
                  {h.is_active ? "150% פעיל" : "לא פעיל"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => toggleActive(h)} className="h-7 px-2 gap-1 text-xs" title={h.is_active ? "השבת" : "הפעל"}>
                  <Power className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(h)} className="h-7 px-2 text-red-500 hover:text-red-700">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}