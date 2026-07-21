import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const money = value => `₪${Math.round(Number(value) || 0).toLocaleString("he-IL")}`;
export default function QuoteOptionApprovalDialog({ quote, open, onClose, onConfirm }) {
  const [options, setOptions] = useState([]); const [selected, setSelected] = useState("");
  useEffect(() => { if (open) base44.entities.QuoteOption.filter({ quote_id: quote.id }).then(rows => setOptions(rows.sort((a,b) => a.display_order - b.display_order))); }, [open, quote.id]);
  return <Dialog open={open} onOpenChange={onClose}><DialogContent dir="rtl" className="max-w-md"><DialogHeader><DialogTitle className="text-right">איזו אפשרות אושרה?</DialogTitle></DialogHeader><div className="space-y-3">{options.map(option => <label key={option.id} className="flex cursor-pointer items-center justify-between rounded-xl border p-3"><span className="flex items-center gap-2"><input type="radio" name="approved-option" checked={selected === option.option_key} onChange={() => setSelected(option.option_key)} />{option.label}</span><strong>{money(option.total_price)}</strong></label>)}<Button className="w-full" disabled={!selected} onClick={() => onConfirm(selected)}>אשר הצעה והפעל קבוצה</Button></div></DialogContent></Dialog>;
}