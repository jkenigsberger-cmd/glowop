const formatDate = value => value ? value.split("-").reverse().join(".") : "—";

export default function StayPeriodsReadOnly({ periods = [] }) {
  return (
    <section className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
      <div>
        <h3 className="text-base font-semibold">תקופות שהייה</h3>
        <p className="text-xs text-amber-700 mt-1">
          לאחר הפעלת המכינה, שינוי תקופות השהייה מנוהל בנפרד כדי להגן על הארוחות, הלינה והתפעול.
        </p>
      </div>
      <div className="space-y-2">
        {periods.map((period, index) => (
          <div key={period.id || period._draft_id || index} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <p className="font-medium">תקופה {index + 1}: {formatDate(period.start_date)}–{formatDate(period.end_date)}</p>
            {(period.arrival_time || period.departure_time) && (
              <p className="text-xs text-muted-foreground mt-1">
                הגעה: {period.arrival_time || "—"} · יציאה: {period.departure_time || "—"}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}