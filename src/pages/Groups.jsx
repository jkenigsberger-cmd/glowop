import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Users, Calendar, ChevronLeft, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import GroupStatusBadge from "@/components/groups/GroupStatusBadge";
import GroupFormModal from "@/components/groups/GroupFormModal";
import QuoteFormModal from "@/components/quotes/QuoteFormModal";
import { format } from "date-fns";

const GROUP_TYPE_LABEL = { LODGING: "לינה", DAY_USE: "יום כיף" };

export default function Groups() {
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const queryClient = useQueryClient();

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list("-arrival_date", 100),
  });

  const handleGroupSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["groups"] });
    setShowGroupForm(false);
    setEditTarget(null);
  };

  const openEdit = (g, e) => {
    e.preventDefault();
    setEditTarget(g);
    setShowGroupForm(true);
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">קבוצות</h1>
            <p className="text-sm text-muted-foreground mt-0.5">ניהול קבוצות ולקוחות</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Secondary: create group only (admin/operational) */}
            <Button variant="outline" size="sm" onClick={() => { setEditTarget(null); setShowGroupForm(true); }} className="gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" />
              קבוצה בלבד
            </Button>
            {/* Primary: create Group + Quote together */}
            <Button onClick={() => setShowQuoteForm(true)} className="gap-2">
              <FileText className="w-4 h-4" />
              הצעת מחיר חדשה
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-3">
        {groups.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>אין קבוצות עדיין. צור הצעת מחיר ראשונה.</p>
          </div>
        )}
        {groups.map((g) => (
          <Link
            key={g.id}
            to={`/groups/${g.id}`}
            className="block border border-border rounded-xl bg-card hover:bg-muted/30 transition-colors px-5 py-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-semibold">{g.group_name}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="bg-muted px-2 py-0.5 rounded">{GROUP_TYPE_LABEL[g.group_type]}</span>
                    {g.arrival_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(g.arrival_date), "dd/MM/yyyy")}
                        {g.departure_date && ` — ${format(new Date(g.departure_date), "dd/MM/yyyy")}`}
                      </span>
                    )}
                    {g.total_pax && <span>{g.total_pax} משתתפים</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <GroupStatusBadge status={g.status} />
                <button
                  onClick={(e) => openEdit(g, e)}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  עריכה
                </button>
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Primary flow: new Quote + Group together */}
      {showQuoteForm && (
        <QuoteFormModal
          quote={null}
          group={null}
          onClose={() => setShowQuoteForm(false)}
          onSaved={() => setShowQuoteForm(false)}
        />
      )}

      {/* Secondary flow: group-only create/edit */}
      {showGroupForm && (
        <GroupFormModal
          group={editTarget}
          onClose={() => { setShowGroupForm(false); setEditTarget(null); }}
          onSaved={handleGroupSaved}
        />
      )}
    </div>
  );
}