export default function PeopleSummaryCard({ profile }) {
  const rows = [
    { label: 'סה"כ אנשים',       value: profile.total_pax,        color: 'text-slate-800 font-bold text-lg' },
    { label: 'חניכים / תלמידים', value: profile.participant_count, color: 'text-blue-700 font-semibold' },
    { label: 'צוות / מבוגרים',   value: profile.staff_count,       color: 'text-purple-700 font-semibold' },
    null, // spacer
    { label: 'בנים',             value: profile.boys_count,        color: 'text-blue-600' },
    { label: 'בנות',             value: profile.girls_count,       color: 'text-pink-600' },
    null,
    { label: 'צוות גברים',       value: profile.drivers_men_count  ?? profile.staff_men_beds_needed, color: 'text-purple-600' },
    { label: 'צוות נשים',        value: profile.drivers_women_count ?? profile.staff_women_beds_needed, color: 'text-fuchsia-600' },
  ];

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">סיכום משתתפים</p>
      <div className="grid grid-cols-3 gap-x-6 gap-y-2">
        {rows.map((row, i) => {
          if (!row) return <div key={i} className="col-span-3 border-t border-slate-200 my-1" />;
          return (
            <div key={i} className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{row.label}</span>
              <span className={`text-sm ${row.color}`}>
                {row.value != null ? row.value : <span className="text-slate-300 text-xs">לא הוגדר</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}