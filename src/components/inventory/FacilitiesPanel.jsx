import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { WorkingStatusBadge } from "./StatusBadge";
import EditStatusModal from "./EditStatusModal";
import { ChevronDown, ChevronUp, Pencil, Droplets, Building2 } from "lucide-react";

const GENDER_LABEL = { MALE: "גברים", FEMALE: "נשים", UNISEX: "משותף" };

export default function FacilitiesPanel({ facilityAreas, facilities, isAdmin, onDataChange }) {
  const [expandedArea, setExpandedArea] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  const handleSave = async (id, updates) => {
    await base44.entities.Facility.update(id, updates);
    onDataChange?.();
  };

  return (
    <div className="space-y-3" dir="rtl">
      {facilityAreas
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((area) => {
          const areaFacilities = facilities.filter((f) => f.facility_area_id === area.id);
          const showers = areaFacilities.filter((f) => f.facility_type === "SHOWER").length;
          const toilets = areaFacilities.filter((f) => f.facility_type === "TOILET").length;
          const isOpen = expandedArea === area.id;

          return (
            <div key={area.id} className="border border-border rounded-xl overflow-hidden shadow-sm">
              <button
                className="w-full flex items-center justify-between px-5 py-4 bg-card hover:bg-muted/30 transition-colors text-right"
                onClick={() => setExpandedArea(isOpen ? null : area.id)}
              >
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-sm">{area.name}</h3>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">{GENDER_LABEL[area.gender]}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Droplets className="w-3 h-3" />{showers} מקלחות</span>
                  <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{toilets} תאים</span>
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isOpen && (
                <div className="px-4 py-3 bg-muted/10 border-t border-border">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {areaFacilities
                      .sort((a, b) => a.unit_number - b.unit_number)
                      .map((f) => (
                        <div key={f.id} className="bg-card border border-border rounded-lg px-3 py-2 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium truncate">{f.label}</span>
                            {isAdmin && (
                              <button
                                onClick={() => setEditTarget(f)}
                                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${f.facility_type === "SHOWER" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}>
                              {f.facility_type === "SHOWER" ? "מקלחת" : "שירותים"}
                            </span>
                            <WorkingStatusBadge status={f.working_status} />
                          </div>
                          {f.is_accessible && <span className="text-xs text-blue-600">♿ נגיש</span>}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

      {editTarget && (
        <EditStatusModal
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          entity={editTarget}
          entityType="facility"
          onSave={handleSave}
        />
      )}
    </div>
  );
}