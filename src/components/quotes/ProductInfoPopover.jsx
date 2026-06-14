import { useState } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function ProductInfoPopover({ pkg }) {
  if (!pkg) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-slate-400 hover:text-primary transition-colors"
          title="פרטים על המוצר"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-72 text-right" dir="rtl">
        <div className="space-y-2 text-xs">
          <div className="font-bold text-slate-800 text-sm">{pkg.name}</div>
          {pkg.target_audience && (
            <div>
              <span className="font-semibold text-slate-600">קהל יעד: </span>
              <span className="text-slate-500">{pkg.target_audience}</span>
            </div>
          )}
          {pkg.content_includes && (
            <div>
              <span className="font-semibold text-slate-600">כולל: </span>
              <span className="text-slate-500">{pkg.content_includes}</span>
            </div>
          )}
          {pkg.pricing_note && (
            <div>
              <span className="font-semibold text-slate-600">מחיר: </span>
              <span className="text-slate-500">{pkg.pricing_note}</span>
            </div>
          )}
          {pkg.description && (
            <div className="text-slate-400 border-t border-slate-100 pt-1.5">{pkg.description}</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}