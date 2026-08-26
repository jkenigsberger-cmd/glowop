import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useRoleContext } from "@/lib/RoleContext";
import {
  SNAPSHOT_CHECK_EVENT,
  dateInJerusalem,
  finalizeYesterdaySnapshot,
  snapshotCheckKey,
  yesterdayInJerusalem,
} from "@/lib/operationalSnapshotFallback";

export default function YesterdaySnapshotWarning() {
  const { role } = useRoleContext();
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const yesterday = yesterdayInJerusalem();
  const [checkComplete, setCheckComplete] = useState(() => sessionStorage.getItem(snapshotCheckKey(dateInJerusalem())) === "done");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const onComplete = event => {
      if (event.detail?.date === yesterday) setCheckComplete(true);
    };
    window.addEventListener(SNAPSHOT_CHECK_EVENT, onComplete);
    return () => window.removeEventListener(SNAPSHOT_CHECK_EVENT, onComplete);
  }, [yesterday]);

  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ["operationalDaySnapshot", yesterday],
    queryFn: () => base44.entities.OperationalDaySnapshot.filter({ date: yesterday }),
    enabled: isAdmin && checkComplete,
  });

  const saveNow = async () => {
    setSaving(true);
    try {
      await finalizeYesterdaySnapshot();
      await queryClient.invalidateQueries({ queryKey: ["operationalDaySnapshot", yesterday] });
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin || !checkComplete || isLoading || snapshots.length > 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900" dir="rtl">
      <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />נתוני אתמול עדיין לא נשמרו כהיסטוריה</span>
      <Button type="button" size="sm" variant="outline" disabled={saving} onClick={saveNow} className="shrink-0 border-amber-400 bg-transparent">
        {saving ? "שומר…" : "שמור את נתוני אתמול עכשיו"}
      </Button>
    </div>
  );
}