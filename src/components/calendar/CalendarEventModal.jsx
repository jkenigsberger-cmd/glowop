import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { Hotel, Utensils, Activity, Bookmark, ExternalLink } from "lucide-react";
import moment from "moment";

const EVENT_META = {
  groupStayCheckIn:  { label: "צ׳ק-אין",            icon: Hotel,    iconCls: "text-emerald-600" },
  groupStaySleeping: { label: "לינה",                icon: Hotel,    iconCls: "text-blue-600" },
  groupStayCheckOut: { label: "צ׳ק-אאוט",            icon: Hotel,    iconCls: "text-orange-600" },
  meal:              { label: "ארוחה",                icon: Utensils, iconCls: "text-amber-600" },
  activity:          { label: "פעילות",               icon: Activity, iconCls: "text-purple-600" },
  operationalHold:   { label: "החזקה תפעולית (Hold)", icon: Bookmark, iconCls: "text-slate-500" },
};

const MEAL_TYPE_LABELS = {
  BREAKFAST: "ארוחת בוקר",
  LUNCH:     "ארוחת צהריים",
  DINNER:    "ארוחת ערב",
  OTHER:     "אחר",
};

function Row({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-400 shrink-0 w-20">{label}:</span>
      <span className="font-medium text-slate-700">{value}</span>
    </div>
  );
}

export default function CalendarEventModal({ event, isOpen, onClose }) {
  if (!event) return null;

  const meta = EVENT_META[event.eventType] || EVENT_META.meal;
  const Icon = meta.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <Icon className={`w-4 h-4 shrink-0 ${meta.iconCls}`} />
            <span>{meta.label}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 text-sm text-slate-700">
          <Row label="קבוצה"  value={event.groupName} />
          <Row label="תאריך"  value={moment(event.date).format("DD/MM/YYYY")} />
          {event.timeRange    && <Row label="שעות"     value={event.timeRange} />}
          {event.pax          && <Row label="משתתפים"  value={`${event.pax} אנשים`} />}
          {event.mealType     && <Row label="ארוחה"    value={MEAL_TYPE_LABELS[event.mealType] || event.mealType} />}
          {event.activityName && <Row label="פעילות"   value={event.activityName} />}
          {event.spaceName    && <Row label="מיקום"    value={event.spaceName} />}
          {event.notes        && <Row label="הערות"    value={event.notes} />}

          <div className="flex flex-wrap gap-1 mt-1">
            {event.sandwichOption && (
              <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                🥪 סנדוויץ׳
              </span>
            )}
            {event.specialDietsSummary && (
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                🥗 תזונה מיוחדת
              </span>
            )}
          </div>

          {event.groupId && (
            <Link
              to={`/groups/${event.groupId}`}
              onClick={onClose}
              className="flex items-center gap-1.5 text-primary hover:underline pt-2 border-t border-slate-100 mt-2 text-sm font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              פרטי קבוצה
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}