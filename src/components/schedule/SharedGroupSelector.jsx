/**
 * SharedGroupSelector — search and select extra groups to share an activity with.
 */
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { X, Users } from "lucide-react";

export default function SharedGroupSelector({ currentGroupId, selectedGroups, onChange }) {
  const [query, setQuery] = useState("");
  const [allGroups, setAllGroups] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Lazy-load groups on first interaction
  const loadGroups = async () => {
    if (loaded) return;
    setLoaded(true);
    const { base44 } = await import("@/api/base44Client");
    const groups = await base44.entities.Group.list("-arrival_date", 200);
    setAllGroups(groups);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allGroups.filter(g => {
      if (g.id === currentGroupId) return false;
      if (selectedGroups.some(s => s.id === g.id)) return false;
      const relevant = ["CONFIRMED", "PENDING_APPROVAL", "DRAFT"].includes(g.status);
      if (!relevant) return false;
      return !q || (g.group_name || "").toLowerCase().includes(q);
    });
  }, [allGroups, query, currentGroupId, selectedGroups]);

  const addGroup = (group) => {
    onChange([...selectedGroups, group]);
    setQuery("");
  };

  const removeGroup = (id) => {
    onChange(selectedGroups.filter(g => g.id !== id));
  };

  const formatDates = (g) => {
    if (!g.arrival_date) return null;
    return `${g.arrival_date}${g.departure_date ? " — " + g.departure_date : ""}`;
  };

  return (
    <div className="space-y-2">
      <Input
        placeholder="חפש קבוצות נוספות..."
        value={query}
        onChange={e => { setQuery(e.target.value); loadGroups(); }}
        onFocus={loadGroups}
        className="text-sm"
      />

      {/* Dropdown results */}
      {query && filtered.length > 0 && (
        <div className="border border-slate-200 rounded-lg bg-white shadow-sm max-h-48 overflow-y-auto">
          {filtered.slice(0, 20).map(g => (
            <button
              key={g.id}
              type="button"
              onClick={() => addGroup(g)}
              className="w-full text-right flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors text-sm"
            >
              <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="flex-1 font-medium text-slate-800">{g.group_name}</span>
              {formatDates(g) && (
                <span className="text-xs text-slate-400 shrink-0">{formatDates(g)}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {query && loaded && filtered.length === 0 && (
        <p className="text-xs text-slate-400 px-1">לא נמצאו קבוצות מתאימות</p>
      )}

      {/* Selected chips */}
      {selectedGroups.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-slate-500">קבוצות שנבחרו:</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedGroups.map(g => (
              <span
                key={g.id}
                className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-0.5 text-xs font-medium"
              >
                {g.group_name}
                {g.arrival_date && (
                  <span className="text-primary/60">{g.arrival_date}</span>
                )}
                <button
                  type="button"
                  onClick={() => removeGroup(g.id)}
                  className="hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">הפעילות תופיע בתוכנית של כל הקבוצות שנבחרו</p>
        </div>
      )}
    </div>
  );
}