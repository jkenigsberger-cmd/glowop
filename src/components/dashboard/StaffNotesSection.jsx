import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useRoleContext } from "@/lib/RoleContext";
import { Plus, Pencil, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import StaffNoteDialog from "@/components/dashboard/StaffNoteDialog";

export default function StaffNotesSection({ selectedDate }) {
  const { role } = useRoleContext();
  const canManage = role === "SUPER_ADMIN" || role === "ADMIN";
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: notes = [] } = useQuery({
    queryKey: ["dashboardStaffNotes", selectedDate],
    queryFn: () => base44.entities.DashboardStaffNote.filter({ active: true }, "-date", 200),
  });

  const visible = notes
    .filter(n => {
      const end = n.end_date || n.date;
      return n.date <= selectedDate && selectedDate <= end;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["dashboardStaffNotes"] });

  const handleSave = async (payload) => {
    if (editing) {
      await base44.entities.DashboardStaffNote.update(editing.id, payload);
    } else {
      await base44.entities.DashboardStaffNote.create({ ...payload, active: true });
    }
    invalidate();
  };

  const handleDelete = async (id) => {
    if (!confirm("למחוק את ההודעה?")) return;
    await base44.entities.DashboardStaffNote.update(id, { active: false });
    invalidate();
  };

  return (
    <div className="space-y-2">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="w-3.5 h-3.5" /> הוסף הודעה לצוות
          </Button>
        </div>
      )}
      {visible.map(note => (
        <div key={note.id} className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-700 mb-0.5">הודעה לצוות{note.end_date ? ` · ${note.date} עד ${note.end_date}` : ` · ${note.date}`}</p>
            <p className="text-sm text-blue-900 whitespace-pre-line">{note.message}</p>
          </div>
          {canManage && (
            <div className="flex gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(note); setDialogOpen(true); }}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(note.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      ))}
      <StaffNoteDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        editingNote={editing}
        defaultDate={selectedDate}
      />
    </div>
  );
}