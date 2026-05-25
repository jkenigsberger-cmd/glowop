import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import QuotePdfTemplate from "./QuotePdfTemplate";

const LOGO_URL   = "https://media.base44.com/images/public/69ea08de3791d203c52ea3cc/107796e98_quote-logo.png";
const FOOTER_URL = "https://media.base44.com/images/public/69ea08de3791d203c52ea3cc/c500ec249_quote-footer-photo.jpg";

async function toBase64(url) {
  try {
    const res = await fetch(url, { cache: "force-cache" });
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url; // fallback to original URL if fetch fails
  }
}

/**
 * QuotePdfButton
 * Pre-fetches logo & footer image as base64 data URIs so they render
 * correctly in print/PDF for ALL users regardless of browser cache.
 */
export default function QuotePdfButton({ quote, group, size = "sm" }) {
  const [printing, setPrinting] = useState(false);
  const [logoBase64, setLogoBase64] = useState(null);
  const [footerBase64, setFooterBase64] = useState(null);

  const handlePrint = async () => {
    setPrinting(true);
    // Pre-fetch both images as base64 before rendering the template
    const [logo, footer] = await Promise.all([toBase64(LOGO_URL), toBase64(FOOTER_URL)]);
    setLogoBase64(logo);
    setFooterBase64(footer);
    // Let the portal with embedded images render, then print
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrinting(false);
        setLogoBase64(null);
        setFooterBase64(null);
      }, 800);
    }, 400);
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
            <QuotePdfTemplate quote={quote} group={group} logoUrl={logoBase64} footerUrl={footerBase64} />
          </div>
        </>,
        document.body
      )}
    </>
  );
}