import { Input } from "@/components/ui/input";

export default function StaffGenderSplitEditor({ total, men, women, onChange }) {
  const totalValue = Number(total) || 0;
  const menValue = men == null ? "" : men;
  const womenValue = women == null ? "" : women;
  const sum = Number(men || 0) + Number(women || 0);
  const mismatch = sum !== totalValue;

  const setMen = value => {
    if (value === "") return onChange(null, null);
    const nextMen = Math.max(0, Math.min(Number(value), totalValue));
    onChange(nextMen, totalValue - nextMen);
  };

  const setWomen = value => {
    if (value === "") return onChange(null, null);
    const nextWomen = Math.max(0, Math.min(Number(value), totalValue));
    onChange(totalValue - nextWomen, nextWomen);
  };

  return (
    <div className="space-y-2 mt-1">
      <div className="grid grid-cols-2 gap-2">
        <label className="rounded-lg border border-emerald-300 bg-emerald-100 px-2 py-1.5 text-center">
          <span className="block text-[10px] font-semibold text-emerald-700">גברים</span>
          <Input type="number" min="0" max={totalValue} value={menValue} onChange={e => setMen(e.target.value)} className="h-7 border-0 bg-transparent p-0 text-center text-base font-bold text-emerald-800 shadow-none" />
        </label>
        <label className="rounded-lg border border-orange-300 bg-orange-100 px-2 py-1.5 text-center">
          <span className="block text-[10px] font-semibold text-orange-700">נשים</span>
          <Input type="number" min="0" max={totalValue} value={womenValue} onChange={e => setWomen(e.target.value)} className="h-7 border-0 bg-transparent p-0 text-center text-base font-bold text-orange-800 shadow-none" />
        </label>
      </div>
      {mismatch && <p className="text-[11px] font-medium text-red-600">יש לחלק בדיוק {totalValue} אנשי צוות בין גברים לנשים.</p>}
    </div>
  );
}