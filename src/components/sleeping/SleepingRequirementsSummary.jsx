/**
 * Displays the sleeping requirements from the OperationalGroupProfile
 * and shows remaining-to-allocate counters based on current allocations.
 */
export default function SleepingRequirementsSummary({ profile, allocations }) {
  if (!profile) return null;

  const boys   = Number(profile.boys_count)           || 0;
  const girls  = Number(profile.girls_count)          || 0;
  const staffM = Number(profile.drivers_men_count)    || 0;
  const staffW = Number(profile.drivers_women_count)  || 0;

  const activeAllocs = allocations.filter(a => a.status !== 'CANCELLED');

  const allocatedBoys   = activeAllocs.filter(a => a.gender_group === 'BOYS').reduce((s, a)  => s + Number(a.allocated_pax), 0);
  const allocatedGirls  = activeAllocs.filter(a => a.gender_group === 'GIRLS').reduce((s, a) => s + Number(a.allocated_pax), 0);
  const allocatedMen    = activeAllocs.filter(a => a.gender_group === 'MEN').reduce((s, a)   => s + Number(a.allocated_pax), 0);
  const allocatedWomen  = activeAllocs.filter(a => a.gender_group === 'WOMEN').reduce((s, a) => s + Number(a.allocated_pax), 0);

  const remBoys  = boys  - allocatedBoys;
  const remGirls = girls - allocatedGirls;
  const remMen   = staffM - allocatedMen;
  const remWomen = staffW - allocatedWomen;

  const Counter = ({ label, required, remaining, color }) => (
    <div className={`rounded-xl border px-3 py-2.5 flex flex-col items-center gap-0.5 ${color}`}>
      <span className="text-[10px] text-slate-500 font-medium">{label}</span>
      <span className="text-xl font-bold leading-none">{remaining < 0 ? `+${Math.abs(remaining)}` : remaining}</span>
      <span className="text-[10px] text-slate-400">מתוך {required}</span>
    </div>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-700">דרישות לינה</h3>
      <div className="grid grid-cols-4 gap-2">
        <Counter label="בנים נותרו" required={boys}   remaining={remBoys}
          color={remBoys === 0 ? "bg-green-50 border-green-200 text-green-700" : remBoys < 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-blue-50 border-blue-200 text-blue-700"} />
        <Counter label="בנות נותרו" required={girls}  remaining={remGirls}
          color={remGirls === 0 ? "bg-green-50 border-green-200 text-green-700" : remGirls < 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-pink-50 border-pink-200 text-pink-700"} />
        <Counter label="צוות גברים נותרו" required={staffM} remaining={remMen}
          color={remMen === 0 ? "bg-green-50 border-green-200 text-green-700" : remMen < 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"} />
        <Counter label="צוות נשים נותרו" required={staffW} remaining={remWomen}
          color={remWomen === 0 ? "bg-green-50 border-green-200 text-green-700" : remWomen < 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-purple-50 border-purple-200 text-purple-700"} />
      </div>

      {(boys + girls) > 0 && (boys + girls) !== Number(profile.participant_count) && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          ⚠️ בנים ({boys}) + בנות ({girls}) = {boys + girls}, אך סה״כ חניכים הוא {profile.participant_count}
        </p>
      )}
    </div>
  );
}