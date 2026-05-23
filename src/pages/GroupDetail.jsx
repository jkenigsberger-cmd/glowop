import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ChevronRight, Calendar, Users, Phone, Mail, Pencil, Plus, FileText, ClipboardList, Copy, Check, ShieldCheck, Printer } from "lucide-react";
import QuotePdfButton from "@/components/quotes/QuotePdfButton";
import { format } from "date-fns";
import { toast } from "sonner";
import GroupStatusBadge from "@/components/groups/GroupStatusBadge";
import GroupFormModal from "@/components/groups/GroupFormModal";
import QuoteStatusBadge from "@/components/quotes/QuoteStatusBadge";
import QuoteFormModal from "@/components/quotes/QuoteFormModal";
import QuoteStatusActions from "@/components/quotes/QuoteStatusActions";
import GuestFormSubmissionModal from "@/components/groups/GuestFormSubmissionModal";
import SubmissionReviewModal from "@/components/groups/SubmissionReviewModal";
import OperationalProfileDisplay from "@/components/groups/OperationalProfileDisplay";
import OperationalHoldCard from "@/components/groups/OperationalHoldCard";
import SleepingRequirementsTab from "@/components/sleeping/SleepingRequirementsTab";
import ScheduleAndMealsTab from "@/components/schedule/ScheduleAndMealsTab";
import GroupLifecycleActions from "@/components/groups/GroupLifecycleActions";

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editGroup, setEditGroup] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [editQuote, setEditQuote] = useState(null);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [editSubmission, setEditSubmission] = useState(null);
  const [reviewSubmission, setReviewSubmission] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [approvingProfile, setApprovingProfile] = useState(false);

  const { data: group } = useQuery({
    queryKey: ["group", id],
    queryFn: () => base44.entities.Group.filter({ id }),
    select: (r) => r[0],
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["operationalProfile", id],
    queryFn: () => base44.entities.OperationalGroupProfile.filter({ group_id: id }),
    enabled: !!id,
  });
  const operationalProfile = profiles[0];

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes", id],
    queryFn: () => base44.entities.Quote.filter({ group_id: id }),
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ["submissions", id],
    queryFn: () => base44.entities.GuestFormSubmission.filter({ group_id: id }),
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["group", id] });
    queryClient.invalidateQueries({ queryKey: ["quotes", id] });
    queryClient.invalidateQueries({ queryKey: ["submissions", id] });
    queryClient.invalidateQueries({ queryKey: ["operationalProfile", id] });
    queryClient.invalidateQueries({ queryKey: ["operationalProfiles"] });
    queryClient.invalidateQueries({ queryKey: ["groups"] });
  };

  const activeQuote = quotes.find(q => q.status === "APPROVED") || quotes[0];

  const handleApproveProfile = async () => {
    setApprovingProfile(true);
    console.log("[Approve Operational Profile] clicked", { groupId: id, profileId: operationalProfile?.id, quoteId: activeQuote?.id });
    try {
      const res = await base44.functions.invoke("createOrUpdateOperationalGroupProfile", {
        group_id: id,
        quote_id: activeQuote?.id || undefined,
      });
      console.log("[Approve Operational Profile] response", res);
      if (res.data?.success) {
        toast.success("הפרופיל התפעולי אושר בהצלחה");
        refetch();
      } else {
        toast.error(res.data?.error || "אישור הפרופיל נכשל");
      }
    } catch (err) {
      console.error("[Approve Operational Profile] error", err);
      console.error("[Approve Operational Profile] backend error", err?.response?.data);
      toast.error(err?.response?.data?.error || err?.message || "אישור הפרופיל נכשל");
    } finally {
      setApprovingProfile(false);
    }
  };

  const copyGuestFormLink = (quoteId) => {
    const url = `${window.location.origin}/guest-form?quote=${quoteId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(quoteId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!group) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const GROUP_TYPE_LABEL = { LODGING: "לינה", DAY_USE: "יום כיף" };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <Link to="/groups" className="hover:text-foreground flex items-center gap-1">
              <ChevronRight className="w-4 h-4" /> קבוצות
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">{group.group_name}</h1>
                  <GroupStatusBadge status={group.status} />
                  <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">{GROUP_TYPE_LABEL[group.group_type]}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                  {group.arrival_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(group.arrival_date), "dd/MM/yyyy")}
                      {group.departure_date && ` — ${format(new Date(group.departure_date), "dd/MM/yyyy")}`}
                    </span>
                  )}
                  {group.total_pax && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{group.total_pax} משתתפים</span>}
                  {group.contact_phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{group.contact_phone}</span>}
                  {group.contact_email && <span className="flex items-center gap-1 break-all"><Mail className="w-3.5 h-3.5" />{group.contact_email}</span>}
                </div>
              </div>
            </div>
            {/* Action buttons — stack on mobile */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open(`/groups/${id}/operational-summary-print`, "_blank")} className="gap-1 flex-shrink-0">
                <Printer className="w-3.5 h-3.5" /> הפק סיכום קבוצה
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditGroup(true)} className="gap-1 flex-shrink-0">
                <Pencil className="w-3.5 h-3.5" /> עריכה
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-0">
          {[
            { key: "overview", label: "סקירה כללית" },
            { key: "schedule", label: "📅 לוח זמנים וארוחות" },
            { key: "sleeping", label: "🛏️ דרישות לינה" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {activeTab === "sleeping" && <SleepingRequirementsTab groupId={id} profile={operationalProfile} />}
        {activeTab === "schedule" && (
          <ScheduleAndMealsTab
            groupId={id}
            profile={operationalProfile}
            group={group}
            quotes={quotes}
            guestFormSubmission={submissions.find(s => s.status === "SUBMITTED" || s.status === "REVIEWED") || submissions[0] || null}
          />
        )}

        {activeTab === "overview" && <>

        {/* Summary Bar */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold">{group.total_pax || 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">משתתפים</p>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold">{quotes.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">הצעות מחיר</p>
            {activeQuote && <QuoteStatusBadge status={activeQuote.status} />}
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold">{submissions.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">טפסי קבלה</p>
          </div>
        </div>

        {/* Quotes Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> הצעות מחיר</h2>
            <Button size="sm" variant="outline" onClick={() => { setEditQuote(null); setShowQuoteForm(true); }} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> הצעה חדשה
            </Button>
          </div>
          {quotes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">אין הצעות מחיר עדיין.</p>
          ) : (
            <div className="space-y-2">
              {quotes.map(q => (
                <div key={q.id} className="bg-card border border-border rounded-xl px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">גרסה {q.version}</span>
                      {q.quote_number && <span className="text-xs text-muted-foreground">{q.quote_number}</span>}
                      {q.valid_until && <span className="text-xs text-muted-foreground">בתוקף עד {format(new Date(q.valid_until), "dd/MM/yyyy")}</span>}
                      {q.total_price > 0 && <span className="text-sm font-semibold text-primary">₪{Math.round(q.total_price).toLocaleString()}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {q.status === "APPROVED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyGuestFormLink(q.id)}
                          className={`gap-1 transition-colors ${copiedId === q.id ? "border-green-400 text-green-600 bg-green-50" : ""}`}
                        >
                          {copiedId === q.id
                            ? <><Check className="w-3 h-3" /> הועתק!</>
                            : <><Copy className="w-3 h-3" /> העתק לינק לטופס לקוח</>
                          }
                        </Button>
                      )}
                      <QuotePdfButton quote={q} group={group} />
                      <Button size="sm" variant="ghost" onClick={() => { setEditQuote(q); setShowQuoteForm(true); }} className="gap-1">
                        <Pencil className="w-3 h-3" /> עריכה
                      </Button>
                    </div>
                  </div>
                  <QuoteStatusActions quote={q} group={group} onUpdated={refetch} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* GuestFormSubmissions Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2"><ClipboardList className="w-4 h-4" /> טפסי קבלה</h2>
            {quotes.length === 0 ? (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                יש ליצור הצעת מחיר תחילה
              </span>
            ) : (
              <Button size="sm" variant="outline" onClick={() => { setEditSubmission(null); setShowSubmissionForm(true); }} className="gap-1">
                <Plus className="w-3.5 h-3.5" /> טופס חדש
              </Button>
            )}
          </div>
          {submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">אין טפסי קבלה עדיין.</p>
          ) : (
            <div className="space-y-2">
              {submissions.map(s => (
                <div key={s.id} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{s.contact_name || "ללא שם"}</span>
                      <span className={`text-xs px-2 py-0.5 rounded border ${s.status === "REVIEWED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : s.status === "SUBMITTED" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {s.status === "REVIEWED" ? "נבדק" : s.status === "SUBMITTED" ? "הוגש" : "ממתין"}
                      </span>
                    </div>
                    {s.total_pax && <p className="text-xs text-muted-foreground">{s.total_pax} משתתפים · {s.submitted_at ? format(new Date(s.submitted_at), "dd/MM/yyyy") : ""}</p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setReviewSubmission(s)} className="gap-1">
                    <Pencil className="w-3 h-3" /> צפייה / עריכה
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Approve operational profile — shown when profile exists but not yet ACCEPTED, or group not yet CONFIRMED */}
        {operationalProfile && operationalProfile.status !== "ACCEPTED" && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-blue-800">פרופיל תפעולי ממתין לאישור</p>
              <p className="text-xs text-blue-600 mt-0.5">לחץ לאישור הפרופיל ומעבר הקבוצה לסטטוס מאושר</p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 bg-blue-700 hover:bg-blue-800 text-white"
              onClick={handleApproveProfile}
              disabled={approvingProfile}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {approvingProfile ? "מאשר..." : "אשר פרופיל תפעולי"}
            </Button>
          </div>
        )}
        {!operationalProfile && group && (group.status === "DRAFT" || group.status === "CONFIRMED") && (
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">אין פרופיל תפעולי עדיין</p>
              <p className="text-xs text-slate-500 mt-0.5">ניתן ליצור פרופיל תפעולי מנתוני הקבוצה/ההצעה</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-slate-300"
              onClick={handleApproveProfile}
              disabled={approvingProfile}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {approvingProfile ? "מאשר..." : "צור ואשר פרופיל תפעולי"}
            </Button>
          </div>
        )}

        {/* Operational Profile */}
        <OperationalProfileDisplay groupId={id} />

        {/* Operational Hold — admin debug card */}
        <OperationalHoldCard groupId={id} />

        {/* Internal Notes */}
        {group.internal_notes && (
          <section className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 mb-1">הערות פנימיות</p>
            <p className="text-sm text-amber-900">{group.internal_notes}</p>
          </section>
        )}

        {/* Lifecycle Actions */}
        <GroupLifecycleActions
          group={group}
          onDeleted={() => navigate("/groups")}
          onUpdated={refetch}
        />

        </>}
      </div>

      {/* Modals */}
      {editGroup && <GroupFormModal group={group} initialProfileDiets={operationalProfile?.special_diets || null} onClose={() => setEditGroup(false)} onSaved={() => { refetch(); setEditGroup(false); }} />}
      {showQuoteForm && <QuoteFormModal quote={editQuote} group={group} onClose={() => { setShowQuoteForm(false); setEditQuote(null); }} onSaved={() => { refetch(); setShowQuoteForm(false); setEditQuote(null); }} />}
      {reviewSubmission && !showSubmissionForm && (
        <SubmissionReviewModal
          submission={reviewSubmission}
          quoteData={activeQuote}
          onClose={() => setReviewSubmission(null)}
          onEdit={() => { setEditSubmission(reviewSubmission); setShowSubmissionForm(true); setReviewSubmission(null); }}
          onSaved={() => { refetch(); setReviewSubmission(null); }}
        />
      )}
      {showSubmissionForm && (
        <GuestFormSubmissionModal
          submission={editSubmission}
          quoteId={activeQuote?.id || quotes[0]?.id}
          groupId={id}
          onClose={() => { setShowSubmissionForm(false); setEditSubmission(null); }}
          onSaved={() => { refetch(); setShowSubmissionForm(false); setEditSubmission(null); }}
        />
      )}
    </div>
  );
}