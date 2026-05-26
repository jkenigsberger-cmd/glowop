import { useState } from "react";
import ReactDOM from "react-dom";
import { Button } from "@/components/ui/button";
import CleaningHoursPrintTemplate from "./CleaningHoursPrintTemplate";

export default function CleaningHoursPrintButton({ shifts, range }) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = () => {
    setPrinting(true);
    const container = document.createElement("div");
    container.id = "cleaning-print-container";
    document.body.appendChild(container);

    ReactDOM.render(
      <CleaningHoursPrintTemplate shifts={shifts} from={range.from} to={range.to} />,
      container,
      () => {
        const style = document.createElement("style");
        style.innerHTML = `
          @media print {
            body > *:not(#cleaning-print-container) { display: none !important; }
            #cleaning-print-container { display: block !important; }
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

  return (
    <Button variant="outline" size="sm" onClick={handlePrint} disabled={printing}>
      {printing ? "מכין..." : "🖨️ הדפס דוח"}
    </Button>
  );
}