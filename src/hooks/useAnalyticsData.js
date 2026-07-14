import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

const monthPayload = value => { const [year, month] = value.split("-").map(Number); return { year, month }; };
export default function useAnalyticsData(config, role) {
  const [state, setState] = useState({ data: null, comparison: null, loading: true, error: "" });
  useEffect(() => {
    if (role !== "SUPER_ADMIN") return;
    const load = async () => {
      setState({ data: null, comparison: null, loading: true, error: "" });
      try {
        let payload = monthPayload(config.monthA);
        if (config.mode === "range") {
          const start = monthPayload(config.rangeStart), end = monthPayload(config.rangeEnd);
          payload = { startYear: start.year, startMonth: start.month, endYear: end.year, endMonth: end.month };
        }
        const requests = [base44.functions.invoke("getAnalyticsData", payload)];
        if (config.mode === "compare") requests.push(base44.functions.invoke("getAnalyticsData", monthPayload(config.monthB)));
        const results = await Promise.all(requests);
        setState({ data: results[0].data, comparison: results[1]?.data || null, loading: false, error: "" });
      } catch (err) { setState({ data: null, comparison: null, loading: false, error: err?.response?.data?.error || err.message }); }
    };
    load();
  }, [config, role]);
  return state;
}