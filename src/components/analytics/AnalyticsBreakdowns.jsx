import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis } from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--brand-yellow))", "hsl(var(--muted-foreground))"];
export default function AnalyticsBreakdowns({ distribution, spaces }) {
  const visible = distribution.filter(item => item.count > 0);
  return <div className="grid lg:grid-cols-2 gap-4">
    <section className="rounded-xl border bg-card p-4"><h2 className="font-semibold mb-2">התפלגות סוגי קבוצות</h2><div className="h-64" dir="ltr">
      <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={visible} dataKey="count" nameKey="type" innerRadius={50} outerRadius={85} label>{visible.map((_, index) => <Cell key={index} fill={COLORS[index]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
    </div></section>
    <section className="rounded-xl border bg-card p-4"><h2 className="font-semibold mb-2">פעילויות לפי מרחב</h2><div className="h-64" dir="ltr">
      <ResponsiveContainer width="100%" height="100%"><BarChart data={spaces.slice(0, 8)} layout="vertical"><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="space_name" width={95} fontSize={11} /><Tooltip /><Bar dataKey="count" name="פעילויות" fill="hsl(var(--brand-blue))" /></BarChart></ResponsiveContainer>
    </div></section>
  </div>;
}