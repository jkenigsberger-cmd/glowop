# QUOTE_PREPARATION_FLOW — Security audit

Date: 2026-07-20

## Safety constraints

No test Quote was created. No existing entity record was updated or deleted. No write-mode backfill was run. No Google Calendar connector or endpoint was called.

## 1. Schema audit

The immediately preceding schema baseline was reconstructed from the pre-change schema snapshot, legacy forms, PDF/report consumers and backend field allowlists.

### Group legacy fields retained

`group_name`, `group_type`, `arrival_date`, `departure_date`, `arrival_time`, `departure_time`, `total_pax`, `staff_count`, `participant_count`, `boys_count`, `girls_count`, `contact_name`, `contact_phone`, `contact_email`, `internal_notes`, `status`, `completed_at`, `archived_at`, `archived_reason`.

Additive field only: `quote_preparation_flow` (`boolean`, default `false`).

Group enum retained: `LODGING | DAY_USE`. Group status enum retained: `DRAFT | PENDING_APPROVAL | CONFIRMED | CANCELLED | COMPLETED | ARCHIVED`. Required retained: `group_name`, `group_type`, `arrival_date`, `status`. Defaults retained: `group_type=LODGING`, `status=DRAFT`.

### Quote legacy fields retained

`quote_number`, `version`, `status`, `quote_type`, `client_name`, `contact_person`, `client_phone`, `client_email`, `client_tax_id`, `client_notes`, `arrival_date`, `departure_date`, `arrival_time`, `departure_time`, `nights`, `estimated_pax`, `staff_count`, `participant_count`, `includes_prisa`, `package_lines`, `new_addon_lines`, `student_lodging_lines`, `adult_lodging_lines`, `workshop_lines`, `lecture_lines`, `coffee_corner_pax`, `addon_lines`, `adjustment_lines`, `surcharge_lines`, `subtotal`, `discount_percent`, `discount_amount`, `total_price`, `advance_payment`, `balance_payment`, `payment_terms`, `valid_until`, `internal_notes`, `snapshot`.

Additive fields: `group_id`, `preparation_flow_enabled`, `group_name`, `approved_at`, `approved_by`, `rejected_at`, `rejected_by`, `rejection_reason`.

Quote status enum retained: `DRAFT | SENT | APPROVED | REJECTED | EXPIRED`. Quote type enum retained: `lodging | day_use | custom`. Required retained: `status`, `version`. Defaults retained: `status=DRAFT`, `version=1`, `quote_type=lodging`, `includes_prisa=false`, `discount_percent=0`. `preparation_flow_enabled=false` is additive.

No legacy field, enum member, required field or legacy default was removed or changed. `group_name` was added because client organization and operational group identity are distinct.

## 2. Backend feature flag

`base44/shared/quotePreparationConfig.js` is the authoritative backend switch. `assertQuotePreparationEnabled()` throws `FEATURE_DISABLED` before preparation creation, approval or rejection. The frontend flag remains a visibility/rollout control; backend enforcement is independent.

Functions covered: `ensureQuotePreparationGroup`, `approveQuoteAndActivateGroup` through the shared ensure, and `rejectQuotePreparation`. `backfillQuotePreparationFlow` remains permanently read-only in this release and rejects write mode.

## 3. OperationalGroupProfile.status decision

The schema permits only `ACCEPTED`. Existing legacy creation and approval functions use `ACCEPTED` for every OGP, including automatically ensured profiles. Consumers do not use OGP `status` alone to decide operational activation; operational eligibility is determined by the linked Group.

Decision: do not add a new OGP enum. A provisional profile remains `ACCEPTED` for schema compatibility, but is non-operational whenever `Group.quote_preparation_flow=true && Group.status!==CONFIRMED`. No `accepted_at` is written for an automatically prepared profile.

## 4. Isolation consumers

Audited and/or hardened:

- Groups and preparation category
- Dashboard, pax totals, warnings and occupancy
- Kitchen daily list and KitchenCalendar
- Kitchen report, coffee and prisa totals
- Housekeeping lodging/day-use/common-space views
- Calendar, CheckInOutCalendar, chronological day and day summary
- Allocation and confirmed/draft allocation lookups
- ApprovedGroups
- DailyOperationalPrint
- OperationalSummaryPrint
- generateDailyBriefData
- getAnalyticsData, including activity and meal totals
- checkSiteAvailability, Groups, OperationalHolds and day-use holds
- CommonSpaces and LogisticsReportTab
- GlobalSearch
- OperationalReviewAlert display
- GroupScheduleItem creation, shared activity conflict checks and calendar mirroring
- MealReservation prefill
- SleepingAllocation VIP/alternative save and confirmation
- CoffeeCornerRequest and Prisa display/report consumers
- CalendarSync creation paths
- manual/monthly cleaning reports (not Group-dependent; no change required)
- work-schedule monthly reports (not Group-dependent; no change required)

Backend write guards return `PREPARATION_GROUP_NOT_OPERATIONAL` before operational reservation writes. Calendar sync returns before acquiring a connector token for a provisional Group.

## 5. Approval comparison

| Effect | Legacy initialize + UI | New activate |
|---|---|---|
| Quote status | APPROVED | APPROVED + approved_at/by |
| Group | Creates if missing; otherwise does not overwrite | Reuses preparation Group and sets CONFIRMED |
| OGP | Ensures one; fills empty pax | Reuses/ensures exactly one |
| Snapshot | UI creates after function | Backend captures before approval |
| OperationalHold | Legacy UI may create | Not created |
| GroupScheduleItem | Not created by approval | Not created |
| MealReservation | Not created by approval | Not created |
| SleepingAllocation | Not created | Not created |
| CalendarSync / Google Calendar | Not directly by approval | Not touched |
| Prefill | Explicit later action | Explicit later action |
| Lifecycle side effects | None inside initializer | None beyond CONFIRMED activation |

Strictly required activation is: one linked Group, one linked OGP, Group `CONFIRMED`, Quote `APPROVED`, approval audit fields and snapshot. Holds, prefill and Calendar are deliberately excluded. The response reports the four completed activation steps in `integrations_activated`.

## 6. Naming ownership

- `Quote.group_name`: operational group identity.
- `Quote.client_name`: client organization/legal/commercial name.
- `Quote.contact_person`: individual contact.
- `Group.group_name`: synchronized only from `Quote.group_name` for the preparation flow.
- `Group.contact_name`: synchronized only from `Quote.contact_person`.

Legacy approval falls back to `client_name` only when an old Quote has no additive `group_name`.

## 7. Partial failure strategy

- Repeated ensure with an existing `Quote.group_id` reuses the Group.
- Existing single OGP is reused; multiple profiles stop with a critical error.
- If Group creation succeeds but Quote linking fails, a compensating delete of that newly created Group is attempted and the response returns `QUOTE_LINK_FAILED_GROUP_COMPENSATED` with `RETRY_ENSURE`.
- If Quote linking succeeds but profile creation fails, the linked Group is intentionally retained; the response reports `QUOTE_LINKED_GROUP_EXISTS_PROFILE_MISSING`, IDs and `RETRY_ENSURE`. A retry creates only the missing profile.
- Post-create cardinality is rechecked and all partial failures are logged with Quote and Group IDs.

## 8. Validation

All modified backend functions deployed and accepted invalid-payload smoke tests without writes. The audit backfill returned `writes_performed: 0`. Frontend build/lint scripts exist, but this environment exposes no command runner; no claim is made that those commands were executed.