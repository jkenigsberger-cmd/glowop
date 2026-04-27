import { useState } from "react";
import { seedInventory } from "@/lib/seedInventory";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

export default function SeedButton({ onSeeded }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | running | done | error
  const [progress, setProgress] = useState("");
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const handleSeed = async () => {
    setStatus("running");
    setError(null);
    try {
      const result = await seedInventory((msg) => setProgress(msg));
      setReport(result);
      setStatus("done");
      onSeeded?.();
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  };

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        סנכרן / זרע מלאי
      </Button>

      <Dialog open={open} onOpenChange={(v) => { if (status !== "running") setOpen(v); }}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">זריעת מלאי פיזי ראשוני</DialogTitle>
          </DialogHeader>

          {status === "idle" && (
            <div className="space-y-4">
              <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>פעולה זו אידמפוטנטית — פריטים קיימים יעודכנו, פריטים חסרים יווצרו. לא נוצרות כפילויות.</p>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>יווצרו:</p>
                <ul className="list-disc list-inside space-y-0.5 mr-2">
                  <li>8 שכונות</li>
                  <li>51 אוהלים</li>
                  <li>335 מיטות</li>
                  <li>6 אזורי שירותים</li>
                  <li>46 מתקנים</li>
                  <li>9 מרחבי פעילות</li>
                </ul>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
                <Button variant="destructive" onClick={handleSeed}>התחל זריעה</Button>
              </div>
            </div>
          )}

          {status === "running" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{progress || "מתחיל..."}</p>
            </div>
          )}

          {status === "done" && report && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold">הזריעה הושלמה בהצלחה!</span>
              </div>
              <div className="text-sm space-y-1 font-mono">
                {[
                  ["שכונות",         report.neighborhoods],
                  ["אוהלים",         report.tents],
                  ["מיטות",          report.beds],
                  ["אזורי שירותים",  report.facilityAreas],
                  ["מתקנים",         report.facilities],
                  ["מרחבי פעילות",   report.activitySpaces],
                ].map(([label, r]) => (
                  <p key={label}>
                    ✅ {label}: {r?.total ?? r} סה״כ
                    {r?.created != null && <span className="text-emerald-600"> (+{r.created} נוצרו</span>}
                    {r?.updated != null && <span className="text-slate-500">, {r.updated} עודכנו)</span>}
                  </p>
                ))}
              </div>
              <Button className="w-full" onClick={() => { setOpen(false); setStatus("idle"); }}>
                סגור
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="space-y-4">
              <p className="text-sm text-red-600">שגיאה: {error}</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setOpen(false)}>סגור</Button>
                <Button variant="destructive" onClick={handleSeed}>נסה שוב</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}