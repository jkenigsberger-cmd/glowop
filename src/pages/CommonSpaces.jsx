import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import "moment/locale/he";
import { Layers, ChevronLeft, ChevronRight } from "lucide-react";
import SearchBar from "@/components/search/SearchBar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sortActivitySpaces } from "@/lib/activitySpaceUtils";
import { useRoleContext } from "@/lib/RoleContext";

import SpaceOverviewCard from "../components/spaces/SpaceOverviewCard.jsx";
import SpaceDailyView from "../components/spaces/SpaceDailyView.jsx";
import SpaceWeeklyGrid from "../components/spaces/SpaceWeeklyGrid.jsx";
import LogisticsReportTab from "../components/spaces/LogisticsReportTab.jsx";
import ActivitySpaceBlocksPanel from "@/components/spaces/ActivitySpaceBlocksPanel";

moment.locale("he");

export default function CommonSpaces() {
  const { role } = useRoleContext();
  const [tab, setTab] = useState("overview");
  const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM-DD"));
  const [weekPivot, setWeekPivot] = useState(moment());
  const [spaceSearch, setSpaceSearch] = useState("");

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: rawSpaces = [] } = useQuery({
    queryKey: ["spaces-list"],
    queryFn: () => base44.entities.ActivitySpace.list(),
  });
  const activitySpaces = sortActivitySpaces(rawSpaces);

  const filteredSpaces = useMemo(() => {
    const q = spaceSearch.trim().toLowerCase();
    if (!q) return activitySpaces;
    return activitySpaces.filter(s =>
      [s.name, s.code, s.notes].some(f => f && f.toLowerCase().includes(q)) ||
      (s.capacity && String(s.capacity).includes(q))
    );
  }, [activitySpaces, spaceSearch]);

  const { data: scheduleItems = [] } = useQuery({
    queryKey: ["spaces-schedule-items"],
    queryFn: () => base44.entities.GroupScheduleItem.filter({ status: "ACTIVE" }),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["spaces-groups"],
    queryFn: () => base44.entities.Group.list("-arrival_date", 500),
  });

  const { data: spaceBlocks = [] } = useQuery({
    queryKey: ["activity-space-blocks"],
    queryFn: () => base44.entities.ActivitySpaceBlock.list("-start_date", 500),
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const groupById = useMemo(
    () => Object.fromEntries(groups.map((g) => [g.id, g])),
    [groups]
  );

  // Only items that have an activity_space_id (the common-space source of truth)
  const spaceItems = useMemo(
    () =>
      scheduleItems
        .filter((i) => !!i.activity_space_id)
        .map((i) => ({
          ...i,
          groupName: groupById[i.group_id]?.group_name || "—",
          groupId: i.group_id,
        })),
    [scheduleItems, groupById]
  );

  // Items per space (all dates)
  const itemsBySpaceId = useMemo(() => {
    const map = {};
    spaceItems.forEach((i) => {
      (map[i.activity_space_id] = map[i.activity_space_id] || []).push(i);
    });
    return map;
  }, [spaceItems]);

  // Items per space for selected date (daily view)
  const itemsBySpaceForDay = useMemo(() => {
    const map = {};
    spaceItems
      .filter((i) => i.date === selectedDate)
      .forEach((i) => {
        (map[i.activity_space_id] = map[i.activity_space_id] || []).push(i);
      });
    return map;
  }, [spaceItems, selectedDate]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const blocksForSelectedDay = useMemo(
    () => spaceBlocks.filter(b => b.status === "ACTIVE" && b.start_date <= selectedDate && b.end_date >= selectedDate),
    [spaceBlocks, selectedDate]
  );

  const handleWeeklyDayClick = (dateStr) => {
    setSelectedDate(dateStr);
    setTab("daily");
  };

  const shiftDate = (dir) => {
    setSelectedDate((d) => moment(d).add(dir, "day").format("YYYY-MM-DD"));
  };

  const TABS = [
    { id: "overview",  label: "סקירה כללית" },
    { id: "daily",     label: "יומי" },
    { id: "weekly",    label: "שבועי" },
    { id: "blocks",    label: "חסימות מרחבים" },
    { id: "logistics", label: "📋 דוח לוגיסטיקה" },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-5">

        {/* Page header */}
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            מרחבי פעילות
          </h1>
          <p className="text-sm text-muted-foreground">
            צפייה בלבד — עריכה ב-GroupDetail / לוח שנה
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
                tab === t.id
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="space-y-4">
            <SearchBar
              value={spaceSearch}
              onChange={setSpaceSearch}
              placeholder="חפש לפי שם מרחב, קיבולת, ציוד..."
              className="max-w-sm"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredSpaces.map((space) => (
                <SpaceOverviewCard
                  key={space.id}
                  space={space}
                  items={itemsBySpaceId[space.id] || []}
                  onSelectDay={(date) => {
                    setSelectedDate(date);
                    setTab("daily");
                  }}
                />
              ))}
              {filteredSpaces.length === 0 && (
                <p className="col-span-4 text-sm text-slate-400 text-center py-12">
                  {spaceSearch ? "לא נמצאו תוצאות" : "לא נמצאו מרחבי פעילות במלאי."}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── DAILY TAB ────────────────────────────────────────────────────── */}
        {tab === "daily" && (
          <div className="space-y-4">
            {/* Date picker controls */}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => shiftDate(-1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <Button size="sm" variant="outline" onClick={() => shiftDate(1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedDate(moment().format("YYYY-MM-DD"))}
                className="px-3"
              >
                היום
              </Button>
              <span className="text-sm font-semibold text-slate-700">
                {moment(selectedDate).format("dddd, D MMMM YYYY")}
              </span>
            </div>

            <SpaceDailyView
              spaces={activitySpaces}
              itemsBySpace={itemsBySpaceForDay}
              blocks={blocksForSelectedDay}
              date={selectedDate}
            />
          </div>
        )}

        {tab === "blocks" && (
          <ActivitySpaceBlocksPanel spaces={activitySpaces} blocks={spaceBlocks} role={role} />
        )}

        {/* ── LOGISTICS REPORT TAB ─────────────────────────────────────────── */}
        {tab === "logistics" && <LogisticsReportTab />}

        {/* ── WEEKLY TAB ───────────────────────────────────────────────────── */}
        {tab === "weekly" && (
          <div className="space-y-4">
            {/* Week navigation */}
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setWeekPivot((p) => p.clone().subtract(1, "week"))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setWeekPivot(moment())} className="px-3">
                השבוע
              </Button>
              <Button size="sm" variant="outline" onClick={() => setWeekPivot((p) => p.clone().add(1, "week"))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-semibold text-slate-700">
                {weekPivot.clone().startOf("isoWeek").format("D MMM")}
                {" – "}
                {weekPivot.clone().endOf("isoWeek").format("D MMM YYYY")}
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <SpaceWeeklyGrid
                spaces={activitySpaces}
                allItems={spaceItems}
                blocks={spaceBlocks}
                pivot={weekPivot}
                onSelectDay={handleWeeklyDayClick}
              />
            </div>

            <p className="text-xs text-slate-400">
              לחץ על תא עם הזמנות כדי לעבור לתצוגה יומית.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}