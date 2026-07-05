import { LogIn, LogOut, Sun, Users, UtensilsCrossed, Coffee, Package, Layers, Wrench } from "lucide-react";

function Row({ children }) {
  return <li className="text-sm text-slate-700 leading-relaxed">{children}</li>;
}

function Block({ title, icon: Icon, children, empty }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wide">
        {Icon && <Icon className="w-3.5 h-3.5" />} {title}
      </h4>
      {empty ? <p className="text-xs text-slate-400">—</p> : <ul className="space-y-1 pr-1">{children}</ul>}
    </div>
  );
}

const timeRange = (s, e) => (s && e ? `${s}–${e}` : s || e || "");

const DIET_MAP = {
  vegetarian_count: "צמחונים",
  vegan_count: "טבעונים",
  glutenFree_count: "ללא גלוטן",
  lifeThreatening_count: "אלרגיה מסכנת חיים",
  nutFree_count: "ללא אגוזים",
  eggFree_count: "ללא ביצים",
  lactoseFree_count: "ללא לקטוז",
};

function dietStr(diets) {
  if (!diets) return "";
  const out = [];
  for (const k of Object.keys(DIET_MAP)) {
    if (diets[k] && Number(diets[k]) > 0) out.push(`${DIET_MAP[k]}: ${diets[k]}`);
  }
  return out.join(" · ");
}

export default function AutoSummaryPreview({ summary }) {
  if (!summary) {
    return (
      <p className="text-sm text-slate-400 py-4 text-center">
        לחצו "צור תדריך יומי" כדי לשלוף נתונים מהמערכת לתאריך הנבחר.
      </p>
    );
  }

  const g = summary.groups || {};

  return (
    <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
      <Block title="קבוצות היום" icon={Users} empty={!(g.arrivals?.length || g.departures?.length || g.sleeping?.length || g.day_use?.length)}>
        {(g.arrivals || []).map((a, i) => (
          <Row key={`ar${i}`}><LogIn className="w-3 h-3 inline text-emerald-600 ml-1" />נכנסת: {a.name}{a.arrival_time ? ` (${a.arrival_time})` : ""}{a.pax ? ` — ${a.pax}` : ""}</Row>
        ))}
        {(g.departures || []).map((d, i) => (
          <Row key={`de${i}`}><LogOut className="w-3 h-3 inline text-orange-600 ml-1" />יוצאת: {d.name}{d.departure_time ? ` (${d.departure_time})` : ""}</Row>
        ))}
        {(g.day_use || []).map((d, i) => (
          <Row key={`du${i}`}><Sun className="w-3 h-3 inline text-amber-500 ml-1" />באי יום: {d.name}{timeRange(d.arrival_time, d.departure_time) ? ` (${timeRange(d.arrival_time, d.departure_time)})` : ""}{d.pax ? ` — ${d.pax}` : ""}</Row>
        ))}
        {(g.sleeping || []).map((s, i) => (
          <Row key={`sl${i}`}>לנים: {s.name}{s.pax ? ` — ${s.pax}` : ""}</Row>
        ))}
      </Block>

      <Block title="ארוחות" icon={UtensilsCrossed} empty={!summary.meals?.length}>
        {(summary.meals || []).map((m, i) => (
          <Row key={i}>
            {m.label}{timeRange(m.start_time, m.end_time) ? ` — ${timeRange(m.start_time, m.end_time)}` : ""}{m.pax != null ? ` — ${m.pax} משתתפים` : ""} <span className="text-slate-400">({m.group})</span>
            {dietStr(m.diets) && <span className="block text-xs text-slate-500 pr-3">{dietStr(m.diets)}</span>}
          </Row>
        ))}
      </Block>

      <Block title="פינות קפה" icon={Coffee} empty={!summary.coffee_corner?.length}>
        {(summary.coffee_corner || []).map((c, i) => (
          <Row key={i}>{c.group}{timeRange(c.start_time, c.end_time) ? ` — ${timeRange(c.start_time, c.end_time)}` : ""}{c.location ? ` — ${c.location}` : ""}{c.pax != null ? ` — ${c.pax}` : ""}{c.type ? ` (${c.type})` : ""}</Row>
        ))}
      </Block>

      <Block title="פריסה" icon={Package} empty={!summary.prisa?.length}>
        {(summary.prisa || []).map((p, i) => (
          <Row key={i}>{p.group}{p.slot ? ` — ${p.slot}` : ""}{p.quantity != null ? ` — כמות ${p.quantity}` : ""}{p.type ? ` (${p.type})` : ""}</Row>
        ))}
      </Block>

      <Block title="מרחבי פעילות לתשומת לב" icon={Layers} empty={!summary.activity_spaces?.length}>
        {(summary.activity_spaces || []).map((s, i) => (
          <Row key={i}>
            <span className="font-semibold">{s.space_name}</span>{timeRange(s.first_use, s.last_use) ? ` — ${timeRange(s.first_use, s.last_use)}` : ""} ({s.activity_count} פעילויות)
            {s.equipment?.length > 0 && <span className="block text-xs text-slate-500 pr-3">ציוד: {s.equipment.join(", ")}</span>}
            {(s.recommendations || []).map((r, ri) => <span key={ri} className="block text-xs text-amber-700 pr-3">⚠ {r}</span>)}
          </Row>
        ))}
      </Block>

      <Block title="תחזוקה פתוחה" icon={Wrench} empty={!summary.maintenance?.length}>
        {(summary.maintenance || []).map((m, i) => (
          <Row key={i}>{[m.location, m.title].filter(Boolean).join(" — ")}{m.priority ? ` (${m.priority})` : ""}</Row>
        ))}
      </Block>
    </div>
  );
}