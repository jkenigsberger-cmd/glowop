import { useState, useMemo } from "react";
import ReactDOM from "react-dom";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { buildChronologicalDayEvents } from "@/components/calendar/ChronologicalDayView";
import ChronologicalDayPrintTemplate from "@/components/calendar/ChronologicalDayPrintTemplate";

export default function ChronologicalDayPdfButton({ dateStr, allGroups, allMeals, allActivities, allCoffeeRequests, allSpaces }) {
  const [printing, setPrinting] = useState(false);

  const groupMap = useMemo(
    () => Object.fromEntries((allGroups || []).map((g) => [g.id, g])),
    [allGroups]
  );
  const spaceMap = useMemo(
    () => Object.fromEntries((allSpaces || []).map((s) => [s.id, s])),
    [allSpaces]
  );
  const activeCoffeeKeys = useMemo(() => {
    const keys = new Set();
    (allCoffeeRequests || []).forEach((r) => { if (r.status === "ACTIVE") keys.add(`${r.group_id}|${r.date}`); });
    return keys;
  }, [allCoffeeRequests]);

  const events = useMemo(
    () => buildChronologicalDayEvents({ dateStr, allGroups, allMeals, allActivities, allCoffeeRequests, activeCoffeeKeys }).map((e) => ({
      ...e,
      group_name: e.group_name || groupMap[e.group_id]?.group_name || null,
    })),
    [dateStr, allGroups, allMeals, allActivities, allCoffeeRequests, activeCoffeeKeys, groupMap]
  );

  const handlePrint = () => {
    setPrinting(true);
    const container = document.createElement("div");
    container.id = "chrono-print-root";
    document.body.appendChild(container);

    ReactDOM.render(
      <ChronologicalDayPrintTemplate dateStr={dateStr} events={events} groupMap={groupMap} spaceMap={spaceMap} />,
      container,
      () => {
        const style = document.createElement("style");
        style.innerHTML = `
          @media print {
            body > *:not(#chrono-print-root) { display: none !important; }
            #chrono-print-root { display: block !important; }
          }
        `;
        document.head.appendChild(style);
        window.print();
        setTimeout(() => {
          document.body.removeChild(container);
          document.head.removeChild(style);
          setPrinting(false);
        }, 500);
      }
    );
  };

  if (events.length === 0) return null;

  return (
    <Button variant="outline" size="sm" onClick={handlePrint} disabled={printing} className="gap-1.5">
      <Download className="w-3.5 h-3.5" />
      {printing ? "מכין..." : "ייצוא PDF"}
    </Button>
  );
}