export default function VipSourceSelector({ candidates, value, onChange, tents, neighborhoods }) {
  if (!candidates.length) return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
      לא נמצא שיבוץ פעיל תואם בדיוק לכמות הנדרשת. מקרה זה דורש פיצול שיבוץ קיים ואינו נתמך עדיין בתהליך הבטוח.
    </div>
  );
  if (candidates.length === 1) return null;
  const tentCode = id => tents.find(t => t.id === id)?.code || id;
  const hoodName = id => neighborhoods.find(n => n.id === id)?.name || id;
  return <div className="space-y-1.5">
    <label className="text-xs font-semibold text-slate-600">מעבירים משיבוץ</label>
    <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">בחר שיבוץ מקור</option>
      {candidates.map(row => <option key={row.id} value={row.id}>
        אוהל {tentCode(row.tent_id)} · {hoodName(row.neighborhood_id)} · {row.allocated_pax} איש · {row.gender_group} · {row.allocation_type}
      </option>)}
    </select>
  </div>;
}