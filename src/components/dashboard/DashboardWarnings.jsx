import { Link } from "react-router-dom";
import { AlertTriangle, ChevronLeft } from "lucide-react";

function WarningBlock({ title, items, linkBase }) {
  if (items.length === 0) return null;
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
      <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
        <AlertTriangle className="w-4 h-4" /> {title} ({items.length})
      </p>
      <div className="space-y-1">
        {items.map(item => (
          <Link
            key={item.id}
            to={`${linkBase}/${item.id}`}
            className="flex items-center justify-between text-xs text-red-800 bg-white border border-red-100 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
          >
            <span>{item.label}</span>
            <ChevronLeft className="w-3 h-3" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function InfoBlock({ title, items }) {
  if (items.length === 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
      <p className="text-sm font-semibold text-amber-700 flex items-center gap-1.5">
        <AlertTriangle className="w-4 h-4" /> {title} ({items.length})
      </p>
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between text-xs text-amber-800 bg-white border border-amber-100 rounded-lg px-3 py-1.5">
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardWarnings({ warnings }) {
  const hasAny = Object.values(warnings).some(arr => arr.length > 0);
  if (!hasAny) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700 font-medium text-center">
        ✓ אין התראות תפעוליות פעילות
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <WarningBlock
        title="קבוצות ללא פרופיל תפעולי מאושר"
        items={warnings.noProfile}
        linkBase="/groups"
      />
      <WarningBlock
        title="פרופיל מאושר — דרישות לינה לא הושלמו"
        items={warnings.incompleteSleeeping}
        linkBase="/groups"
      />
      <InfoBlock
        title="מוכן למשק בית — ממתין לשיבוץ אוהלים"
        items={warnings.pendingAllocation}
      />
      <InfoBlock
        title="תקלות תחזוקה פעילות"
        items={warnings.brokenItems}
      />
    </div>
  );
}