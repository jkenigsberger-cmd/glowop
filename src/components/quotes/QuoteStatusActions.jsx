import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Send, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import QuoteStatusBadge from "./QuoteStatusBadge";
import ApprovalCapacityDialog from "./ApprovalCapacityDialog";
import RoleGate from "@/components/RoleGate";

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
  const [capacityWarnings, setCapacityWarnings] = useState(null); // non-null = dialog open
  const [pendingApproval, setPendingApproval] = useState(false);

  const transitions = TRANSITIONS[quote.status] || [];
  if (transitions.length === 0) return null;

  const doApprove = async (overrideWarning, overrideReason) => {
    setLoading(true);
    setCapacityWarnings(null);

    const quoteUpdate = {
      status: "APPROVED",
      snapshot: buildSnapshot(quote, group),
    };
    await base44.entities.Quote.update(quote.id, quoteUpdate);

    // ── Create / update OperationalGroupProfile + confirm group ───────────
    const targetGroupId = group?.id || quote.group_id;
    if (targetGroupId) {
      try {
        const profileRes = await base44.functions.invoke("createOrUpdateOperationalGroupProfile", {
          group_id: targetGroupId,
          quote_id: quote.id,
        });
        if (!profileRes.data?.success) {
          const errMsg = profileRes.data?.error || "שגיאה לא ידועה";
          toast.warning(`ההצעה אושרה אך הפרופיל התפעולי לא נוצר: ${errMsg}`);
        }
      } catch (profileErr) {
        console.error("[QuoteStatusActions] createOrUpdateOperationalGroupProfile failed:", profileErr?.message);
        toast.warning("ההצעה אושרה אך הפרופיל התפעולי לא נוצר. יש לבדוק את הקבוצה.");
      }
    }

    // Create or update OperationalHold
    const hasMeals = !!group && group.group_type === "LODGING";
    const hasActivities = (() => {
      try { return JSON.parse(quote.workshop_lines || "[]").length > 0 || JSON.parse(quote.lecture_lines || "[]").length > 0; } catch { return false; }
    })();

    const holdPayload = {
      quote_id:    quote.id,
      group_id:    group?.id || quote.group_id,
      arrival_date:   quote.arrival_date,
      departure_date: quote.departure_date || quote.arrival_date,
      group_type:     group?.group_type || "LODGING",
      hold_type:      "SITE_GENERAL",
      total_pax:      Number(quote.estimated_pax) || 0,
      participant_count: Number(quote.participant_count) || 0,
      staff_count:    Number(quote.staff_count) || 0,
      includes_meals: hasMeals,
      includes_activities: hasActivities,
      status:   "ACTIVE",
      source:   "QUOTE_APPROVAL",
      override_capacity_warning: overrideWarning,
      override_reason: overrideReason || "",
      created_at: new Date().toISOString(),
    };

    // Prevent duplicates: check for existing ACTIVE hold for this quote
    const existing = await base44.entities.OperationalHold.filter({ quote_id: quote.id });
    const activeHold = existing.find(h => h.status === "ACTIVE");
    if (activeHold) {
      await base44.entities.OperationalHold.update(activeHold.id, holdPayload);
    } else {
      await base44.entities.OperationalHold.create(holdPayload);
    }

    setLoading(false);
    onUpdated();
  };

  const handleTransition = async (nextStatus) => {
    if (nextStatus !== "APPROVED") {
      // Non-approval transitions: just update status
      setLoading(true);
      await base44.entities.Quote.update(quote.id, { status: nextStatus });
      setLoading(false);
      onUpdated();
      return;
    }

    // Approval: run capacity check first
    setPendingApproval(true);
    try {
      const res = await base44.functions.invoke("checkSiteAvailability", {
        arrival_date:    quote.arrival_date,
        departure_date:  quote.departure_date || quote.arrival_date,
        total_pax:       Number(quote.estimated_pax) || 0,
        group_type:      group?.group_type || "LODGING",
        includes_meals:  (group?.group_type || "LODGING") === "LODGING",
        exclude_quote_id: quote.id,
      });
      const warnings = res.data?.warnings || [];
      if (warnings.length > 0) {
        setCapacityWarnings(warnings);
      } else {
        await doApprove(false, "");
      }
    } catch {
      // If check fails, proceed without blocking
      await doApprove(false, "");
    }
    setPendingApproval(false);
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <QuoteStatusBadge status={quote.status} />
        <RoleGate permission="APPROVE_QUOTE">
          {transitions.map(({ next, label, icon: Icon, variant }) => (
            <Button
              key={next}
              size="sm"
              variant={variant}
              disabled={loading || pendingApproval}
              onClick={() => handleTransition(next)}
              className="gap-1.5 text-xs h-7"
            >
              <Icon className="w-3.5 h-3.5" />
              {pendingApproval && next === "APPROVED" ? "בודק..." : label}
            </Button>
          ))}
        </RoleGate>
      </div>

      {capacityWarnings && (
        <ApprovalCapacityDialog
          warnings={capacityWarnings}
          onConfirm={(reason) => doApprove(true, reason)}
          onCancel={() => setCapacityWarnings(null)}
        />
      )}
    </>
  );
}