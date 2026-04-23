import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { WorkingStatusBadge } from "./StatusBadge";
import EditStatusModal from "./EditStatusModal";
import { Pencil, Shield, UtensilsCrossed, Tent } from "lucide-react";

const TYPE_CONFIG = {
  BUNKER: { label: 'ממ"ד', icon: Shield, color: "text-slate-600" },
  OHEL_MOED: { label: "אוהל מועד", icon: Tent, color: "text-emerald-600" },
  DINING_HALL: { label: "חדר אוכל", icon: UtensilsCrossed, color: "text-orange-600" },
};

export default function ActivitySpacesPanel({ spaces, isAdmin, onDataChange }) {
  const [editTarget, setEditTarget] = useState(null);

  const handleSave = async (id, updates) => {
    await base44.entities.ActivitySpace.update(id, updates);
    onDataChange?.();
  };

  return (
    <div dir="rtl">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {spaces
          .sort((a, b) => a.code.localeCompare(b.code))
          .map((space) => {
            const config = TYPE_CONFIG[space.space_type] || TYPE_CONFIG.BUNKER;
            const Icon = config.icon;
            return (
              <div key={space.id} className="bg-card border border-border rounded-xl px-4 py-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${config.color}`} />
                    <div>
                      <p className="font-semibold text-sm">{space.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{space.code}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setEditTarget(space)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <WorkingStatusBadge status={space.working_status} />
                  <span className={`text-xs px-1.5 py-0.5 rounded border bg-muted border-border text-muted-foreground`}>
                    {config.label}
                  </span>
                  {space.capacity && (
                    <span className="text-xs px-1.5 py-0.5 rounded border bg-muted border-border text-muted-foreground">
                      {space.capacity} מקומות
                    </span>
                  )}
                </div>
                {!space.is_bookable && (
                  <p className="text-xs text-red-500">לא פעיל להזמנה</p>
                )}
              </div>
            );
          })}
      </div>

      {editTarget && (
        <EditStatusModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          entity={editTarget}
          entityType="space"
          onSave={handleSave}
        />
      )}
    </div>
  );
}