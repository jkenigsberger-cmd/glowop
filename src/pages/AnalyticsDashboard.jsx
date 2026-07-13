import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useRoleContext } from "@/lib/RoleContext";
import AnalyticsKpis from "@/components/analytics/AnalyticsKpis";
import MonthlyTrendCharts from "@/components/analytics/MonthlyTrendCharts";
import AnalyticsBreakdowns from "@/components/analytics/AnalyticsBreakdowns";
import AnalyticsGroupsTable from "@/components/analytics/AnalyticsGroupsTable";

const now = new Date();
export default function AnalyticsDashboard() {
  const { role, isLoadingRole } = useRoleContext();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!["SUPER_ADMIN", "ADMIN"].includes(role)) return;
    const [year, month] = period.split("-").map(Number);
    setData(null); setError("");
    base44.functions.invoke("getAnalyticsData", { year, month })
      .then(response => setData(response.data))
      .catch(err => setError(err?.response?.data?.error || err.message || "שגיאה בטעינת הנתונים"));
  }, [period, role]);
  if (isLoadingRole) return <div className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin" /></div>;
  if (!["SUPER_ADMIN", "ADMIN"].includes(role)) return <Navigate to="/dashboard" replace />;
  return <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-5" dir="rtl">
    <header className="flex items-end justify-between gap-4 flex-wrap"><div><h1 className="text-2xl font-heading font-semibold">דוחות חודשיים</h1><p className="text-sm text-muted-foreground">תמונת מצב חודשית של קבוצות, לינה, פעילויות וארוחות</p></div><label className="text-sm font-medium">חודש<input type="month" value={period} onChange={event => setPeriod(event.target.value)} className="block mt-1 h-9 rounded-md border bg-card px-3" /></label></header>
    {error && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
    {!data && !error && <div className="min-h-64 grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>}
    {data && <><AnalyticsKpis kpis={data.kpis} />{data.warnings?.length > 0 && <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="h-4 w-4 shrink-0" />{data.warnings.map(item => `${item.message}: ${item.count}`).join(" · ")}</div>}<MonthlyTrendCharts data={data.monthlyTrend} /><AnalyticsBreakdowns distribution={data.groupTypeDistribution} spaces={data.activitiesBySpace} /><AnalyticsGroupsTable groups={data.groups} /></>}
  </main>;
}