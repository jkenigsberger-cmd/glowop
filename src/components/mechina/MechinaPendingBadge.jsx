import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Fetches PENDING CommonSpaceBookingRequest count once on mount,
 * then refreshes every 60 seconds. Renders a red badge if count > 0.
 * Only shown to admin roles — caller is responsible for role-gating.
 */
export default function MechinaPendingBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      try {
        const [pending, cancellationReqs] = await Promise.all([
          base44.entities.CommonSpaceBookingRequest.filter({ status: "PENDING" }),
          base44.entities.CommonSpaceBookingRequest.filter({ status: "CANCELLATION_REQUESTED" }),
        ]);
        if (!cancelled) setCount(pending.length + cancellationReqs.length);
      } catch {
        // silently ignore
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (count === 0) return null;

  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none">
      {count}
    </span>
  );
}