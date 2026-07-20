# Quote preparation flow

## Rollout

The centralized preparation flow is additive and controlled by `src/lib/quotePreparationFlow.js`.

- `QUOTE_PREPARATION_FLOW`: master UI switch.
- `QUOTE_PREPARATION_ROLLOUT`: currently `SUPER_ADMIN_ONLY`.
- Legacy quotes and groups are identified by the absence of `Quote.preparation_flow_enabled` and keep their existing behavior.

## Canonical relationship

`Quote.group_id` is the only canonical Quote → Group relationship. `Group.quote_preparation_flow` is an isolation marker, not a second relationship.

## New data

New controlled-flow records create:

1. one Quote with `preparation_flow_enabled=true`;
2. one Group with `quote_preparation_flow=true` and `status=DRAFT`;
3. one OperationalGroupProfile linked by `group_id` and `quote_id`.

## Field ownership

Quote-owned fields synchronized while open: group name, group type, arrival/departure dates and times, total/staff/participant counts, and contact name/phone/email.

Operational fields never overwritten by quote save: diets, allergies, sleeping requirements, allocations, schedule requests, meals, housekeeping notes, logistics notes, and general operational notes.

After approval, quote edits do not synchronize automatically; the existing explicit diff/sync action remains available.

## Isolation

A Group with `quote_preparation_flow=true` and a status other than `CONFIRMED` is excluded from operational dashboards, calendars, check-in/out, housekeeping, allocation, and daily summaries. Operational tabs that create meals, activities, coffee/prisa, or sleeping work are hidden in its group page.

## Approval and rejection

Both the Quotes center and Groups preparation tab call `approveQuoteAndActivateGroup`. Rejection calls `rejectQuotePreparation` and preserves Quote, Group, and OperationalGroupProfile.

## Rollback

Set `QUOTE_PREPARATION_FLOW=false`. This hides the new UI and returns new quote creation to the legacy path. It does not delete records, reverse approvals, or modify existing data. New records remain identifiable by `Quote.preparation_flow_enabled=true` and `Group.quote_preparation_flow=true`.

The legacy functions and UI remain installed and unchanged for legacy records.