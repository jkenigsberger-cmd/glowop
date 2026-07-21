import { Check } from "lucide-react";
import { QUOTE_AUDIENCE_CONTENT, getQuoteAudienceContent } from "@/lib/quoteAudience";

export default function QuoteAudienceSelector({ value, onChange, error }) {
  const content = getQuoteAudienceContent(value);
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm px-5 py-4 space-y-3">
      <div className="text-sm font-semibold text-foreground">סוג הצעת המחיר</div>
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="סוג הצעת המחיר">
        {Object.entries(QUOTE_AUDIENCE_CONTENT).map(([id, option]) => {
          const selected = value === id;
          return (
            <button key={id} type="button" role="radio" aria-checked={selected} onClick={() => onChange(id)}
              className={`flex items-center justify-between rounded-xl border px-3 py-3 text-right text-sm font-medium transition-colors ${selected ? "border-primary bg-primary/5 text-primary" : "border-border bg-card text-foreground hover:border-primary/50"}`}>
              <span>{option.label}</span>
              {selected && <Check className="h-4 w-4" />}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-destructive">יש לבחור סוג הצעת מחיר</p>}
      {value && <div className="rounded-lg bg-muted px-3 py-2 text-center"><p className="text-xs font-semibold text-primary">{content.subtitle}</p><p className="mt-1 text-[11px] text-muted-foreground">{content.intro}</p></div>}
    </div>
  );
}