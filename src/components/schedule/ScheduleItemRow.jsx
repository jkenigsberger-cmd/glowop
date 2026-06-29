import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Check, X, MapPin, Copy, Users } from "lucide-react";
import { sortActivitySpaces, getActivitySpaceDisplayName } from "@/lib/activitySpaceUtils";
import RoleGate from "@/components/RoleGate";
import { ACTIVITY_CATALOG, catalogItemLabel } from "@/lib/activityCatalog.js";
import LogisticsFields, { LogisticsBadges, LOGISTICS_DEFAULTS, pickLogistics } from "./LogisticsFields";
import SharedActivityBadge from "./SharedActivityBadge";
import SharedGroupSelector from "./SharedGroupSelector";

const LOCATION_OPTIONS = ["כיתה", "מתחם חוץ", "מחוץ לחווה", "אחר"];

// Shared fields — changing any of these triggers unlink confirmation
const SHARED_KEY_FIELDS = ["activity_name", "date", "start_time", "end_time", "activity_space_id",
  "needs_projector", "needs_screen", "needs_microphone", "needs_sound", "needs_whiteboard",
  "needs_chair_circle", "chairs_count", "logistics_other"];

function sharedFieldsChanged(original, updated) {
  return SHARED_KEY_FIELDS.some(k => String(original[k] ?? "") !== String(updated[k] ?? ""));
}

// ── Edit scope dialog ─────────────────────────────────────────────────────────
function EditScopeDialog({ linkedGroupNames, currentGroupName, onScope, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-800">מה לעדכן?</h3>
        <p className="text-sm text-slate-500">
          זוהי פעילות משותפת עם: {linkedGroupNames.join(", ")}
        </p>
        <div className="space-y-2">
          <Button className="w-full justify-start" variant="outline" onClick={() => onScope("one")}>
            רק את הקבוצה הזו ({currentGroupName})
          </Button>
          <Button className="w-full justify-start" onClick={() => onScope("all")}>
            <Users className="w-4 h-4 ml-1" /> כל הקבוצות המשויכות
          </Button>
        </div>
        <Button variant="ghost" className="w-full text-slate-400" onClick={onClose}>ביטול</Button>
      </div>
    </div>
  );
}

// ── Unlink confirmation dialog ────────────────────────────────────────────────
function UnlinkConfirmDialog({ onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-800">ניתוק מפעילות משותפת</h3>
        <p className="text-sm text-slate-600">
          הפעילות תנותק מהפעילות המשותפת של שאר הקבוצות. להמשיך?
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>חזור</Button>
          <Button className="flex-1" onClick={onConfirm}>כן, נתק ועדכן</Button>
        </div>
      </div>
    </div>
  );
}

// ── Delete scope dialog ───────────────────────────────────────────────────────
function DeleteScopeDialog({ linkedGroupNames, currentGroupName, onScope, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 space-y-4">
        <h3 className="text-base font-semibold text-slate-800">מה למחוק?</h3>
        <p className="text-sm text-slate-500">
          זוהי פעילות משותפת עם: {linkedGroupNames.join(", ")}
        </p>
        <div className="space-y-2">
          <Button className="w-full justify-start" variant="outline" onClick={() => onScope("one")}>
            רק מהקבוצה הזו ({currentGroupName})
          </Button>
          <Button className="w-full justify-start bg-red-600 hover:bg-red-700" onClick={() => onScope("all")}>
            מכל הקבוצות המשויכות
          </Button>
        </div>
        <Button variant="ghost" className="w-full text-slate-400" onClick={onClose}>ביטול</Button>
      </div>
    </div>
  );
}

export default function ScheduleItemRow({
  item,
  activitySpaces,
  quoteActivities = [],
  groupDateRange = {},
  groupName = "",
  onSave,
  onCancel,
  onDuplicate,
  saving,
  sharedDetails = null,
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...LOGISTICS_DEFAULTS, ...item });
  const [error, setError] = useState(null);
  const [customName, setCustomName] = useState(false);

  // Convert-to-shared state (only for non-shared items in edit mode)
  const [convertSharedEnabled, setConvertSharedEnabled] = useState(false);
  const [convertExtraGroups, setConvertExtraGroups] = useState([]);

  // Shared activity dialogs
  const [editScopeDialog, setEditScopeDialog] = useState(false);
  const [unlinkDialog, setUnlinkDialog] = useState(false);
  const [deleteScopeDialog, setDeleteScopeDialog] = useState(false);
  const [pendingSaveForm, setPendingSaveForm] = useState(null);

  const { arrivalDate, departureDate } = groupDateRange;
  const isShared = !!(item.is_shared_activity || item.shared_activity_id);

  const getLinkedGroupNames = () => {
    try {
      const ids = item.shared_activity_group_ids ? JSON.parse(item.shared_activity_group_ids) : [];
      const names = item.shared_activity_group_names ? JSON.parse(item.shared_activity_group_names) : [];
      return names.filter((_, i) => ids[i] !== item.group_id);
    } catch { return []; }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const validateDate = (date) => {
    if (arrivalDate && departureDate && date) {
      if (date < arrivalDate || date > departureDate) {
        return "לא ניתן לקבוע פעילות מחוץ לתאריכי הקבוצה";
      }
    }
    return null;
  };

  // Called after scope is chosen
  const executeSave = async (formData, scope, unlinkFromShared) => {
    const err = await onSave({ ...formData, edit_scope: scope, unlink_from_shared: unlinkFromShared });
    if (err) { setError(err); return; }
    setEditing(false);
  };

  const handleSave = async () => {
    setError(null);
    const dateErr = validateDate(form.date);
    if (dateErr) { setError(dateErr); return; }
    if (!form.start_time || !form.end_time || form.start_time >= form.end_time) {
      setError("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
      return;
    }

    // Converting a normal activity to shared
    if (!isShared && convertSharedEnabled) {
      if (convertExtraGroups.length === 0) {
        setError("יש לבחור לפחות קבוצה אחת לשיוך");
        return;
      }
      const err = await onSave({ ...form, extra_group_ids: convertExtraGroups.map(g => g.id) });
      if (err) { setError(err); return; }
      setEditing(false);
      setConvertSharedEnabled(false);
      setConvertExtraGroups([]);
      return;
    }

    // If this is a shared activity, we need to ask scope
    if (isShared) {
      setPendingSaveForm(form);
      setEditScopeDialog(true);
      return;
    }

    // Not shared — save normally
    const err = await onSave(form);
    if (err) { setError(err); return; }
    setEditing(false);
  };

  // After user picks edit scope
  const handleScopeChosen = async (scope) => {
    setEditScopeDialog(false);
    const formData = pendingSaveForm;
    setPendingSaveForm(null);

    if (scope === "one" && sharedFieldsChanged(item, formData)) {
      // Need to confirm unlink
      setUnlinkDialog(true);
      return;
    }

    await executeSave(formData, scope, false);
  };

  const handleUnlinkConfirmed = async () => {
    setUnlinkDialog(false);
    await executeSave(pendingSaveForm || form, "one", true);
    setPendingSaveForm(null);
  };

  const handleCancel = () => {
    setForm({ ...item });
    setEditing(false);
    setError(null);
    setCustomName(false);
    setConvertSharedEnabled(false);
    setConvertExtraGroups([]);
  };

  const handleStartEdit = () => {
    setCustomName(!quoteActivities.length || !quoteActivities.includes(item.activity_name));
    setForm({ ...LOGISTICS_DEFAULTS, ...item });
    setEditing(true);
  };

  // Delete handler — asks scope if shared
  const handleDeleteClick = () => {
    if (isShared && getLinkedGroupNames().length > 0) {
      setDeleteScopeDialog(true);
    } else {
      onCancel(item.id, "one");
    }
  };

  const handleDeleteScope = (scope) => {
    setDeleteScopeDialog(false);
    onCancel(item.id, scope);
  };

  if (editing) {
    return (
      <>
        <div className="bg-slate-50 border border-primary/30 rounded-xl p-4 space-y-3">
          {isShared && (
            <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 text-xs text-violet-700 space-y-0.5">
              <p className="font-semibold">🔗 פעילות משותפת</p>
              <p>קבוצות משויכות: {[groupName, ...getLinkedGroupNames()].filter(Boolean).join(", ")}</p>
              <p className="text-violet-500">שמירה תשאל האם לעדכן רק קבוצה זו או את כולן</p>
            </div>
          )}

          {arrivalDate && departureDate && (
            <p className="text-xs text-slate-400">תאריכים מותרים: {arrivalDate} עד {departureDate}</p>
          )}

          {/* Catalog prefill dropdown */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500">בחר סדנה / הרצאה</label>
            <Select
              value="none"
              onValueChange={v => {
                if (v === "none") return;
                const cat = ACTIVITY_CATALOG.find((_, i) => String(i) === v);
                if (!cat) return;
                set("activity_name", cat.name);
                if (cat.lecturer) set("notes", cat.lecturer + (form.notes ? " | " + form.notes : ""));
              }}
            >
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="בחרו מתוך המאגר או הזינו פעילות ידנית" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— בחרו מתוך המאגר או הזינו פעילות ידנית —</SelectItem>
                {ACTIVITY_CATALOG.map((cat, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {catalogItemLabel(cat)}{cat.audience ? ` (${cat.audience})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">תאריך</label>
              <Input type="date" value={form.date} min={arrivalDate || undefined} max={departureDate || undefined}
                onChange={e => set("date", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">שם / סוג פעילות</label>
              {quoteActivities.length > 0 && !customName ? (
                <div className="flex gap-1">
                  <Select value={form.activity_name} onValueChange={v => {
                    if (v === "__custom__") { setCustomName(true); set("activity_name", ""); }
                    else set("activity_name", v);
                  }}>
                    <SelectTrigger><SelectValue placeholder="בחר פעילות..." /></SelectTrigger>
                    <SelectContent>
                      {quoteActivities.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      <SelectItem value="__custom__">✏️ אחר (הקלד ידנית)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex gap-1">
                  <Input value={form.activity_name} onChange={e => set("activity_name", e.target.value)}
                    placeholder="שם הפעילות" autoFocus={customName} />
                  {quoteActivities.length > 0 && (
                    <Button size="sm" variant="ghost" type="button" onClick={() => setCustomName(false)} className="text-xs px-2">↩</Button>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">שעת התחלה</label>
              <Input type="time" value={form.start_time} onChange={e => set("start_time", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">שעת סיום</label>
              <Input type="time" value={form.end_time} onChange={e => set("end_time", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">מרחב פעילות פנימי (אופציונלי)</label>
              <Select value={form.activity_space_id || "none"}
                onValueChange={v => set("activity_space_id", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="לא הוקצה" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— לא הוקצה —</SelectItem>
                  {sortActivitySpaces(activitySpaces).map(s => (
                    <SelectItem key={s.id} value={s.id}>{getActivitySpaceDisplayName(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">משתתפים</label>
              <Input type="number" min="0" value={form.pax || ""} onChange={e => set("pax", e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">הערות</label>
              <Input value={form.notes || ""} onChange={e => set("notes", e.target.value)} placeholder="הערות..." />
            </div>
          </div>

          <div className="border border-blue-100 rounded-lg p-3 bg-blue-50/30">
            <LogisticsFields value={form} onChange={patch => setForm(f => ({ ...f, ...patch }))} />
          </div>

          {/* Convert to shared — only for non-shared items */}
          {!isShared && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                <input
                  type="checkbox"
                  checked={convertSharedEnabled}
                  onChange={e => { setConvertSharedEnabled(e.target.checked); if (!e.target.checked) setConvertExtraGroups([]); }}
                  className="w-4 h-4 accent-violet-600"
                />
                <span className="flex items-center gap-1 text-xs text-violet-700 font-medium">
                  <Users className="w-3 h-3" /> לשייך לעוד קבוצות?
                </span>
              </label>
              {convertSharedEnabled && (
                <div className="border border-violet-200 rounded-lg p-3 bg-violet-50/40">
                  <SharedGroupSelector
                    currentGroupId={item.group_id}
                    selectedGroups={convertExtraGroups}
                    onChange={setConvertExtraGroups}
                  />
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={handleCancel} className="gap-1">
              <X className="w-3.5 h-3.5" /> ביטול
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
              <Check className="w-3.5 h-3.5" /> {saving ? "שומר..." : "שמור"}
            </Button>
          </div>
        </div>

        {editScopeDialog && (
          <EditScopeDialog
            linkedGroupNames={getLinkedGroupNames()}
            currentGroupName={groupName}
            onScope={handleScopeChosen}
            onClose={() => { setEditScopeDialog(false); setPendingSaveForm(null); }}
          />
        )}

        {unlinkDialog && (
          <UnlinkConfirmDialog
            onConfirm={handleUnlinkConfirmed}
            onClose={() => { setUnlinkDialog(false); setPendingSaveForm(null); }}
          />
        )}
      </>
    );
  }

  const space = activitySpaces.find(s => s.id === item.activity_space_id);
  const isSplit = !!item.split_group_id;

  // ── Action buttons (shared between normal and shared view) ────────────────
  const actionButtons = item.status !== "CANCELLED" ? (
    <RoleGate permission="MANAGE_ACTIVITIES">
      <div className="flex gap-1 shrink-0">
        <Button size="sm" variant="ghost" onClick={handleStartEdit} className="h-7 w-7 p-0" title="עריכה">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        {onDuplicate && (
          <Button size="sm" variant="ghost" onClick={() => onDuplicate(item)}
            className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700" title="שכפל פעילות">
            <Copy className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={handleDeleteClick}
          className="h-7 w-7 p-0 text-red-400 hover:text-red-600" title="בטל">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </RoleGate>
  ) : null;

  // ── Rich shared activity view ─────────────────────────────────────────────
  if (isShared && sharedDetails) {
    const { groups, totalPax, missingPax } = sharedDetails;
    const thisGroupPax = item.pax != null ? Number(item.pax) : null;
    const otherGroups = groups.filter(g => g.group_id !== item.group_id);

    return (
      <>
        <div className={`border-2 border-violet-300 bg-violet-50 rounded-xl overflow-hidden ${item.status === "CANCELLED" ? "opacity-50" : ""}`}>
          {/* Header band */}
          <div className="bg-violet-600 text-white px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              <span className="text-xs font-bold tracking-wide">פעילות משותפת</span>
              {item.status === "CANCELLED" && (
                <span className="text-xs bg-red-400 text-white rounded px-1.5 py-0.5">בוטל</span>
              )}
            </div>
            {actionButtons}
          </div>

          {/* Body */}
          <div className="px-4 py-3 space-y-3">
            {/* Activity name + time + location */}
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">{item.activity_name}</p>
              <p className="text-xs text-slate-500">
                {item.date} · {item.start_time}–{item.end_time}
              </p>
              {space && (
                <span className="inline-flex items-center gap-1 text-xs text-violet-700 font-medium">
                  <MapPin className="w-3 h-3" /> {space.name}
                </span>
              )}
              {item.requested_location && !space && (
                <span className="text-xs text-slate-400">📍 {item.requested_location}</span>
              )}
            </div>

            {/* Pax breakdown */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white rounded-lg px-3 py-2 border border-violet-200">
                <p className="text-[10px] text-violet-500 font-medium mb-0.5">קבוצה זו</p>
                <p className="text-sm font-bold text-slate-800">
                  {thisGroupPax != null ? `${thisGroupPax} משתתפים` : <span className="text-amber-600 text-xs">לא הוגדר</span>}
                </p>
              </div>
              <div className="bg-violet-600 rounded-lg px-3 py-2">
                <p className="text-[10px] text-violet-200 font-medium mb-0.5">סה״כ בפעילות</p>
                <p className="text-sm font-bold text-white">
                  {totalPax != null ? `${totalPax} משתתפים` : <span className="text-violet-200 text-xs">חסר נתון</span>}
                </p>
              </div>
            </div>

            {/* Missing pax warning */}
            {missingPax && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                ⚠️ חסר מספר משתתפים לאחת הקבוצות
              </p>
            )}

            {/* Linked groups */}
            {otherGroups.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 font-medium mb-1">משותף עם:</p>
                <ul className="space-y-1">
                  {otherGroups.map(g => (
                    <li key={g.group_id} className="flex items-center justify-between text-xs bg-white border border-violet-100 rounded-lg px-3 py-1.5">
                      <span className="font-medium text-slate-700">{g.group_name}</span>
                      <span className="text-slate-500">
                        {g.pax != null ? `${g.pax} משתתפים` : <span className="text-amber-600">לא הוגדר</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Logistics & notes */}
            <LogisticsBadges item={item} />
            {item.notes && <p className="text-xs text-slate-400 italic">{item.notes}</p>}
          </div>
        </div>

        {deleteScopeDialog && (
          <DeleteScopeDialog
            linkedGroupNames={getLinkedGroupNames()}
            currentGroupName={groupName}
            onScope={handleDeleteScope}
            onClose={() => setDeleteScopeDialog(false)}
          />
        )}
      </>
    );
  }

  // ── Normal activity view ──────────────────────────────────────────────────
  return (
    <>
      <div className={`bg-card border rounded-xl px-4 py-3 flex items-start gap-3 ${item.status === "CANCELLED" ? "opacity-50" : "border-border"}`}>
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{item.activity_name}</span>
            {item.source === "manual" && (
              <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5">ידני</span>
            )}
            {isSplit && (
              <span className="text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded px-1.5 py-0.5">
                {item.split_index}/{item.split_total} מרחבים
              </span>
            )}
            {isShared && (
              <span className="text-xs bg-violet-100 text-violet-700 border border-violet-200 rounded px-1.5 py-0.5">משותפת</span>
            )}
            {item.status === "CANCELLED" && (
              <span className="text-xs bg-red-50 text-red-600 border border-red-200 rounded px-1.5 py-0.5">בוטל</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {item.date} · {item.start_time}–{item.end_time}
            {item.pax ? ` · ${item.pax} משתתפים` : ""}
          </p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {item.requested_location && <span>📍 {item.requested_location}</span>}
            {space && (
              <span className="flex items-center gap-1 text-primary font-medium">
                <MapPin className="w-3 h-3" /> {space.name}
              </span>
            )}
          </div>
          <LogisticsBadges item={item} />
          {item.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{item.notes}</p>}
          <SharedActivityBadge item={item} currentGroupId={item.group_id} />
        </div>
        {actionButtons}
      </div>

      {deleteScopeDialog && (
        <DeleteScopeDialog
          linkedGroupNames={getLinkedGroupNames()}
          currentGroupName={groupName}
          onScope={handleDeleteScope}
          onClose={() => setDeleteScopeDialog(false)}
        />
      )}
    </>
  );
}