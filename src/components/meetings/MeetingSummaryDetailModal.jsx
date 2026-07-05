import React from "react";
import { Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil, Archive, Calendar, Users } from "lucide-react";
import {
  parseTags, STATUS_LABELS, VISIBILITY_LABELS,
} from "@/lib/meetingSummaryUtils";

function Section({ title, children }) {
  if (!children) return null;
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-bold text-primary uppercase tracking-wide">{title}</h4>
      {children}
    </div>
  );
}

function idList(str) {
  return String(str || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function MeetingSummaryDetailModal({ open, onClose, record, canWrite, onEdit, onArchive }) {
  if (!record) return null;
  const tags = parseTags(record.topics_tags);
  const groupIds = idList(record.related_group_ids);
  const eventIds = idList(record.related_event_ids);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="pr-8">{record.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            {record.meeting_date && (
              <span className="inline-flex items-center gap-1"><Calendar className="w-4 h-4" />{record.meeting_date}</span>
            )}
            {record.relevant_week_start && (
              <span className="inline-flex items-center gap-1">שבוע: {record.relevant_week_start}</span>
            )}
            {record.participants_text && (
              <span className="inline-flex items-center gap-1"><Users className="w-4 h-4" />{record.participants_text}</span>
            )}
            <span className="bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 text-xs">{STATUS_LABELS[record.status]}</span>
            <span className="bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 text-xs">{VISIBILITY_LABELS[record.visibility]}</span>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="bg-primary/10 text-primary text-xs rounded-full px-2 py-0.5">{t}</span>
              ))}
            </div>
          )}

          <Section title="סיכום פגישה">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
              {record.meeting_summary_text || <span className="text-slate-400">אין סיכום</span>}
            </div>
          </Section>

          {record.original_transcript_optional && (
            <Section title="חומר גלם / Transcript מקורי">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                {record.original_transcript_optional}
              </div>
            </Section>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {record.mentioned_people_text && (
              <Section title="אנשים שהוזכרו"><p className="text-sm text-slate-700">{record.mentioned_people_text}</p></Section>
            )}
            {record.mentioned_groups_text && (
              <Section title="קבוצות שהוזכרו"><p className="text-sm text-slate-700">{record.mentioned_groups_text}</p></Section>
            )}
            {record.mentioned_locations_text && (
              <Section title="מיקומים שהוזכרו"><p className="text-sm text-slate-700">{record.mentioned_locations_text}</p></Section>
            )}
            {record.internal_notes && (
              <Section title="הערות פנימיות"><p className="text-sm text-slate-700 whitespace-pre-wrap">{record.internal_notes}</p></Section>
            )}
          </div>

          {(groupIds.length > 0 || eventIds.length > 0) && (
            <Section title="קישורים ידניים">
              <div className="space-y-2">
                {groupIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-xs text-slate-500">קבוצות:</span>
                    {groupIds.map((id) => (
                      <Link key={id} to={`/groups/${id}`} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 hover:bg-blue-100">
                        {id.slice(0, 8)}…
                      </Link>
                    ))}
                  </div>
                )}
                {eventIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-xs text-slate-500">אירועים:</span>
                    {eventIds.map((id) => (
                      <span key={id} className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{id.slice(0, 8)}…</span>
                    ))}
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>

        {canWrite && (
          <DialogFooter className="gap-2">
            {record.status !== "ARCHIVED" && (
              <Button variant="outline" onClick={() => onArchive(record)}>
                <Archive className="w-4 h-4" /> ארכיון
              </Button>
            )}
            <Button onClick={() => onEdit(record)}>
              <Pencil className="w-4 h-4" /> ערוך
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}