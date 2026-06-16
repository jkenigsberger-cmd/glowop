import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Users, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABELS = {
  DRAFT:     "טיוטה",
  CONFIRMED: "מאושר",
  COMPLETED: "הושלם",
  CANCELLED: "בוטל",
  ARCHIVED:  "ארכיון",
};

const GROUP_TYPE_HEB = {
  LODGING: "לינה",
  DAY_USE: "באי יום",
};

function highlight(text, query) {
  if (!text || !query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 text-yellow-800 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function GlobalSearch({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const { data: groups = [] } = useQuery({
    queryKey: ["global-search-groups"],
    queryFn: () => base44.entities.Group.list("arrival_date", 500),
    staleTime: 30_000,
  });

  const { data: spaces = [] } = useQuery({
    queryKey: ["global-search-spaces"],
    queryFn: () => base44.entities.ActivitySpace.list(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setActiveIdx(0);
    }
  }, [isOpen]);

  const q = query.trim().toLowerCase();

  const matchedGroups = useMemo(() => {
    if (!q) return groups.slice(0, 5);
    return groups.filter(g =>
      [g.group_name, g.contact_name, g.contact_phone, g.contact_email, g.internal_notes]
        .some(f => f && f.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [groups, q]);

  const matchedSpaces = useMemo(() => {
    if (!q) return spaces.slice(0, 4);
    return spaces.filter(s =>
      [s.name, s.code, s.notes]
        .some(f => f && f.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [spaces, q]);

  const allResults = useMemo(() => [
    ...matchedGroups.map(g => ({ type: "group", data: g })),
    ...matchedSpaces.map(s => ({ type: "space", data: s })),
  ], [matchedGroups, matchedSpaces]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  const handleSelect = (item) => {
    if (item.type === "group") {
      navigate(`/groups/${item.data.id}`);
    } else if (item.type === "space") {
      navigate("/common-spaces");
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, allResults.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && allResults[activeIdx]) handleSelect(allResults[activeIdx]);
    if (e.key === "Escape") onClose();
  };

  if (!isOpen) return null;

  const showEmpty = q && allResults.length === 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 px-4" dir="rtl">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="חפש קבוצה, מרחב פעילות, אוהל..."
            className="flex-1 text-sm text-slate-800 placeholder:text-slate-400 outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 border border-slate-200 rounded-md">
            Esc
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {showEmpty && (
            <p className="text-sm text-slate-400 text-center py-10">לא נמצאו תוצאות</p>
          )}

          {/* Groups section */}
          {matchedGroups.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">קבוצות</span>
              </div>
              {matchedGroups.map((g, i) => {
                const globalIdx = i;
                const isActive = activeIdx === globalIdx;
                return (
                  <button
                    key={g.id}
                    onClick={() => handleSelect({ type: "group", data: g })}
                    onMouseEnter={() => setActiveIdx(globalIdx)}
                    className={cn(
                      "w-full text-right flex items-center gap-3 px-4 py-3 border-b border-slate-50 transition-colors",
                      isActive ? "bg-primary/5" : "hover:bg-slate-50"
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-800">{highlight(g.group_name, q || "")}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">
                          {GROUP_TYPE_HEB[g.group_type] || g.group_type}
                        </span>
                        {g.status && (
                          <span className="text-[10px] bg-blue-50 text-blue-600 rounded px-1.5 py-0.5">
                            {STATUS_LABELS[g.status] || g.status}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {g.arrival_date || "—"}{g.departure_date ? ` → ${g.departure_date}` : ""}
                        {g.total_pax ? ` · ${g.total_pax} אנשים` : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Spaces section */}
          {matchedSpaces.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">מרחבי פעילות</span>
              </div>
              {matchedSpaces.map((s, i) => {
                const globalIdx = matchedGroups.length + i;
                const isActive = activeIdx === globalIdx;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleSelect({ type: "space", data: s })}
                    onMouseEnter={() => setActiveIdx(globalIdx)}
                    className={cn(
                      "w-full text-right flex items-center gap-3 px-4 py-3 border-b border-slate-50 transition-colors",
                      isActive ? "bg-primary/5" : "hover:bg-slate-50"
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-slate-800">{highlight(s.name, q || "")}</span>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {s.capacity ? `קיבולת: ${s.capacity}` : ""}
                        {s.code ? ` · ${s.code}` : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!q && (
            <p className="text-xs text-slate-400 text-center py-4">התחל להקליד לחיפוש מהיר</p>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-4 text-[11px] text-slate-400">
          <span>↑↓ ניווט</span>
          <span>↵ בחירה</span>
          <span>Esc סגירה</span>
        </div>
      </div>
    </div>
  );
}