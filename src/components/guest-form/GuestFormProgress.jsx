export default function GuestFormProgress({ steps, currentStep }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={s.key} className="flex items-center gap-1 flex-shrink-0">
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              active ? "bg-primary text-white" :
              done ? "bg-emerald-100 text-emerald-700" :
              "bg-slate-100 text-slate-400"
            }`}>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                active ? "bg-white/20" : done ? "bg-emerald-200" : "bg-slate-200"
              }`}>
                {done ? "✓" : i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-4 h-0.5 flex-shrink-0 ${done ? "bg-emerald-300" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}