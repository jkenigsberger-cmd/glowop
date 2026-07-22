import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const money = value => `₪${Math.round(Number(value) || 0).toLocaleString("he-IL")}`;
export default function QuoteOptionApprovalDialog({ quote, open, onClose, onConfirm }) {
  const [options, setOptions] = useState([]); const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (!open) return; setLoading(true); setError(""); setSelected(""); base44.entities.QuoteOption.filter({ quote_id: quote.id }).then(rows => { const a = rows.filter(row => row.option_key === "A"); const b = rows.filter(row => row.option_key === "B"); if (rows.length !== 2 || a.length !== 1 || b.length !== 1) throw new Error("INVALID_OPTION_CARDINALITY"); setOptions([a[0], b[0]]); }).catch(() => { setOptions([]); setError("לא ניתן לטעון שתי אפשרויות תקינות"); }).finally(() => setLoading(false)); }, [open, quote.id]);
  const confirm = async () => { if (!selected || submitting || error) return; setSubmitting(true); try { await onConfirm(selected); } catch { setError("אישור ההצעה נכשל"); } finally { setSubmitting(false); } };
  return <Dialog open={open} onOpenChange={onClose}><DialogContent dir="rtl" className="max-w-md"><DialogHeader><DialogTitle className="text-right">איזו אפשרות אושרה?</DialogTitle></DialogHeader><div className="space-y-3">{loading && <p className="text-sm text-muted-foreground">טוען אפשרויות...</p>}{error && <p className="text-sm text-destructive">{error}</p>}{!loading && !error && options.map(option => <label key={option.id} className="flex cursor-pointer items-center justify-between rounded-xl border p-3"><span className="flex items-center gap-2"><input type="radio" name="approved-option" checked={selected === option.option_key} onChange={() => setSelected(option.option_key)} />{option.label}</span><strong>{money(option.total_price)}</strong></label>)}<Button className="w-full" disabled={!selected || loading || submitting || Boolean(error)} onClick={confirm}>{submitting ? "מאשר..." : "אשר הצעה והפעל קבוצה"}</Button></div></DialogContent></Dialog>;
}