import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRoleContext } from "@/lib/RoleContext";
import {
  SNAPSHOT_CHECK_EVENT,
  dateInJerusalem,
  finalizeYesterdaySnapshot,
  snapshotCheckKey,
  yesterdayInJerusalem,
} from "@/lib/operationalSnapshotFallback";

const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);

export default function AuthenticatedSnapshotFallback() {
  const { role, isLoadingRole } = useRoleContext();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isLoadingRole || !ADMIN_ROLES.has(role)) return;

    const ensureYesterday = async () => {
      if (document.visibilityState === "hidden") return;
      const today = dateInJerusalem();
      const key = snapshotCheckKey(today);
      if (sessionStorage.getItem(key)) return;

      sessionStorage.setItem(key, "running");
      const yesterday = yesterdayInJerusalem();
      try {
        await finalizeYesterdaySnapshot();
        await queryClient.invalidateQueries({ queryKey: ["operationalDaySnapshot", yesterday] });
      } catch {
        // This fallback must never block or disrupt the operational app.
      } finally {
        sessionStorage.setItem(key, "done");
        window.dispatchEvent(new CustomEvent(SNAPSHOT_CHECK_EVENT, { detail: { date: yesterday } }));
      }
    };

    ensureYesterday();
    document.addEventListener("visibilitychange", ensureYesterday);
    return () => document.removeEventListener("visibilitychange", ensureYesterday);
  }, [isLoadingRole, role, queryClient]);

  return null;
}