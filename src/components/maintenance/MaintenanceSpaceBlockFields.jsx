export default function MaintenanceSpaceBlockFields({ form, set }) {
  if (!form.can_block_space) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3">
      <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
        <input type="checkbox" checked={form.block_space} onChange={e => set("block_space", e.target.checked)} />
        חסום מרחב להזמנות
      </label>
      {form.block_space && <>
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.block_open_ended} onChange={e => set("block_open_ended", e.target.checked)} /> חסום עד תיקון / ללא תאריך סיום</label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs space-y-1"><span>תאריך התחלה</span><input required type="date" value={form.block_start_date} onChange={e => set("block_start_date", e.target.value)} className="w-full rounded-lg border px-2 py-2 bg-white" /></label>
          <label className="text-xs space-y-1"><span>שעת התחלה</span><input required type="time" value={form.block_start_time} onChange={e => set("block_start_time", e.target.value)} className="w-full rounded-lg border px-2 py-2 bg-white" /></label>
          {!form.block_open_ended && <><label className="text-xs space-y-1"><span>תאריך סיום</span><input required type="date" value={form.block_end_date} onChange={e => set("block_end_date", e.target.value)} className="w-full rounded-lg border px-2 py-2 bg-white" /></label><label className="text-xs space-y-1"><span>שעת סיום</span><input required type="time" value={form.block_end_time} onChange={e => set("block_end_time", e.target.value)} className="w-full rounded-lg border px-2 py-2 bg-white" /></label></>}
        </div>
      </>}
    </div>
  );
}