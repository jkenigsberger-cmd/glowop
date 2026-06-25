/**
 * LocationDetail — shows open + history issues for a SiteLocation, plus new-issue button.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ChevronRight, Plus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import IssueCard from "./IssueCard";
import NewIssueModal from "./NewIssueModal";

const SECTIONS_CONFIG = [
  { types: ["NEIGHBORHOOD_TENT"], iconBg: "bg-emerald-100" },
  { types: ["BATHROOM"],          iconBg: "bg-blue-100" },
  { types: ["SHOWER"],            iconBg: "bg-cyan-100" },
  { types: ["VIP_TENT","VIP_BATHROOM","VIP_SHOWER"], iconBg: "bg-purple-100" },
  { types: ["COMMON_SPACE"],      iconBg: "bg-amber-100" },
];

const OPEN_STATUSES  = ["OPEN", "IN_PROGRESS", "WAITING_PARTS"];
const CLOSED_STATUSES = ["DONE", "CANCELLED"];

export default function LocationDetail({ location, user, canEdit, onBack }) {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const sec = SECTIONS_CONFIG.find(s => s.types.includes(location.location_type));

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ["maintenanceIssues", location.id],
    queryFn: () => base44.entities.MaintenanceIssue.filter({ site_location_id: location.id }, "-created_date", 100),
    staleTime: 30_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["maintenanceIssues", location.id] });

  const openIssues   = issues.filter(i => OPEN_STATUSES.includes(i.status));
  const closedIssues = issues.filter(i => CLOSED_STATUSES.includes(i.status));

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronRight className="w-4 h-4" /> חזרה
      </button>

      {/* Location header */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {sec && (
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${sec.iconBg} shrink-0`}>
                <Wrench className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-bold text-base leading-tight">{location.display_name}</h2>
              {location.section && <p className="text-xs text-muted-foreground">{location.section}</p>}
            </div>
          </div>
          {canEdit && (
            <Button size="sm" onClick={() => setShowModal(true)} className="gap-1.5 shrink-0">
              <Plus className="w-3.5 h-3.5" /> פתח תקלה
            </Button>
          )}
        </div>
      </div>

      {/* Open issues */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          תקלות פתוחות
          {openIssues.length > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {openIssues.length}
            </span>
          )}
        </h3>

        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && openIssues.length === 0 && (
          <div className="border border-dashed border-slate-200 rounded-xl p-5 text-center space-y-2">
            <Wrench className="w-7 h-7 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-400">אין תקלות פתוחות</p>
            {canEdit && (
              <button
                onClick={() => setShowModal(true)}
                className="text-xs text-primary hover:underline"
              >
                דווח על תקלה
              </button>
            )}
          </div>
        )}

        {openIssues.map(issue => (
          <IssueCard key={issue.id} issue={issue} canEdit={canEdit} onUpdated={refresh} />
        ))}
      </div>

      {/* History */}
      {closedIssues.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowHistory(h => !h)}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
          >
            היסטוריה ({closedIssues.length})
            <ChevronRight className={`w-4 h-4 transition-transform ${showHistory ? "rotate-90" : ""}`} />
          </button>
          {showHistory && closedIssues.map(issue => (
            <IssueCard key={issue.id} issue={issue} canEdit={false} onUpdated={refresh} />
          ))}
        </div>
      )}

      {showModal && (
        <NewIssueModal
          location={location}
          user={user}
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); refresh(); }}
        />
      )}
    </div>
  );
}