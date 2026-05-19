import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, parseISO, isPast } from "date-fns";
import { Users, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import GroupFormModal from "@/components/groups/GroupFormModal";

const STATUS_LABELS = {
  DRAFT:     { label: "טיוטה",   color: "bg-slate-100 text-slate-600" },
  CONFIRMED: { label: "מאושר",   color: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "הושלם",   color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "בוטל",    color: "bg-red-100 text-red-600" },
  ARCHIVED:  { label: "ארכיון",  color: "bg-amber-100 text-amber-700" },
};

function GroupRow({ group }) {
  const status = STATUS_LABELS[group.status] || { label: group.status, color: "bg-slate-100 text-slate-600" };
  const isOverdue =
    (group.status === "CONFIRMED" || group.status === "DRAFT") &&
    group.departure_date &&
    isPast(parseISO(group.departure_date));

  return (
    <Link
      to={`/groups/${group.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-slate-800">{group.group_name}</span>
          {isOverdue && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5">
              <AlertTriangle className="w-3 h-3" /> דורש השלמה
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

  const { data: groups = [], refetch } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list("arrival_date", 500),
  });

  const active    = useMemo(() => groups.filter(g => g.status === "DRAFT" || g.status === "CONFIRMED").sort((a, b) => (a.arrival_date || "").localeCompare(b.arrival_date || "")), [groups]);
  const history   = useMemo(() => groups.filter(g => g.status === "COMPLETED").sort((a, b) => (b.arrival_date || "").localeCompare(a.arrival_date || "")), [groups]);
  const frozen    = useMemo(() => groups.filter(g => g.status === "ARCHIVED").sort((a, b) => (b.archived_at || "").localeCompare(a.archived_at || "")), [groups]);
  const cancelled = useMemo(() => groups.filter(g => g.status === "CANCELLED").sort((a, b) => (b.arrival_date || "").localeCompare(a.arrival_date || "")), [groups]);

  const TabPanel = ({ items, emptyText }) => (
    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">{emptyText}</p>
      ) : (
        items.map(g => <GroupRow key={g.id} group={g} />)
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
          <Button size="sm" className="gap-1.5" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> קבוצה חדשה
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <Tabs defaultValue="active">
          <TabsList className="mb-4">
            <TabsTrigger value="active">פעילות ({active.length})</TabsTrigger>
            <TabsTrigger value="history">היסטוריה ({history.length})</TabsTrigger>
            <TabsTrigger value="frozen">קפואות ({frozen.length})</TabsTrigger>
            <TabsTrigger value="cancelled">בוטלו ({cancelled.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <TabPanel items={active} emptyText="אין קבוצות פעילות" />
          </TabsContent>
          <TabsContent value="history">
            <TabPanel items={history} emptyText="אין קבוצות בהיסטוריה" />
          </TabsContent>
          <TabsContent value="frozen">
            <TabPanel items={frozen} emptyText="אין קבוצות קפואות" />
          </TabsContent>
          <TabsContent value="cancelled">
            <TabPanel items={cancelled} emptyText="אין קבוצות מבוטלות" />
          </TabsContent>
        </Tabs>
      </div>

      {showForm && (
        <GroupFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refetch(); }}
        />
      )}
    </div>
  );
}