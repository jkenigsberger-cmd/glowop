import { Copy, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import WeeklyScheduleReportPreview from "@/components/work-schedule/WeeklyScheduleReportPreview";
import { generateWeeklySchedulePrintHtml, generateWeeklyScheduleText } from "@/lib/weeklyScheduleReport";

export default function WeeklyScheduleReportModal({ open, onClose, schedule, shifts, weekStart }) {
  const { toast } = useToast();
  const whatsappText = generateWeeklyScheduleText(schedule, shifts, weekStart);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(whatsappText);
    toast({ description: "הטקסט הועתק — אפשר להדביק ב-WhatsApp או באימייל" });
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-base">דוח שבועי</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="preview" className="w-full">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <TabsList>
              <TabsTrigger value="preview">תצוגה</TabsTrigger>
              <TabsTrigger value="whatsapp">טקסט ל-WhatsApp</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="w-4 h-4" />
                העתק ל-WhatsApp
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4" />
                הדפס / הורד PDF
              </Button>
            </div>
          </div>

          <TabsContent value="preview" className="mt-4">
            <WeeklyScheduleReportPreview schedule={schedule} shifts={shifts} weekStart={weekStart} />
          </TabsContent>

          <TabsContent value="whatsapp" className="mt-4">
            <Textarea readOnly value={whatsappText} rows={18} className="font-mono text-xs leading-5 bg-slate-50" />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>סגור</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}