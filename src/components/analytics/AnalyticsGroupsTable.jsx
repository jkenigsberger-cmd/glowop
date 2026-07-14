const typeLabel = { LODGING: "לינה", DAY_USE: "יום", UNKNOWN: "לא ידוע" };
export default function AnalyticsGroupsTable({ groups }) {
  return <section className="rounded-xl border bg-card overflow-hidden"><div className="p-4 border-b"><h2 className="font-semibold">קבוצות בחודש</h2><p className="text-xs text-muted-foreground mt-1">כל קבוצה נספרת פעם אחת בסך המשתתפים</p></div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/60 text-muted-foreground"><tr>{["קבוצה", "כניסה", "יציאה", "סוג", "משתתפים", "לילות בחודש", "לינות אדם"].map(label => <th key={label} className="px-4 py-3 text-right whitespace-nowrap">{label}</th>)}</tr></thead>
      <tbody>{groups.map(group => <tr key={group.id} className="border-t"><td className="px-4 py-3 font-medium min-w-48">{group.group_name}</td><td className="px-4 py-3 whitespace-nowrap">{group.arrival_date}</td><td className="px-4 py-3 whitespace-nowrap">{group.departure_date}</td><td className="px-4 py-3">{typeLabel[group.group_type] || group.group_type}</td><td className="px-4 py-3">{group.total_pax}</td><td className="px-4 py-3">{group.nights_inside_period}</td><td className="px-4 py-3">{group.person_nights}</td></tr>)}</tbody>
    </table>{groups.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">אין קבוצות להצגה בחודש זה</p>}</div>
  </section>;
}