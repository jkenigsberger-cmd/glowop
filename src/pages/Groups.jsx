import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, parseISO, isPast, isToday } from "date-fns";
import { Users, Plus, AlertTriangle, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import GroupFormModal from "@/components/groups/GroupFormModal";
import QuoteFormModal from "@/components/quotes/QuoteFormModal";

const TODAY = new Date().toISOString().slice(0, 10);

const STATUS_LABELS = {
  DRAFT:     { label: "טיוטה",   color: "bg-slate-100 text-slate-600" },
  CONFIRMED: { label: "מאושר",   color: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "הושלם",   color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "בוטל",    color: "bg-red-100 text-red-600" },
  ARCHIVED:  { label: "ארכיון",  color: "bg-amber-100 text-amber-700" },
};

function GroupRow({ group, showUnmarkedBadge = false }) {
  const status = STATUS_LABELS[group.status] || { label: group.status, color: "bg-slate-100 text-slate-600" };

  return (
    <Link
      to={`/groups/${group.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-slate-800">{group.group_name}</span>
          {showUnmarkedBadge && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5">
              <Clock className="w-3 h-3" /> עבר — לא סומן כהסתיים
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          {group.arrival_date ? format(parseISO(group.arrival_date), "dd/MM/yyyy") : "—"}
          {group.departure_date ? ` → ${format(parseISO(group.departure_date), "dd/MM/yyyy")}` : ""}
          {group.total_pax ? ` · ${group.total_pax} אנשים` : ""}
        </p>
      </div>
      <Badge className={`text-xs shrink-0 ${status.color}`}>{status.label}</Badge>
    </Link>
  );
}

export default function Groups() {
  const [showForm, setShowForm] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);

  const { data: groups = [], refetch } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list("arrival_date", 500),
  });

  // Helper: check if group is historically finished
  const isHistoricallyFinished = (g) => {
    if (g.group_type === "LODGING") {
      return g.departure_date && TODAY > g.departure_date;
    } else if (g.group_type === "DAY_USE") {
      return g.arrival_date && TODAY > g.arrival_date;
    }
    return false;
  };

  // Helper: check if group is currently active/relevant
  const isCurrentlyActive = (g) => {
    if (g.status === "CANCELLED" || g.status === "ARCHIVED" || g.status === "COMPLETED") {
      return false;
    }
    if (isHistoricallyFinished(g)) {
      return false;
    }
    return true;
  };

  const active = useMemo(() => {
    return groups
      .filter(isCurrentlyActive)
      .sort((a, b) => (a.arrival_date || "").localeCompare(b.arrival_date || ""));
  }, [groups]);

  const history = useMemo(() => {
    return groups
      .filter(g => {
        // COMPLETED status groups
        if (g.status === "COMPLETED") return true;
        // Historically finished (but not archived/cancelled)
        if (isHistoricallyFinished(g) && g.status !== "ARCHIVED" && g.status !== "CANCELLED") {
          return true;
        }
        return false;
      })
      .sort((a, b) => {
        // Sort by departure_date (lodging) or arrival_date (day-use), descending
        const dateA = a.group_type === "LODGING" ? (a.departure_date || "") : (a.arrival_date || "");
        const dateB = b.group_type === "LODGING" ? (b.departure_date || "") : (b.arrival_date || "");
        return dateB.localeCompare(dateA);
      });
  }, [groups]);

  const frozen = useMemo(() => {
    return groups
      .filter(g => g.status === "ARCHIVED")
      .sort((a, b) => (b.archived_at || "").localeCompare(a.archived_at || ""));
  }, [groups]);

  const cancelled = useMemo(() => {
    return groups
      .filter(g => g.status === "CANCELLED")
      .sort((a, b) => (b.arrival_date || "").localeCompare(a.arrival_date || ""));
  }, [groups]);

  const TabPanel = ({ items, emptyText, showUnmarkedBadges = false, isFinished }) => (
    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">{emptyText}</p>
      ) : (
        items.map(g => {
          const isUnmarked = showUnmarkedBadges && isFinished(g) && g.status !== "COMPLETED";
          return <GroupRow key={g.id} group={g} showUnmarkedBadge={isUnmarked} />;
        })
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-xl font-bold">קבוצות</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{groups.length} קבוצות בסך הכל</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowQuoteForm(true)}>
              <FileText className="w-4 h-4" /> הצעת מחיר לקבוצה חדשה
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" /> קבוצה חדשה
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <Tabs defaultValue="active">
          <TabsList className="mb-4">
            <TabsTrigger value="active">פעילות ({active.length})</TabsTrigger>
            <TabsTrigger value="history">היסטוריה ({history.length})</TabsTrigger>
            <TabsTrigger value="frozen">קפואות ({frozen.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              <TabPanel items={active} emptyText="אין קבוצות פעילות" isFinished={isHistoricallyFinished} />
            </TabsContent>
            <TabsContent value="history">
              <TabPanel items={history} emptyText="אין קבוצות בהיסטוריה" showUnmarkedBadges={true} isFinished={isHistoricallyFinished} />
            </TabsContent>
            <TabsContent value="frozen">
              <TabPanel items={frozen} emptyText="אין קבוצות קפואות" isFinished={isHistoricallyFinished} />
            </TabsContent>
        </Tabs>
      </div>

      {showForm && (
        <GroupFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refetch(); }}
        />
      )}

      {showQuoteForm && (
        <QuoteFormModal
          onClose={() => setShowQuoteForm(false)}
          onSaved={() => { setShowQuoteForm(false); refetch(); }}
        />
      )}
    </div>
  );
}