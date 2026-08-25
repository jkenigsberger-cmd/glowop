import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const formatDate = value => value ? value.split("-").reverse().join("/") : "—";

export default function MultiPeriodTimesFields({ periods, onChange }) {
  const setTime = (id, key, value) => onChange(current =>
    current.map(period => period.id === id ? { ...period, [key]: value } : period)
  );

  return (
    <section className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      <h3 className="font-semibold text-slate-800">תקופות שהייה</h3>
      {periods.map((period, index) => (
        <div key={period.id} className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
          <div>
            <p className="text-sm font-semibold text-slate-800">תקופה {index + 1}</p>
            <p className="text-sm text-slate-600">{formatDate(period.start_date)} – {formatDate(period.end_date)}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>שעת הגעה</Label>
              <Input type="time" value={period.arrival_time || ""} onChange={event => setTime(period.id, "arrival_time", event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>שעת עזיבה</Label>
              <Input type="time" value={period.departure_time || ""} onChange={event => setTime(period.id, "departure_time", event.target.value)} />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}