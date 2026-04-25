import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import QuotePdfTemplate from "./QuotePdfTemplate";

/**
 * QuotePdfButton
 * Renders a hidden A4 template into the DOM, then triggers window.print().
 * A <style> tag scoped to @media print ensures only the template is printed.
 */
export default function QuotePdfButton({ quote, group, size = "sm" }) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = () => {
    setPrinting(true);
    // Let the portal render first, then print
    setTimeout(() => {
      window.print();
      // Brief delay before unmounting to ensure print dialog opened
      setTimeout(() => setPrinting(false), 800);
    }, 300);
  };

  return (
    <>
      <Button
        size={size}
        variant="outline"
        onClick={handlePrint}
        disabled={printing}
        className="gap-1.5"
      >
        <FileDown className="w-3.5 h-3.5" />
        {printing ? "מכין..." : "הורדת הצעה PDF"}
      </Button>

      {/* Print styles injected globally */}
      {printing && createPortal(
        <>
          <style>{`
            @media print {
              body > *:not(#quote-pdf-portal) { display: none !important; }
              #quote-pdf-portal { display: block !important; }
              @page { size: A4; margin: 0; }
            }
            @media screen {
              #quote-pdf-portal { display: none; }
            }
          `}</style>
          <div id="quote-pdf-portal">
            <QuotePdfTemplate quote={quote} group={group} />
          </div>
        </>,
        document.body
      )}
    </>
  );
}