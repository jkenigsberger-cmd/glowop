import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Reusable search bar component used across pages.
 * Props:
 *   value: string
 *   onChange: (val: string) => void
 *   placeholder: string
 *   className?: string
 */
export default function SearchBar({ value, onChange, placeholder, className }) {
  return (
    <div className={cn("relative flex items-center", className)}>
      <Search className="absolute right-3 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || "חיפוש..."}
        className="w-full pr-9 pl-8 py-2 text-sm border border-slate-200 rounded-lg bg-white placeholder:text-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute left-2.5 text-slate-400 hover:text-slate-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}