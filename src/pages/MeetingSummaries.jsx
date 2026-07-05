import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useRoleContext } from "@/lib/RoleContext";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, NotebookPen, Loader2 } from "lucide-react";
import {
  parseTags, STATUS_LABELS, VISIBILITY_LABELS, OPERATIONAL_AREAS,
  canWriteMeetings, canViewPrivateMeetings,
} from "@/lib/meetingSummaryUtils";
import MeetingSummaryFormModal from "@/components/meetings/MeetingSummaryFormModal";
import MeetingSummaryDetailModal from "@/components/meetings/MeetingSummaryDetailModal";

const STATUS_COLORS = {
  DRAFT: "bg-amber-50 text-amber-700",
  SAVED: "bg-emerald-50 text-emerald-700",
  ARCHIVED: "bg-slate-100 text-slate-500",
};

export default function MeetingSummaries() {
  const { role } = useRoleContext();
  const { user } = useAuth();
  const canWrite = canWriteMeetings(role);
  const canSeePrivate = canViewPrivateMeetings(role);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE"); // ACTIVE = hide archived
  const [visibilityFilter, setVisibilityFilter] = useState("ALL");
  const [topicFilter, setTopicFilter] = useState("ALL");
  const [weekFilter, setWeekFilter] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const { data: allRecords = [], isLoading, refetch } = useQuery({
    queryKey: ["meetingSummaries"],
    queryFn: () => base44.entities.MeetingSummary.list("-meeting_date", 500),
    staleTime: 30_000,
  });

  // Role-based visibility: hide PRIVATE_OPERATIONS from non-authorized roles.
  const visibleRecords = useMemo(
    () => allRecords.filter((r) => canSeePrivate || r.visibility !== "PRIVATE_OPERATIONS"),
    [allRecords, canSeePrivate]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleRecords.filter((r) => {
      // Status filter (default hides archived)
      if (statusFilter === "ACTIVE" && r.status === "ARCHIVED") return false;
      if (statusFilter !== "ACTIVE" && statusFilter !== "ALL" && r.status !== statusFilter) return false;
      // Visibility filter
      if (visibilityFilter !== "ALL" && r.visibility !== visibilityFilter) return false;
      // Topic filter
      if (topicFilter !== "ALL" && !parseTags(r.topics_tags).includes(topicFilter)) return false;
      // Week filter
      if (weekFilter && r.relevant_week_start !== weekFilter) return false;
      // Free-text search over search_text
      if (q && !(r.search_text || "").includes(q)) return false;
      return true;
    });
  }, [visibleRecords, search, statusFilter, visibilityFilter, topicFilter, weekFilter]);

  const openNew = () => { setSelected(null); setFormOpen(true); };
  const openEdit = (rec) => { setSelected(rec); setDetailOpen(false); setFormOpen(true); };
  const openDetail = (rec) => { setSelected(rec); setDetailOpen(true); };

  const handleArchive = async (rec) => {
    await base44.entities.MeetingSummary.update(rec.id, { status: "ARCHIVED" });
    setDetailOpen(false);
    refetch();
  };

  return (
    <div className="max-w-screen-xl mx-auto px-4 lg:px-6 py-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <NotebookPen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">סיכומי פגישות</h1>
            <p className="text-xs text-slate-400">ארכיון זיכרון פגישות — אחסון וחיפוש בלבד</p>
          </div>
        </div>
        {canWrite && (
          <Button onClick={openNew}>
            <Plus className="w-4 h-4" /> סיכום פגישה חדש
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 mb-5 space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש חופשי בכל תוכן הסיכומים..."
            className="pr-9"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">פעילים (ללא ארכיון)</SelectItem>
              <SelectItem value="ALL">כל הסטטוסים</SelectItem>
              <SelectItem value="DRAFT">{STATUS_LABELS.DRAFT}</SelectItem>
              <SelectItem value="SAVED">{STATUS_LABELS.SAVED}</SelectItem>
              <SelectItem value="ARCHIVED">{STATUS_LABELS.ARCHIVED}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
            <SelectTrigger><SelectValue placeholder="הרשאת צפייה" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">כל ההרשאות</SelectItem>
              <SelectItem value="PRIVATE_OPERATIONS">{VISIBILITY_LABELS.PRIVATE_OPERATIONS}</SelectItem>
              <SelectItem value="INTERNAL_VISIBLE">{VISIBILITY_LABELS.INTERNAL_VISIBLE}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={topicFilter} onValueChange={setTopicFilter}>
            <SelectTrigger><SelectValue placeholder="נושא" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">כל הנושאים</SelectItem>
              {OPERATIONAL_AREAS.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)} title="שבוע רלוונטי" />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <NotebookPen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>לא נמצאו סיכומי פגישות</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Table header (desktop) */}
          <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1.5fr_1.5fr_0.8fr_1fr] gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
            <span>כותרת</span><span>תאריך פגישה</span><span>שבוע רלוונטי</span>
            <span>משתתפים</span><span>נושאים</span><span>סטטוס</span><span>הרשאת צפייה</span>
          </div>
          {filtered.map((r) => {
            const tags = parseTags(r.topics_tags);
            return (
              <button
                key={r.id}
                onClick={() => openDetail(r)}
                className="w-full text-right grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1.5fr_1.5fr_0.8fr_1fr] gap-1.5 md:gap-3 px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors items-center"
              >
                <span className="font-semibold text-slate-800 text-sm">{r.title}</span>
                <span className="text-xs text-slate-500">{r.meeting_date || "—"}</span>
                <span className="text-xs text-slate-500">{r.relevant_week_start || "—"}</span>
                <span className="text-xs text-slate-500 truncate">{r.participants_text || "—"}</span>
                <span className="flex flex-wrap gap-1">
                  {tags.slice(0, 3).map((t) => (
                    <span key={t} className="bg-primary/10 text-primary text-[10px] rounded-full px-1.5 py-0.5">{t}</span>
                  ))}
                  {tags.length > 3 && <span className="text-[10px] text-slate-400">+{tags.length - 3}</span>}
                </span>
                <span>
                  <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${STATUS_COLORS[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </span>
                <span className="text-[10px] text-slate-500">{VISIBILITY_LABELS[r.visibility]}</span>
              </button>
            );
          })}
        </div>
      )}

      {formOpen && (
        <MeetingSummaryFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          record={selected}
          currentUserEmail={user?.email}
          onSaved={refetch}
        />
      )}
      {detailOpen && (
        <MeetingSummaryDetailModal
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          record={selected}
          canWrite={canWrite}
          onEdit={openEdit}
          onArchive={handleArchive}
        />
      )}
    </div>
  );
}