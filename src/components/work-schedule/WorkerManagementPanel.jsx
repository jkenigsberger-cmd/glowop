import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import WorkerTable from "@/components/work-schedule/WorkerTable";
import WorkerFormDialog from "@/components/work-schedule/WorkerFormDialog";

export default function WorkerManagementPanel() {
  const [editing, setEditing] = useState(null); const [creating, setCreating] = useState(false); const [error, setError] = useState(""); const queryClient = useQueryClient();
  const { data: workers = [], isLoading } = useQuery({ queryKey: ["workerManagement"], queryFn: async () => (await base44.functions.invoke("manageWorkerProfiles", { action: "list" })).data.workers });
  const refresh = async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["workerManagement"] }), queryClient.invalidateQueries({ queryKey: ["workerProfiles"] })]); };
  const save = async (worker) => { await base44.functions.invoke("manageWorkerProfiles", { action: "save", worker_id: editing?.id, worker }); setEditing(null); setCreating(false); await refresh(); };
  const toggle = async (worker) => { setError(""); try { await base44.functions.invoke("manageWorkerProfiles", { action: "toggle", worker_id: worker.id, is_active: worker.is_active === false }); await refresh(); } catch (err) { setError(err.response?.data?.error || err.message); } };
  return <section className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-800">ניהול עובדים</h2><p className="text-sm text-slate-500">עריכה, הפעלה וקישור למשתמשי מערכת קיימים</p></div><Button onClick={() => setCreating(true)}><Plus className="w-4 h-4" /> עובד חדש</Button></div>
    {error && <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}{isLoading ? <p className="py-10 text-center text-sm text-slate-400">טוען...</p> : <WorkerTable workers={workers} onEdit={setEditing} onToggle={toggle} />}
    {(editing || creating) && <WorkerFormDialog worker={editing} onSave={save} onClose={() => { setEditing(null); setCreating(false); }} />}
  </section>;
}