/**
 * QuoteSyncButton
 * Shows a diff preview and lets admin sync accepted Quote data into an existing Group.
 * Visible only when:
 *  - Quote is APPROVED
 *  - Quote has a linked group_id
 *  - At least one field differs between Quote and Group/OGP
 */
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import RoleGate from "@/components/RoleGate";

function fmtDate(d) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return d; }
}

function buildDiff(quote, group) {
  const diffs = [];

  const totalPax = Number(quote.estimated_pax || 0) || null;
  const staffCount = Number(quote.staff_count || 0) || null;
  const participantCount = totalPax != null && staffCount != null ? Math.max(0, totalPax - staffCount) : null;

  if (quote.client_name && quote.client_name !== group.contact_name)
    diffs.push({ label: "איש קשר", from: group.contact_name || "—", to: quote.client_name });
  if (quote.client_phone && quote.client_phone !== group.contact_phone)
    diffs.push({ label: "טלפון", from: group.contact_phone || "—", to: quote.client_phone });
  if (quote.client_email && quote.client_email !== group.contact_email)
    diffs.push({ label: "אימייל", from: group.contact_email || "—", to: quote.client_email });
  if (quote.arrival_date && quote.arrival_date !== group.arrival_date)
    diffs.push({ label: "תאריך הגעה", from: fmtDate(group.arrival_date), to: fmtDate(quote.arrival_date) });
  if (quote.departure_date && quote.departure_date !== group.departure_date)
    diffs.push({ label: "תאריך עזיבה", from: fmtDate(group.departure_date), to: fmtDate(quote.departure_date) });
  if (totalPax != null && totalPax !== group.total_pax)
    diffs.push({ label: "סה״כ משתתפים", from: group.total_pax ?? "—", to: totalPax });
  if (staffCount != null && staffCount !== group.staff_count)
    diffs.push({ label: "צוות", from: group.staff_count ?? "—", to: staffCount });
  if (participantCount != null && participantCount !== group.participant_count)
    diffs.push({ label: "חניכים", from: group.participant_count ?? "—", to: participantCount });

  return diffs;
}

export default function QuoteSyncButton({ quote, group, profile, onSynced }) {
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [blockError, setBlockError] = useState(null);

  if (!quote || quote.status !== "APPROVED" || !group) return null;

  // Hide if this quote originally created the group (OGP.quote_id === quote.id)
  if (profile?.quote_id && profile.quote_id === quote.id) return null;

  const diffs = buildDiff(quote, group);
  if (diffs.length === 0) return null;

  // Warn if pax changes but boys+girls no longer matches new participant_count
  const totalPaxNew = Number(quote.estimated_pax || 0) || null;
  const staffCountNew = Number(quote.staff_count || 0) || null;
  const participantCountNew = totalPaxNew != null && staffCountNew != null
    ? Math.max(0, totalPaxNew - staffCountNew) : null;
  const boysCount  = group.boys_count  ?? 0;
  const girlsCount = group.girls_count ?? 0;
  const paxChanges = participantCountNew != null && participantCountNew !== group.participant_count;
  const genderMismatch = paxChanges && group.group_type === "LODGING"
    && participantCountNew != null && (boysCount + girlsCount) !== participantCountNew;

  const handleSync = async () => {
    setSyncing(true);
    setBlockError(null);
    const res = await base44.functions.invoke("syncQuoteToOperationalGroup", {
      quote_id: quote.id,
      group_id: group.id,
    });
    setSyncing(false);
    if (res.data?.success) {
      toast.success("הנתונים סונכרנו בהצלחה מההצעה לקבוצה");
      setOpen(false);
      onSynced?.();
    } else {
      setBlockError(res.data?.error || "שגיאה לא ידועה בסנכרון");
    }
  };

  return (
    <RoleGate roles={["admin", "ADMIN", "SUPER_ADMIN", "OPERATIONS"]}>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 text-xs h-7 border-amber-400 text-amber-700 hover:bg-amber-50"
        onClick={() => { setBlockError(null); setOpen(true); }}
      >
        <RefreshCw className="w-3.5 h-3.5" />
        סנכרן נתוני הצעה לקבוצה
      </Button>

      {open && (
        <Dialog open onOpenChange={() => setOpen(false)}>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-right">סנכרון נתוני הצעה לקבוצה</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground text-xs">
                השדות הבאים ישתנו בקבוצה ובפרופיל התפעולי:
              </p>

              <div className="border border-border rounded-lg divide-y divide-border">
                {diffs.map((d, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 gap-4">
                    <span className="font-medium text-xs text-muted-foreground w-28 shrink-0">{d.label}</span>
                    <span className="text-xs text-red-600 line-through">{d.from}</span>
                    <span className="text-xs">→</span>
                    <span className="text-xs text-green-700 font-semibold">{d.to}</span>
                  </div>
                ))}
              </div>

              {genderMismatch && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 whitespace-pre-line">
                  ⚠️ ההצעה משנה את כמות החניכים, אך אין בה חלוקת בנים/בנות תואמת.
{`יש לעדכן את חלוקת בנים/בנות בעריכת הקבוצה לפני הסנכרון.`}
                </div>
              )}

              {blockError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 whitespace-pre-line">
                  ⛔ {blockError}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                שיבוצי לינה קיימים לא יושפעו. במידה וקיימים שיבוצים פעילים ומספר המשתתפים משתנה, תיווצר התראה לצוות השיבוץ.
              </p>

              <div className="flex gap-2 justify-end pt-1">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>ביטול</Button>
                <Button
                  size="sm"
                  disabled={syncing || genderMismatch}
                  onClick={handleSync}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {syncing ? "מסנכרן..." : "אשר וסנכרן"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </RoleGate>
  );
}