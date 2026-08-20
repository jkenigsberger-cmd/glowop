import { Sandwich } from "lucide-react";
import KitchenMealCard from "@/components/kitchen/KitchenMealCard";

export default function KitchenSandwichSection({ meals, groupMap, profileMap }) {
  if (meals.length === 0) return null;

  const totalPax = meals.reduce((sum, meal) => sum + (Number(meal.pax) || 0), 0);

  return (
    <section className="space-y-3">
      <div className="flex items-center rounded-xl border border-orange-200 bg-orange-100 px-4 py-2.5 text-orange-800">
        <div className="flex items-center gap-2 text-base font-bold">
          <Sandwich className="h-5 w-5" />
          <span>סנדוויצ&apos;ים · סה״כ {totalPax} מנות</span>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {meals.map((meal) => (
          <KitchenMealCard
            key={meal.id}
            meal={meal}
            group={groupMap[meal.group_id]}
            profile={profileMap[meal.group_id]}
          />
        ))}
      </div>
    </section>
  );
}