import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Users, Calendar, ChevronLeft, FileText, Trash2, ChevronDown, ChevronUp, Clock, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import GroupStatusBadge from "@/components/groups/GroupStatusBadge";
import GroupFormModal from "@/components/groups/GroupFormModal";
import QuoteFormModal from "@/components/quotes/QuoteFormModal";
import { format } from "date-fns";
import { toast } from "sonner";

const GROUP_TYPE_LABEL = { LODGING: "לינה", DAY_USE: "יום כיף" };

const today = new Date().toISOString().slice(0, 10);

function isFinished(g) {
  const endDate = g.departure_date || g.arrival_date;
  return !!endDate && endDate < today;
}

function GroupRow({ g, onEdit, onDelete }) {
  return (
    <div className="relative group/row border border-border rounded-xl bg-card hover:bg-muted/30 transition-colors">
      <Link to={`/groups/${g.id}`} className="block px-5 py-4">
        <div className="flex items-center justify-between">
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
          <div className="flex items-center gap-3">
            <GroupStatusBadge status={g.status} />
            <button
              onClick={(e) => { e.preventDefault(); onEdit(g, e); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              עריכה
            </button>
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </Link>
      {/* Delete button — visible on hover */}
      <button
        onClick={(e) => { e.preventDefault(); onDelete(g); }}
        className="absolute top-3 left-3 opacity-0 group-hover/row:opacity-100 transition-opacity p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50"
        title="מחק קבוצה"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function Groups() {
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const queryClient = useQueryClient();

  const { data: groups = [] } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list("-arrival_date", 200),
  });

  const active  = groups.filter(g => !isFinished(g));
  const history = groups.filter(g => isFinished(g));

  const handleGroupSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["groups"] });
    setShowGroupForm(false);
    setEditTarget(null);
  };

  const openEdit = (g, e) => {
    e?.preventDefault();
    setEditTarget(g);
    setShowGroupForm(true);
  };

  const handleDelete = (g) => setDeleteTarget(g);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    setDeleteTarget(null);
    try {
      const res = await base44.functions.invoke("deleteGroup", { group_id: deleteTarget.id });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      if (res.data?.success) {
        const d = res.data.deleted;
        toast.success(`הקבוצה נמחקה. הוסרו: ${d.scheduleItems} פעילויות, ${d.mealReservations} ארוחות, ${d.allocations} הקצאות לינה.`);
      } else if (res.data?.error) {
        toast.error(res.data.error);
      }
    } catch (e) {
      toast.error("הפעולה נכשלה. יש להתחבר מחדש או לבדוק הרשאות.");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    } finally {
      setDeletingId(null);
    }
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
            <Button variant="outline" size="sm" onClick={() => { setEditTarget(null); setShowGroupForm(true); }} className="gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" />
              קבוצה בלבד
            </Button>
            <Button onClick={() => setShowQuoteForm(true)} className="gap-2">
              <FileText className="w-4 h-4" />
              הצעת מחיר חדשה
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-3">

        {/* Active groups */}
        {active.length === 0 && history.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>אין קבוצות עדיין. צור הצעת מחיר ראשונה.</p>
          </div>
        )}

        {active.map((g) => (
          <div key={g.id} className={deletingId === g.id ? "opacity-40 pointer-events-none" : ""}>
            <GroupRow g={g} onEdit={openEdit} onDelete={handleDelete} />
          </div>
        ))}

        {/* History section */}
        {history.length > 0 && (
          <div className="pt-4">
            <button
              onClick={() => setShowHistory(h => !h)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3 w-full"
            >
              <div className="flex-1 border-t border-dashed border-border" />
              <span className="flex items-center gap-1.5 px-2 whitespace-nowrap">
                <Clock className="w-3.5 h-3.5" />
                היסטוריה — {history.length} קבוצות שסיימו
                {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </span>
              <div className="flex-1 border-t border-dashed border-border" />
            </button>

            {showHistory && (
              <div className="space-y-2">
                {history.map((g) => (
                  <div key={g.id} className={`opacity-70 ${deletingId === g.id ? "opacity-30 pointer-events-none" : ""}`}>
                    <GroupRow g={g} onEdit={openEdit} onDelete={handleDelete} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showQuoteForm && (
        <QuoteFormModal
          quote={null}
          group={null}
          onClose={() => setShowQuoteForm(false)}
          onSaved={() => setShowQuoteForm(false)}
        />
      )}

      {showGroupForm && (
        <GroupFormModal
          group={editTarget}
          onClose={() => { setShowGroupForm(false); setEditTarget(null); }}
          onSaved={handleGroupSaved}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="bg-red-100 rounded-lg p-2 shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">מחיקת קבוצה</h2>
                <p className="text-sm text-slate-600 mt-1">
                  מחיקת הקבוצה <strong>"{deleteTarget.group_name}"</strong> תסיר גם את כל הנתונים התפעוליים הקשורים אליה:
                  שיבוצי לינה, לוח פעילויות, ארוחות, שמירת שכונות ועוד.
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  הנתונים הפיזיים של החווה (אוהלים, מיטות, שכונות, מרחבים) לא יימחקו.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>ביטול</Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
                onClick={confirmDelete}
              >
                <Trash2 className="w-3.5 h-3.5" />
                מחק קבוצה ונתונים קשורים
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}