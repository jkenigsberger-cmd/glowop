import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function OrphanCleanupPanel() {
  const [dryRunResult, setDryRunResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const LABELS = {
    scheduleItems:            "שיבוצי פעילויות",
    mealReservations:         "הזמנות ארוחות",
    neighborhoodReservations: "הזמנות שכונות",
    allocations:              "הקצאות לינה",
    holds:                    "עצירות תפעוליות",
    profiles:                 "פרופילים תפעוליים",
    submissions:              "טפסי לקוח",
    quotes:                   "הצעות מחיר",
  };

  const totalOrphans = dryRunResult
    ? Object.values(dryRunResult).reduce((s, v) => s + v, 0)
    : 0;

  const handleDryRun = async () => {
    setLoading(true);
    setDone(false);
    setDryRunResult(null);
    try {
      const res = await base44.functions.invoke("cleanupOrphanData", { dry_run: true });
      if (res.data?.error) {
        toast.error(res.data.error);
      } else {
        setDryRunResult(res.data?.orphans || {});
      }
    } catch (e) {
      toast.error("הפעולה נכשלה. יש להתחבר מחדש או לבדוק הרשאות.");
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    setLoading(true);
    setConfirming(false);
    try {
      const res = await base44.functions.invoke("cleanupOrphanData", { dry_run: false });
      if (res.data?.success) {
        toast.success("ניקוי הושלם בהצלחה");
        setDone(true);
        setDryRunResult(null);
      } else {
        toast.error(res.data?.error || "שגיאה בניקוי");
      }
    } catch (e) {
      toast.error("הפעולה נכשלה. יש להתחבר מחדש או לבדוק הרשאות.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-amber-200 rounded-xl p-5 space-y-4" dir="rtl">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-slate-800">ניקוי נתונים יתומים</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            מוצא ומוחק רשומות תפעוליות שמקושרות לקבוצות שכבר נמחקו.
            לא ימחק אוהלים, מיטות, שכונות, מרחבי פעילות או מתקנים.
          </p>
        </div>
      </div>

      {done && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4" /> הניקוי הושלם בהצלחה.
        </div>
      )}

      {dryRunResult && !done && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
          <p className="text-xs font-semibold text-slate-600 mb-2">
            נמצאו {totalOrphans} רשומות יתומות:
          </p>
          {Object.entries(LABELS).map(([key, label]) => (
            dryRunResult[key] > 0 && (
              <div key={key} className="flex items-center justify-between text-xs text-slate-700">
                <span>{label}</span>
                <span className="font-bold text-red-600">{dryRunResult[key]}</span>
              </div>
            )
          ))}
          {totalOrphans === 0 && (
            <p className="text-xs text-emerald-600">✅ לא נמצאו נתונים יתומים — המערכת נקייה.</p>
          )}
        </div>
      )}

      {confirming && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-red-800">
            האם למחוק {totalOrphans} רשומות יתומות לצמיתות?
          </p>
          <p className="text-xs text-red-600">לא ניתן לבטל פעולה זו.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>ביטול</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white gap-1" onClick={handleCleanup} disabled={loading}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              מחק נתונים יתומים
            </Button>
          </div>
        </div>
      )}

      {!confirming && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleDryRun} disabled={loading} className="gap-1.5">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            סרוק נתונים יתומים
          </Button>
          {dryRunResult && totalOrphans > 0 && !done && (
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="w-3.5 h-3.5" /> מחק {totalOrphans} רשומות יתומות
            </Button>
          )}
        </div>
      )}
    </div>
  );
}