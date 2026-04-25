import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Send, CheckCircle, XCircle, Clock } from "lucide-react";
import QuoteStatusBadge from "./QuoteStatusBadge";

/**
 * Allowed transitions per the documented quote lifecycle:
 *  DRAFT  → SENT
 *  SENT   → APPROVED | REJECTED | EXPIRED
 */
const TRANSITIONS = {
  DRAFT: [
    { next: "SENT",     label: "סמן כנשלח",   icon: Send,         variant: "outline" },
  ],
  SENT: [
    { next: "APPROVED", label: "אשר הצעה",     icon: CheckCircle,  variant: "default"     },
    { next: "REJECTED", label: "דחה הצעה",     icon: XCircle,      variant: "destructive" },
    { next: "EXPIRED",  label: "פג תוקף",      icon: Clock,        variant: "outline"     },
  ],
};

/**
 * Build the snapshot captured at APPROVED time.
 * Contains the commercial truth for the guest-form flow later.
 */
function buildSnapshot(quote, group) {
  // Calculate nights from stored dates (quote.nights field is never persisted)
  const calcedNights = (() => {
    if (!quote.arrival_date || !quote.departure_date) return 0;
    return Math.max(0, Math.round((new Date(quote.departure_date) - new Date(quote.arrival_date)) / 86400000));
  })();

  return JSON.stringify({
    capturedAt:    new Date().toISOString(),
    // group context
    groupName:     group?.group_name     || "",
    groupType:     group?.group_type     || "",
    startDate:     quote.arrival_date    || "",
    endDate:       quote.departure_date  || "",
    nights:        calcedNights,
    // headcounts
    totalPax:      quote.estimated_pax   || 0,
    staffTotal:    quote.staff_count     || 0,
    studentsTotal: quote.participant_count || 0,
    // client info
    clientName:    quote.client_name     || "",
    clientPhone:   quote.client_phone    || "",
    clientEmail:   quote.client_email    || "",
    clientTaxId:   quote.client_tax_id   || "",
    // pricing (line item detail for PDF)
    subtotal:        quote.subtotal        || 0,
    discount_percent: quote.discount_percent || 0,
    discount_amount: quote.discount_amount  || 0,
    total_price:     quote.total_price      || 0,
    advance_payment: quote.advance_payment  || 0,
    balance_payment: quote.balance_payment  || 0,
  });
}

export default function QuoteStatusActions({ quote, group, onUpdated }) {
  const [loading, setLoading] = useState(false);

  const transitions = TRANSITIONS[quote.status] || [];
  if (transitions.length === 0) return null;

  const handleTransition = async (nextStatus) => {
    setLoading(true);

    const quoteUpdate = { status: nextStatus };

    if (nextStatus === "APPROVED") {
      quoteUpdate.snapshot = buildSnapshot(quote, group);
    }

    // 1. Update the quote status (+ snapshot if APPROVED)
    await base44.entities.Quote.update(quote.id, quoteUpdate);

    // 2. On APPROVED: set Group.status = CONFIRMED
    if (nextStatus === "APPROVED" && group) {
      await base44.entities.Group.update(group.id, { status: "CONFIRMED" });
    }

    setLoading(false);
    onUpdated();
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <QuoteStatusBadge status={quote.status} />
      {transitions.map(({ next, label, icon: Icon, variant }) => (
        <Button
          key={next}
          size="sm"
          variant={variant}
          disabled={loading}
          onClick={() => handleTransition(next)}
          className="gap-1.5 text-xs h-7"
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </Button>
      ))}
    </div>
  );
}