import { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PILOT_ACCESS_PASSWORD = "CHANGE_ME_PILOT_PASSWORD";
const STORAGE_KEY = "pilot_access_granted";
const STORAGE_TS_KEY = "pilot_access_granted_at";
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function checkAccess() {
  const granted = localStorage.getItem(STORAGE_KEY);
  const ts = localStorage.getItem(STORAGE_TS_KEY);
  if (!granted || !ts) return false;
  if (Date.now() - Number(ts) > EXPIRY_MS) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TS_KEY);
    return false;
  }
  return true;
}

export function grantAccess() {
  localStorage.setItem(STORAGE_KEY, "true");
  localStorage.setItem(STORAGE_TS_KEY, String(Date.now()));
}

export function revokeAccess() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_TS_KEY);
}

export default function PilotAccessGate({ onGranted }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === PILOT_ACCESS_PASSWORD) {
      grantAccess();
      setError(false);
      onGranted();
    } else {
      setError(true);
      setPassword("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="bg-primary/10 rounded-full p-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-slate-800">כניסה למערכת</h1>
          <p className="text-sm text-slate-500">מערכת תפעול פנימית — צוות מורשה בלבד</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">סיסמת גישה</label>
            <Input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false); }}
              placeholder="הזן סיסמה"
              autoFocus
              className={error ? "border-red-400 focus-visible:ring-red-400" : ""}
            />
            {error && (
              <p className="text-sm text-red-500 font-medium">סיסמה שגויה</p>
            )}
          </div>

          <Button type="submit" className="w-full gap-2">
            <ShieldCheck className="w-4 h-4" />
            כניסה
          </Button>
        </form>
      </div>
    </div>
  );
}