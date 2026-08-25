import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import AssistantMessageBubble from "./AssistantMessageBubble";

const INACTIVE_MSG = "הקישור הזה כבר לא פעיל. אנא השתמשו בקישור החדש שקיבלתם.";

export default function GuestFormAssistant({ formLinkToken }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [initializing, setInitializing] = useState(false);
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const handleOpen = async () => {
    setOpen(true);
    if (ready || blocked || initializing) return;
    setInitializing(true);
    try {
      const res = await base44.functions.invoke("getGuestFormAssistantContext", {
        form_link_token: formLinkToken,
      });
      if (!res?.data?.valid) {
        setBlocked(res?.data?.public_message || INACTIVE_MSG);
        return;
      }
      setReady(true);
    } catch (_e) {
      setBlocked("העוזר אינו זמין כרגע. אפשר להמשיך למלא את הטופס כרגיל ולכתוב שאלות בשדה הערות.");
    } finally {
      setInitializing(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !ready || sending) return;
    setInput("");
    setMessages(current => [...current, { role: "user", content: text }]);
    setSending(true);
    try {
      const res = await base44.functions.invoke("askGuestFormAssistant", {
        form_link_token: formLinkToken,
        question: text,
      });
      if (!res?.data?.success) {
        if (res?.data?.public_message) setBlocked(res.data.public_message);
        else throw new Error("ASSISTANT_UNAVAILABLE");
        return;
      }
      setMessages(current => [...current, { role: "assistant", content: res.data.answer }]);
    } catch (_e) {
      setMessages(current => [...current, { role: "assistant", content: "העוזר אינו זמין כרגע. אפשר להמשיך למלא את הטופס כרגיל ולכתוב שאלות בשדה הערות." }]);
    } finally {
      setSending(false);
    }
  };

  if (!formLinkToken) return null;

  return (
    <>
      {/* Floating help button */}
      {!open && (
        <button
          onClick={handleOpen}
          className="fixed bottom-4 left-4 z-40 flex items-center gap-2 bg-primary text-white rounded-full px-4 py-2.5 shadow-lg hover:opacity-90 transition-opacity text-sm font-semibold"
          dir="rtl"
        >
          <MessageCircle className="w-4 h-4" />
          צריכים עזרה?
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-4 left-4 z-40 w-[92vw] max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
          style={{ height: "480px", maxHeight: "75vh" }}
          dir="rtl"
        >
          <div className="bg-primary text-white px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm">עזרה במילוי הטופס</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/20 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-500 bg-slate-50 px-4 py-2 border-b border-slate-100">
            העוזר כאן כדי לעזור במילוי הטופס. הפרטים הסופיים יאושרו על ידי צוות הדור הבא.
          </p>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {blocked ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2 text-sm text-center mt-4">
                {blocked}
              </div>
            ) : initializing ? (
              <div className="flex justify-center pt-8">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <>
                <div className="bg-slate-100 text-slate-800 rounded-2xl px-3 py-2 text-sm w-fit max-w-[85%] mr-auto">
                  שלום! אני כאן לעזור לכם למלא את השאלון — אלרגיות, פעילויות, ציוד, פריסה ועוד. במה אפשר לעזור?
                </div>
                {messages.map((m, i) => (
                  <AssistantMessageBubble key={i} message={m} />
                ))}
              </>
            )}
            <div ref={bottomRef} />
          </div>

          {!blocked && (
            <div className="border-t border-slate-200 p-2 flex gap-2">
              <input
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="כתבו שאלה..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                disabled={initializing || !ready || sending}
              />
              <Button size="icon" onClick={handleSend} disabled={!input.trim() || sending || !ready}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}