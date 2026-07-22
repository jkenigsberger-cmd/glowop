import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import QuotePdfTemplate from "./QuotePdfTemplate";
import QuoteCombinedPdfTemplate from "./QuoteCombinedPdfTemplate";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { base44 } from "@/api/base44Client";
import { getEffectiveQuoteForOption } from "@/lib/quoteOptions";
import { useRoleContext } from "@/lib/RoleContext";
import { isQuoteMultiOptionEnabled } from "@/lib/quoteMultiOption";
import { toast } from "sonner";

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
  const { role } = useRoleContext();
  const multiOptionEnabled = isQuoteMultiOptionEnabled(role);
  const [printing, setPrinting] = useState(false);
  const [logoBase64, setLogoBase64] = useState(null);
  const [footerBase64, setFooterBase64] = useState(null);
  const [printMode, setPrintMode] = useState("A");
  const [printQuote, setPrintQuote] = useState(quote);
  const [combinedQuotes, setCombinedQuotes] = useState(null);

  const handlePrint = async (mode = "A") => {
    if (printing) return;
    setPrinting(true);
    let optionA = quote; let optionB = null;
    try {
      if (multiOptionEnabled && quote.multi_option_enabled) {
        const rows = await base44.entities.QuoteOption.filter({ quote_id: quote.id });
        const a = rows.filter(row => row.option_key === "A"); const b = rows.filter(row => row.option_key === "B");
        if (rows.length !== 2 || a.length !== 1 || b.length !== 1) throw new Error("INVALID_OPTION_CARDINALITY");
        optionA = getEffectiveQuoteForOption(quote, a[0]); optionB = getEffectiveQuoteForOption(quote, b[0]);
      }
      setPrintMode(mode); setPrintQuote(mode === "B" ? optionB : optionA); setCombinedQuotes(optionB ? { A: optionA, B: optionB } : null);
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
        setCombinedQuotes(null);
      }, 800);
    }, 400);
    } catch {
      setPrinting(false); setCombinedQuotes(null); toast.error("הפקת ה-PDF נכשלה — לא נמצאו שתי אפשרויות תקינות");
    }
  };

  return (
    <>
      {multiOptionEnabled && quote.multi_option_enabled ? (
        <DropdownMenu><DropdownMenuTrigger asChild><Button size={size} variant="outline" disabled={printing} className="gap-1.5"><FileDown className="w-3.5 h-3.5" />{printing ? "מכין..." : "הפקת PDF ▾"}</Button></DropdownMenuTrigger><DropdownMenuContent align="end" dir="rtl"><DropdownMenuItem onClick={() => handlePrint("A")}>אפשרות א׳ בלבד</DropdownMenuItem><DropdownMenuItem onClick={() => handlePrint("B")}>אפשרות ב׳ בלבד</DropdownMenuItem><DropdownMenuItem onClick={() => handlePrint("COMBINED")}>שתי האפשרויות</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      ) : (
        <Button size={size} variant="outline" onClick={() => handlePrint("A")} disabled={printing} className="gap-1.5"><FileDown className="w-3.5 h-3.5" />{printing ? "מכין..." : "הורדת הצעה PDF"}</Button>
      )}

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
            {printMode === "COMBINED" && combinedQuotes
              ? <QuoteCombinedPdfTemplate optionA={combinedQuotes.A} optionB={combinedQuotes.B} group={group} logoUrl={logoBase64} footerUrl={footerBase64} />
              : <QuotePdfTemplate quote={printQuote} group={group} logoUrl={logoBase64} footerUrl={footerBase64} />}
          </div>
        </>,
        document.body
      )}
    </>
  );
}