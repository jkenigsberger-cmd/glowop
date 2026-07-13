import { ResponsiveContainer, ComposedChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

export default function MonthlyTrendCharts({ data }) {
  return <div className="grid lg:grid-cols-2 gap-4">
    <section className="rounded-xl border bg-card p-4"><h2 className="font-semibold mb-4">משתתפים לפי חודש</h2><div className="h-72" dir="ltr">
      <ResponsiveContainer width="100%" height="100%"><ComposedChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month_label" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend /><Bar dataKey="lodging_pax" name="לינה" fill="hsl(var(--primary))" /><Bar dataKey="day_use_pax" name="יום" fill="hsl(var(--brand-yellow))" /></ComposedChart></ResponsiveContainer>
    </div></section>
    <section className="rounded-xl border bg-card p-4"><h2 className="font-semibold mb-4">תפוסת מיטות חודשית</h2><div className="h-72" dir="ltr">
      <ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month_label" fontSize={11} /><YAxis unit="%" fontSize={11} /><Tooltip formatter={value => `${Number(value).toFixed(1)}%`} /><Line type="monotone" dataKey="bed_occupancy_rate" name="תפוסה" stroke="hsl(var(--brand-green))" strokeWidth={3} /></LineChart></ResponsiveContainer>
    </div></section>
  </div>;
}