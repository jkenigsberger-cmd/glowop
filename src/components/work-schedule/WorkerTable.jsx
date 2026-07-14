import { Button } from "@/components/ui/button";
import { WORKER_TEAMS } from "@/lib/workScheduleConfig";

const teamLabel = (id) => WORKER_TEAMS.find((team) => team.id === id)?.label || "אחר";

export default function WorkerTable({ workers, onEdit, onToggle }) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
    <table className="w-full min-w-[920px] text-sm">
      <thead className="bg-slate-50 text-slate-500"><tr>{["שם", "אימייל", "טלפון", "צוות / תפקיד", "משתמש מערכת", "פעיל", "הערות", "פעולות"].map((label) => <th key={label} className="p-3 text-right font-medium">{label}</th>)}</tr></thead>
      <tbody>{workers.map((worker) => <tr key={worker.id} className="border-t border-slate-100">
        <td className="p-3 font-semibold text-slate-800">{worker.full_name}</td>
        <td className="p-3" dir="ltr">{worker.email || worker.internal_user_email || "—"}</td>
        <td className="p-3" dir="ltr">{worker.phone || "—"}</td><td className="p-3">{teamLabel(worker.default_team)}</td>
        <td className="p-3">{worker.internal_user_id ? <span className="text-emerald-700">משתמש מערכת מקושר</span> : <span className="text-slate-400">ללא משתמש מערכת</span>}</td>
        <td className="p-3">{worker.is_active !== false ? "כן" : "לא"}</td><td className="p-3 max-w-48 truncate">{worker.notes || "—"}</td>
        <td className="p-3"><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => onEdit(worker)}>עריכה</Button><Button size="sm" variant="outline" onClick={() => onToggle(worker)}>{worker.is_active !== false ? "השבת" : "הפעל מחדש"}</Button></div></td>
      </tr>)}</tbody>
    </table>
    {workers.length === 0 && <p className="p-8 text-center text-sm text-slate-400">לא נמצאו עובדים</p>}
  </div>;
}