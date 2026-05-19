# Group Status Flow Audit & Simplification

## 1. CURRENT STATUS FLOW AUDIT

### Where Groups Are Created

#### A. Manual Creation (✓ FIXED)
- **File**: `components/groups/GroupFormModal`
- **Flow**: Admin clicks "קבוצה חדשה" → fills form → clicks "צור קבוצה"
- **Before Fix**: `status = form.status || "DRAFT"` (user could select)
- **After Fix**: `status = "CONFIRMED"` (automatically set for new groups)
- **OperationalGroupProfile**: Auto-created with `status = "ACCEPTED"`
- **Result**: Operational tabs (schedule, meals, sleeping) work immediately

#### B. Quote-Created Groups (✓ VERIFIED)
- **File**: `components/quotes/QuoteStatusActions`
- **Flow**: Quote created in DRAFT → sent → admin clicks "אשר הצעה" (approve)
- **On Approval** (line 81): `Group.update(group.id, { status: "CONFIRMED" })`
- **OperationalHold**: Created to reserve capacity
- **Result**: Group becomes operational when quote is approved

#### C. Guest Form Submission (✓ VERIFIED)
- **File**: `pages/GuestForm`
- **Flow**: Group with approved quote → guest submits form → OperationalGroupProfile synced
- **Status**: Already working, no changes needed

---

## 2. STATUS MEANINGS (SIMPLIFIED)

| Status | Purpose | Appears In | Operational? |
|--------|---------|-----------|------------|
| **CONFIRMED** | Active operational group | Active groups, schedule, meals, sleeping, calendar, housekeeping | ✓ Yes |
| **COMPLETED** | Group finished stay/activity | History tab | ✗ No |
| **ARCHIVED** | Group frozen/standby | Frozen tab | ✗ No |
| **CANCELLED** | Cancelled group | Hidden from active | ✗ No |
| **DRAFT** | Quote/internal unfinished (NOT for manual groups) | Not shown operationally | ✗ No |

---

## 3. WHERE CHANGES WERE MADE

### A. GroupFormModal (CHANGED)
**File**: `components/groups/GroupFormModal`

**Changes**:
1. Line 25: Default status changed from `"DRAFT"` → `"CONFIRMED"`
2. Lines 139-149: Status dropdown now only shown in edit mode (`{isEdit && ...}`)
3. Edit mode status options updated to: CONFIRMED, COMPLETED, ARCHIVED, CANCELLED

**Before**:
```jsx
status: group?.status || "DRAFT",
// ... status selector always shown
<Select value={form.status} onValueChange={v => set("status", v)}>
  <SelectItem value="DRAFT">טיוטה</SelectItem>
  <SelectItem value="CONFIRMED">מאושר</SelectItem>
  <SelectItem value="CANCELLED">מבוטל</SelectItem>
</Select>
```

**After**:
```jsx
status: group?.status || "CONFIRMED",
// ... status selector only in edit mode
{isEdit && (
  <Select value={form.status} onValueChange={v => set("status", v)}>
    <SelectItem value="CONFIRMED">מאושר</SelectItem>
    <SelectItem value="COMPLETED">הסתיים</SelectItem>
    <SelectItem value="ARCHIVED">מוקפא</SelectItem>
    <SelectItem value="CANCELLED">מבוטל</SelectItem>
  </Select>
)}
```

---

### B. ApprovedGroups (CHANGED)
**File**: `pages/ApprovedGroups.jsx`

**Changes**:
1. Lines 77-98: Added filter to only show CONFIRMED groups
2. Excludes CANCELLED, COMPLETED, ARCHIVED from operational display

**Before**:
```jsx
const sorted = [...profiles].sort(...);
const upcoming = sorted.filter(p => !g?.departure_date || g.departure_date >= today);
const past = sorted.filter(p => g?.departure_date && g.departure_date < today);
```

**After**:
```jsx
const sorted = [...profiles].sort(...);
// Filter: only CONFIRMED groups (exclude CANCELLED, COMPLETED, ARCHIVED)
const activeProfiles = sorted.filter(p => {
  const g = groupById[p.group_id];
  if (!g) return false;
  const isOperational = g.status === "CONFIRMED";
  return isOperational;
});
const upcoming = activeProfiles.filter(p => ...);
const past = activeProfiles.filter(p => ...);
```

---

### C. QuoteStatusActions (VERIFIED - NO CHANGE NEEDED)
**File**: `components/quotes/QuoteStatusActions`
- **Status**: Already correctly updates group to CONFIRMED on approval (line 81)
- **No changes needed**

---

## 4. FILES THAT ALREADY HANDLE STATUS CORRECTLY

### Groups.jsx
- ✓ Correctly filters by status (CONFIRMED in active, COMPLETED in history, ARCHIVED in frozen)
- ✓ No changes needed

### Dashboard.jsx, Calendar.jsx, Housekeeping.jsx
- ✓ Filter for active/upcoming groups (implicitly exclude CANCELLED/COMPLETED/ARCHIVED via date logic)
- ✓ No changes needed

### GroupDetail.jsx
- ✓ Displays all tabs for any group with operational profile
- ✓ No changes needed

---

## 5. TEST CHECKLIST

### A. Manual Group Creation Flow
- [ ] 1. Admin clicks "קבוצה חדשה"
- [ ] 2. Fills group details (name, dates, pax, etc.)
- [ ] 3. Clicks "צור קבוצה"
- [ ] 4. ✓ Confirm group.status = "CONFIRMED" (not DRAFT)
- [ ] 5. ✓ Confirm OperationalGroupProfile exists with status = "ACCEPTED"
- [ ] 6. ✓ Group appears in "קבוצות פעילות" tab
- [ ] 7. ✓ Schedule tab works
- [ ] 8. ✓ Meals tab works
- [ ] 9. ✓ Sleeping requirements tab works
- [ ] 10. ✓ Allocation works

### B. Quote-Created Group Flow
- [ ] 1. Admin creates quote for prospect
- [ ] 2. Quote starts as DRAFT
- [ ] 3. Admin sends quote → SENT status
- [ ] 4. Before approval: group is DRAFT, not in operational tabs
- [ ] 5. Admin approves quote
- [ ] 6. ✓ Confirm group.status becomes "CONFIRMED"
- [ ] 7. ✓ Confirm OperationalGroupProfile exists
- [ ] 8. ✓ Confirm all operational tabs unlock
- [ ] 9. ✓ Group appears in calendar/housekeeping
- [ ] 10. ✓ Sleeping allocation works

### C. Status Lifecycle
- [ ] 1. Create CONFIRMED group
- [ ] 2. Group appears in "קבוצות פעילות"
- [ ] 3. Mark as "הסתיים" (COMPLETED)
- [ ] 4. ✓ Group moves to history tab
- [ ] 5. ✓ Group hidden from calendar/housekeeping active list
- [ ] 6. Mark as "מוקפא" (ARCHIVED)
- [ ] 7. ✓ Group appears in "קפואות" tab
- [ ] 8. ✓ Group hidden from operational lists
- [ ] 9. Mark as "מבוטל" (CANCELLED)
- [ ] 10. ✓ Group hidden from all active lists

### D. ApprovedGroups Page
- [ ] 1. Create CONFIRMED manual group
- [ ] 2. ✓ Appears in ApprovedGroups
- [ ] 3. Create quote, approve it
- [ ] 4. ✓ Group appears in ApprovedGroups (not before approval)
- [ ] 5. Mark group as COMPLETED
- [ ] 6. ✓ Group hidden from ApprovedGroups active list
- [ ] 7. Mark group as ARCHIVED
- [ ] 8. ✓ Group hidden from ApprovedGroups
- [ ] 9. Mark group as CANCELLED
- [ ] 10. ✓ Group hidden from ApprovedGroups

### E. Dashboard / Calendar / Housekeeping
- [ ] 1. Create CONFIRMED group with current/future dates
- [ ] 2. ✓ Appears in dashboard upcoming section
- [ ] 3. ✓ Appears in calendar
- [ ] 4. ✓ Appears in housekeeping
- [ ] 5. Mark as COMPLETED
- [ ] 6. ✓ Hidden from all active lists
- [ ] 7. Verify CANCELLED groups hidden
- [ ] 8. Verify ARCHIVED groups hidden

---

## 6. MIGRATION NOTES

No automatic migration needed. Existing:
- Manually created DRAFT groups will remain as DRAFT (they were never operational anyway)
- Quote-approved groups already set to CONFIRMED via QuoteStatusActions
- New manual groups will be CONFIRMED by default

---

## 7. HEBREW LABELS (COMPLETE)

```javascript
const STATUS_LABELS = {
  DRAFT:     { label: "טיוטה",   color: "bg-slate-100 text-slate-600" },
  CONFIRMED: { label: "מאושר",   color: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "הושלם",   color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "מבוטל",   color: "bg-red-100 text-red-600" },
  ARCHIVED:  { label: "מוקפא",   color: "bg-amber-100 text-amber-700" },
};
```

---

## 8. SUMMARY

✓ **Manual group creation**: Now defaults to CONFIRMED (no status selector on new)
✓ **Quote-created groups**: Auto-set to CONFIRMED on approval (already working)
✓ **ApprovedGroups page**: Now filters to only CONFIRMED groups
✓ **Status meaning**: Clear, simple, operational
✓ **Hebrew UI**: All labels preserved
✓ **Breaking changes**: None - backward compatible

**Result**: Simplified, intuitive status flow for operational groups.