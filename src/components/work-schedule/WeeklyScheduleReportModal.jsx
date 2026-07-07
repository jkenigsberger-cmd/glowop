import { Copy, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import PersonalWorkerMessageTab from "@/components/work-schedule/PersonalWorkerMessageTab";
import WeeklyScheduleReportDays from "@/components/work-schedule/WeeklyScheduleReportDays";
import WeeklyScheduleReportWorkers from "@/components/work-schedule/WeeklyScheduleReportWorkers";
import { generateWeeklySchedulePrintHtml, generateWeeklyWhatsAppText, generateWorkersOnlyText } from "@/lib/weeklyScheduleReport";

export default function WeeklyScheduleReportModal({ open, onClose, schedule, shifts, weekStart, workers = [] }) {
  const { toast } = useToast();
  const generalText = generateWeeklyWhatsAppText(schedule, shifts, weekStart);
  const workersText = generateWorkersOnlyText(schedule, shifts, weekStart);

  const copyText = async (text, message) => {
    await navigator.clipboard.writeText(text);
    toast({ description: message });
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(generateWeeklySchedulePrintHtml(schedule, shifts, weekStart));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader><DialogTitle className="text-base">דוח שבועי</DialogTitle></DialogHeader>
        <Tabs defaultValue="workers" className="w-full">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <TabsList>
              <TabsTrigger value="workers">לפי עובדים</TabsTrigger>
              <TabsTrigger value="personal">הודעה לעובד</TabsTrigger>
              <TabsTrigger value="days">לפי ימים</TabsTrigger>
              <TabsTrigger value="whatsapp">טקסט ל-WhatsApp</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2 flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={() => copyText(generalText, "הדוח הכללי הועתק")}> <Copy className="w-4 h-4" /> העתק דוח כללי</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => copyText(workersText, "דוח לפי עובדים הועתק")}> <Copy className="w-4 h-4" /> העתק לפי עובדים</Button>
              <Button type="button" variant="outline" size="sm" onClick={handlePrint}> <Printer className="w-4 h-4" /> הדפס / PDF</Button>
            </div>
          </div>
          <TabsContent value="workers" className="mt-4">
            <WeeklyScheduleReportWorkers schedule={schedule} shifts={shifts} weekStart={weekStart} onCopyWorker={(text) => copyText(text, "ההודעה לעובד הועתקה")} />
          </TabsContent>
          <TabsContent value="personal" className="mt-4">
            <PersonalWorkerMessageTab schedule={schedule} shifts={shifts} weekStart={weekStart} workers={workers} onCopy={(text) => copyText(text, "ההודעה לעובד הועתקה")} />
          </TabsContent>
          <TabsContent value="days" className="mt-4"><WeeklyScheduleReportDays schedule={schedule} shifts={shifts} weekStart={weekStart} /></TabsContent>
          <TabsContent value="whatsapp" className="mt-4"><Textarea readOnly value={generalText} rows={22} className="font-mono text-xs leading-5 bg-slate-50" /></TabsContent>
        </Tabs>
        <div className="flex justify-end pt-2"><Button type="button" variant="ghost" onClick={onClose}>סגור</Button></div>
      </DialogContent>
    </Dialog>
  );
}