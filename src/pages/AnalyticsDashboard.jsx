import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, AlertTriangle } from "lucide-react";
import { useRoleContext } from "@/lib/RoleContext";
import useAnalyticsData from "@/hooks/useAnalyticsData";
import AnalyticsFilters from "@/components/analytics/AnalyticsFilters";
import AnalyticsKpis from "@/components/analytics/AnalyticsKpis";
import AnalyticsComparison from "@/components/analytics/AnalyticsComparison";
import MonthlyTrendCharts from "@/components/analytics/MonthlyTrendCharts";
import AnalyticsBreakdowns from "@/components/analytics/AnalyticsBreakdowns";
import NeighborhoodUsage from "@/components/analytics/NeighborhoodUsage";
import TentUsage from "@/components/analytics/TentUsage";
import AnalyticsGroupsTable from "@/components/analytics/AnalyticsGroupsTable";

const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;
const initial = { mode: "single", monthA: currentMonth, monthB: previousMonth, rangeStart: currentMonth, rangeEnd: currentMonth };
const HEBREW_MONTHS = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];
const monthLabel = (year, month) => `${HEBREW_MONTHS[month - 1]} ${year}`;

export default function AnalyticsDashboard() {
  const { role, isLoadingRole } = useRoleContext();
  const [config, setConfig] = useState(initial);
  const { data, comparison, loading, error } = useAnalyticsData(config, role);
  const printReport = () => { document.body.classList.add("analytics-print-mode"); window.print(); setTimeout(() => document.body.classList.remove("analytics-print-mode"), 500); };
  if (isLoadingRole) return <div className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin" /></div>;
  if (role !== "SUPER_ADMIN") return <Navigate to="/dashboard" replace />;
  const label = data ? (data.period.mode === "single" ? monthLabel(data.period.start_year, data.period.start_month) : `${monthLabel(data.period.start_year, data.period.start_month)} – ${monthLabel(data.period.end_year, data.period.end_month)}`) : "";
  return <main className="analytics-report max-w-screen-xl mx-auto px-4 py-6 space-y-5" dir="rtl">
    <div className="analytics-no-print"><h1 className="text-2xl font-heading font-semibold">דוחות חודשיים</h1><p className="text-sm text-muted-foreground">תמונת מצב של קבוצות, לינה, פעילויות וארוחות</p></div>
    <div className="analytics-print-title"><h1>דוח BI חודשי</h1><p>{label}</p></div>
    <AnalyticsFilters initial={config} onApply={setConfig} onPrint={printReport} />
    {error && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
    {loading && <div className="min-h-64 grid place-items-center text-muted-foreground"><Loader2 className="animate-spin" /></div>}
    {data && <><AnalyticsKpis kpis={data.kpis} />{data.warnings?.length > 0 && <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="h-4 w-4 shrink-0" />{data.warnings.map(item => `${item.message}: ${item.count}`).join(" · ")}</div>}<AnalyticsComparison current={data.kpis} previous={comparison?.kpis} /><MonthlyTrendCharts data={data.monthlyTrend} /><AnalyticsBreakdowns distribution={data.groupTypeDistribution} spaces={data.activitiesBySpace} /><NeighborhoodUsage rows={data.neighborhoodUsage || []} /><TentUsage rows={data.tentUsage || []} /><AnalyticsGroupsTable groups={data.groups} /></>}
  </main>;
}