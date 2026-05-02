import { LayoutDashboard } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
      <div className="text-center space-y-3">
        <div className="bg-primary/10 rounded-full p-4 inline-flex mb-2">
          <LayoutDashboard className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">דשבורד תפעולי</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          מבט-על יומי — קבוצות פעילות, הגעות, יציאות וסטטוס מתקנים
        </p>
        <span className="inline-block bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-4 py-1 text-sm font-medium">
          בקרוב
        </span>
      </div>
    </div>
  );
}