import { useState } from "react";
import TentDrillDown from "./TentDrillDown";
import { ChevronDown, ChevronUp, Star } from "lucide-react";

export default function NeighborhoodSection({ neighborhood, tents, beds, isAdmin, onDataChange }) {
  const [expanded, setExpanded] = useState(false);

  const neighborhoodTents = tents.filter((t) => t.neighborhood_id === neighborhood.id);
  const totalBeds = neighborhoodTents.reduce((sum, t) => sum + (beds.filter(b => b.tent_id === t.id).length), 0);

  return (
    <div className="border border-border rounded-xl overflow-hidden shadow-sm" dir="rtl">
      <button
        className="w-full flex items-center justify-between px-5 py-4 bg-card hover:bg-muted/30 transition-colors text-right"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {neighborhood.is_vip && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
          <h3 className="font-bold text-base">{neighborhood.name}</h3>
          <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">{neighborhood.code}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{neighborhoodTents.length} אוהלים</span>
          <span>{totalBeds} מיטות</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-4 bg-muted/10 border-t border-border space-y-2">
          {neighborhoodTents
            .sort((a, b) => a.code.localeCompare(b.code, "he"))
            .map((tent) => (
              <TentDrillDown
                key={tent.id}
                tent={tent}
                beds={beds.filter((b) => b.tent_id === tent.id)}
                isAdmin={isAdmin}
                onDataChange={onDataChange}
              />
            ))}
        </div>
      )}
    </div>
  );
}