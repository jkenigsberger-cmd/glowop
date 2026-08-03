import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import GroupFormModal from "@/components/groups/GroupFormModal";
import QuoteFormModal from "@/components/quotes/QuoteFormModal";
import RoleGate from "@/components/RoleGate";
import GroupFilters, { filterGroups } from "@/components/groups/GroupFilters";
import GroupCard from "@/components/groups/GroupCard";
import DayGroupHeader, { groupByDay } from "@/components/groups/DayGroupHeader";
import PreparationGroupCard from "@/components/groups/PreparationGroupCard";
import MechinaDraftCard from "@/components/groups/MechinaDraftCard";
import { useRoleContext } from "@/lib/RoleContext";
import { isQuoteOpen, isQuotePreparationEnabled } from "@/lib/quotePreparationFlow";
import { updateQuotePreparationCache, invalidateQuotePreparationCache } from "@/lib/quotePreparationCache";

const TODAY = new Date().toISOString().slice(0, 10);

export default function Groups() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useRoleContext();
  const preparationFlowEnabled = isQuotePreparationEnabled(role);
  const [showForm, setShowForm] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);

  // ── filter state ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateStart, setDateStart] = useState(null);
  const [dateEnd, setDateEnd] = useState(null);

  const filterState = { searchQuery, monthFilter, typeFilter, statusFilter, dateStart, dateEnd };

  const clearAll = () => {
    setSearchQuery("");
    setMonthFilter("ALL");
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setDateStart(null);
    setDateEnd(null);
  };

  // ── data ───────────────────────────────────────────────────────
  const { data: groups = [], refetch } = useQuery({
    queryKey: ["groups"],
    queryFn: () => base44.entities.Group.list("arrival_date", 500),
  });
  const { data: preparationQuotes = [] } = useQuery({
    queryKey: ["preparationQuotes"],
    queryFn: () => base44.entities.Quote.filter({ preparation_flow_enabled: true }, "-updated_date", 500),
    enabled: preparationFlowEnabled,
  });
  const { data: preparationProfiles = [] } = useQuery({
    queryKey: ["preparationProfiles"],
    queryFn: () => base44.entities.OperationalGroupProfile.list("-updated_date", 500),
    enabled: preparationFlowEnabled,
  });
  const openPreparationQuotes = preparationQuotes.filter(isQuoteOpen);
  const preparationQuoteByGroup = Object.fromEntries(openPreparationQuotes.filter(q => q.group_id).map(q => [q.group_id, q]));
  const preparationGroupIds = new Set(preparationQuotes.filter(q => q.group_id).map(q => q.group_id));
  const preparationProfileByGroup = Object.fromEntries(preparationProfiles.map(p => [p.group_id, p]));
  const preparationGroups = groups.filter(g => preparationQuoteByGroup[g.id] && g.status !== "CONFIRMED" && g.status !== "ARCHIVED");
  const mechinaDrafts = groups.filter(g => g.stay_mode === "MULTI_PERIOD" && g.operationally_active === false && !["CANCELLED", "ARCHIVED", "COMPLETED"].includes(g.status));
  const mechinaDraftIds = new Set(mechinaDrafts.map(g => g.id));
  const canViewMechinaDrafts = ["SUPER_ADMIN", "ADMIN"].includes(role);

  const isHistoricallyFinished = (g) => {
    if (g.group_type === "LODGING") {
      return g.departure_date && TODAY > g.departure_date;
    } else if (g.group_type === "DAY_USE") {
      return g.arrival_date && TODAY > g.arrival_date;
    }
    return false;
  };

  const isCurrentlyActive = (g) => {
    if (g.status === "CANCELLED" || g.status === "ARCHIVED" || g.status === "COMPLETED") return false;
    if (isHistoricallyFinished(g)) return false;
    return true;
  };

  const active = useMemo(() => {
    return groups.filter(g => !mechinaDraftIds.has(g.id) && (!preparationGroupIds.has(g.id) || g.status === "CONFIRMED") && isCurrentlyActive(g)).sort((a, b) => (a.arrival_date || "").localeCompare(b.arrival_date || ""));
  }, [groups, preparationQuotes]);

  const history = useMemo(() => {
    return groups
      .filter(g => {
        if (mechinaDraftIds.has(g.id)) return false;
        if (preparationGroupIds.has(g.id) && g.status !== "CONFIRMED") return false;
        if (g.status === "COMPLETED") return true;
        if (isHistoricallyFinished(g) && g.status !== "ARCHIVED" && g.status !== "CANCELLED") return true;
        return false;
      })
      .sort((a, b) => {
        const da = a.group_type === "LODGING" ? (a.departure_date || "") : (a.arrival_date || "");
        const db = b.group_type === "LODGING" ? (b.departure_date || "") : (b.arrival_date || "");
        return db.localeCompare(da);
      });
  }, [groups, preparationQuotes]);

  const frozen = useMemo(() => {
    return groups.filter(g => g.status === "ARCHIVED").sort((a, b) => (b.archived_at || "").localeCompare(a.archived_at || ""));
  }, [groups]);

  // ── empty state message ────────────────────────────────────────
  const hasFilters = searchQuery || monthFilter !== "ALL" || typeFilter !== "ALL" || statusFilter !== "ALL" || dateStart || dateEnd;

  function emptyText(bucketLabel) {
    if (hasFilters) {
      if (monthFilter !== "ALL") return "לא נמצאו קבוצות בחודש שנבחר";
      if (searchQuery) return "לא נמצאו קבוצות התואמות לחיפוש";
      return "לא נמצאו קבוצות";
    }
    return bucketLabel;
  }

  // ── render ─────────────────────────────────────────────────────
  const GroupList = ({ items, emptyLabel, showUnmarkedBadges = false }) => {
    const filtered = filterGroups(items, filterState);
    const dayGroups = groupByDay(filtered);

    if (dayGroups.length === 0) {
      return (
        <div className="bg-white rounded-xl border border-slate-200">
          <p className="text-sm text-slate-400 text-center py-10">{emptyText(emptyLabel)}</p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {dayGroups.map(({ date, items: dayItems }) => (
          <div key={date}>
            <DayGroupHeader dateStr={date} />
            {dayItems.map(g => {
              const isUnmarked = showUnmarkedBadges && isHistoricallyFinished(g) && g.status !== "COMPLETED";
              return (
                <div key={g.id} className="relative">
                  <GroupCard group={g} />
                  {isUnmarked && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> עבר — לא סומן
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4">
          <div className="hidden sm:flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <h1 className="text-xl font-bold">קבוצות</h1>
                <p className="text-xs text-muted-foreground mt-0.5">{groups.length} קבוצות בסך הכל</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <RoleGate permission="CREATE_QUOTE">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowQuoteForm(true)}>
                  <FileText className="w-4 h-4" /> הצעת מחיר לקבוצה חדשה
                </Button>
              </RoleGate>
              <RoleGate permission="CREATE_GROUP">
                <Button size="sm" className="gap-1.5" onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4" /> קבוצה חדשה
                </Button>
              </RoleGate>
            </div>
          </div>

          <div className="flex sm:hidden flex-col gap-3">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <h1 className="text-xl font-bold">קבוצות</h1>
                <p className="text-xs text-muted-foreground">{groups.length} קבוצות בסך הכל</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <RoleGate permission="CREATE_QUOTE">
                <Button size="sm" variant="outline" className="gap-1.5 h-10 text-xs" onClick={() => setShowQuoteForm(true)}>
                  <FileText className="w-4 h-4" /> הצעת מחיר
                </Button>
              </RoleGate>
              <RoleGate permission="CREATE_GROUP">
                <Button size="sm" className="gap-1.5 h-10 text-sm" onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4" /> קבוצה חדשה
                </Button>
              </RoleGate>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* Filters */}
        <div className="mb-4">
          <GroupFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            monthFilter={monthFilter}
            onMonthChange={setMonthFilter}
            typeFilter={typeFilter}
            onTypeChange={setTypeFilter}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            dateStart={dateStart}
            onDateStartChange={setDateStart}
            dateEnd={dateEnd}
            onDateEndChange={setDateEnd}
            onClearAll={clearAll}
          />
        </div>

        {canViewMechinaDrafts && mechinaDrafts.length > 0 && (
          <section className="mb-5 space-y-3">
            <h2 className="text-base font-semibold">מכינות בהכנה</h2>
            <div className="space-y-2">{mechinaDrafts.map(group => <MechinaDraftCard key={group.id} group={group} />)}</div>
          </section>
        )}

        <Tabs defaultValue="active">
          <TabsList className="mb-4">
            <TabsTrigger value="active">פעילות ({filterGroups(active, filterState).length})</TabsTrigger>
            {preparationFlowEnabled && <TabsTrigger value="preparation">קבוצות בהכנה ({preparationGroups.length})</TabsTrigger>}
            <TabsTrigger value="history">היסטוריה ({filterGroups(history, filterState).length})</TabsTrigger>
            <TabsTrigger value="frozen">קפואות ({filterGroups(frozen, filterState).length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <GroupList items={active} emptyLabel="אין קבוצות פעילות" />
          </TabsContent>
          {preparationFlowEnabled && <TabsContent value="preparation">
            <div className="space-y-3">{preparationGroups.map(group => <PreparationGroupCard key={group.id} group={group} quote={preparationQuoteByGroup[group.id]} profile={preparationProfileByGroup[group.id]} canActivate={["SUPER_ADMIN","ADMIN"].includes(role) && group.quote_preparation_flow === true && ["DRAFT", "PENDING_APPROVAL"].includes(group.status)} onActivated={({ quote, group: updatedGroup, profile }) => { updateQuotePreparationCache(queryClient, { quote, group: updatedGroup, profile }); invalidateQuotePreparationCache(queryClient, updatedGroup.id); }} />)}{!preparationGroups.length && <p className="text-center py-10 text-muted-foreground">אין קבוצות בהכנה</p>}</div>
          </TabsContent>}
          <TabsContent value="history">
            <GroupList items={history} emptyLabel="אין קבוצות בהיסטוריה" showUnmarkedBadges />
          </TabsContent>
          <TabsContent value="frozen">
            <GroupList items={frozen} emptyLabel="אין קבוצות קפואות" />
          </TabsContent>
        </Tabs>
      </div>

      {showForm && (
        <GroupFormModal
          onClose={() => setShowForm(false)}
          onSaved={(groupId) => {
            setShowForm(false);
            refetch();
            if (groupId) navigate(`/groups/${groupId}`);
          }}
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