import CoffeeCornerTab from "@/components/coffee/CoffeeCornerTab";
import PrisaTab from "@/components/prisa/PrisaTab";

// Combined "קפה / פריסה" section — keeps the existing Coffee Corner UI intact
// and adds the פריסה list/form below it, separated by a divider.
export default function CoffeeAndPrisaTab({ groupId, profile, group }) {
  if (!profile) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        <p>אין פרופיל תפעולי מאושר לקבוצה זו.</p>
        <p className="text-xs mt-1">יש לאשר טופס קבלה כפרופיל תפעולי תחילה.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" dir="rtl">
      <CoffeeCornerTab groupId={groupId} profile={profile} group={group} />
      <div className="border-t border-slate-200" />
      <PrisaTab groupId={groupId} profile={profile} group={group} />
    </div>
  );
}