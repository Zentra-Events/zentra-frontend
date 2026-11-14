# ESTIMATE FLOW AUDIT REPORT

**Primary File:** `src/components/create-estimate-modal.tsx`
**Audit Scope:** Estimate creation and editing workflows (create, edit, additional estimates)
**Status:** Investigation complete — no code changes applied
**Backend Source:** Not available in repository; backend behavior inferred from types/endpoints only

---

## A. Executive Summary

The estimate creation/editing workflow is functional for the happy path (create a draft estimate from an enquiry, edit a draft, create an additional estimate) but contains several **critical correctness defects** that can produce wrong financial totals, corrupt estimate status on edit, allow invalid/negative rates, and permit submission of empty estimates.

- **Total issues identified:** 30 (10 Critical, 9 High, 7 Medium, 4 Low)
- **Most critical risks:**
  - `estimateStatus` hardcoded to `"DRAFT"` on every save, downgrading FINAL/EVENT_CREATED estimates on edit (data corruption).
  - Negative item rates are not rejected, producing negative line totals and negative estimates.
  - Empty estimates (zero items) can be created/updated; no item-level validation in the Yup schema.
  - Editing estimates with status `OPEN`/`CLOSED`/`CANCELLED` fails Yup validation (`.oneOf` excludes them), blocking legitimate edits.
  - No protection against editing FINAL/EVENT_CREATED/merged estimates.
  - No TDS or additional-cost fields are collected or submitted despite existing type support.
- **Production readiness:** Not reliable for production use in its current state. Critical fixes required before deployment.

---

## B. Critical Findings

| ID | Severity | Workflow | Problem |
|----|----------|----------|---------|
| C-1 | Critical | Edit | `estimateStatus` hardcoded to `"DRAFT"` on every payload (line 1028), overwriting FINAL/EVENT_CREATED/EVENT_MERGED on edit → status corruption. |
| C-2 | Critical | Both | Negative item `rate` is not rejected by submit validation (line 901 checks `=== 0` only), allowing negative line totals and negative estimates. |
| C-3 | Critical | Both | No validation that at least one item exists; empty estimate (`items: {}`) can be created/updated. |
| C-4 | Critical | Edit | Editing estimates with status `OPEN`/`CLOSED`/`CANCELLED` fails Yup `.oneOf(eventStatus)` validation (line 164) → legitimate edits blocked. |
| C-5 | Critical | Edit | No guard preventing edits to FINAL/EVENT_CREATED/merged estimates; finalized data can be overwritten. |
| C-6 | High | Both | No TDS field collected/submitted despite `EstimateDto.tds` and `CreateEstimatePayload.tds` support → field dropped silently. |
| C-7 | High | Both | `additionalCostAmt` hardcoded to `0` (line 999) and `additionalCostEstimate` never collected → additional costs always lost. |
| C-8 | High | Both | `selectedClientId` stores client **name** but is bound to the client `<Select>` whose option `value`s are client IDs (lines 812, 1261-1273) → select value binding inconsistent after selection. |
| C-9 | High | Edit | On successful save with an unparseable response body, a fake `tmp-${Date.now()}` estimate is treated as saved and passed to `onSaved`/`onClose` (lines 1070-1101) → non-persisted estimate presented as saved. |
| C-10| High | Edit | No version/optimistic-locking or conflict detection on edit; concurrent edits result in last-write-wins with no stale-data detection. |

---

## C. Detailed Bug Report

### C-1: `estimateStatus` hardcoded to `"DRAFT"` on every save (Edit)
- **Severity:** Critical
- **Workflow:** Edit
- **Location:** `src/components/create-estimate-modal.tsx:1028`
- **Problem:** The payload always sets `estimateStatus: "DRAFT"`, regardless of the existing estimate's `estimateStatus` (FINAL, EVENT_CREATED, EVENT_MERGED, UNDER_CLIENT_REVIEW).
- **Root Cause:** The status field in the form is `EstimateStatus` (enquiry lifecycle), but `estimateStatus` (versioning) is hardcoded to `"DRAFT"` instead of being read from `prefillData.estimateStatus` and preserved.
- **Reproduction:** Open an existing FINAL estimate for edit, change any field, save. The saved estimate's `estimateStatus` becomes `"DRAFT"`.
- **Actual Behavior:** Finalized estimates are downgraded to DRAFT on edit, corrupting versioning state and potentially allowing re-editing of finalized work.
- **Expected Behavior:** Preserve `prefillData.estimateStatus` on edit; only set `"DRAFT"` for new creates.
- **Recommended Fix:** `estimateStatus: isEditing ? (prefillData.estimateStatus ?? "DRAFT") : "DRAFT"`.
- **Regression Risk:** Estimate versions view, event merge flow, status-based UI badging.

### C-2: Negative item `rate` not rejected (Both)
- **Severity:** Critical
- **Workflow:** Both
- **Location:** `src/components/create-estimate-modal.tsx:899-905`
- **Problem:** `hasEmptyRate` checks `Number(line.rate) === 0` but does not reject `rate < 0`. A negative rate passes validation and produces a negative `finalAmt`.
- **Root Cause:** Submit validation only rejects zero/non-finite rate; the `InlineNumber` HTML `min="0"` attribute is not enforced in JavaScript (see `inline-number.tsx:93`), so a negative value can be entered.
- **Reproduction:** Add an item, set rate to `-100`, submit. Validation passes and a negative total is created.
- **Actual Behavior:** Negative line totals and negative estimate subtotals are created without error.
- **Expected Behavior:** Reject `rate < 0` (and `days < 1`, `sqft < 1` already rejected) with a clear validation error.
- **Recommended Fix:** Change `hasEmptyRate` to `!Number.isFinite(line.rate) || Number(line.rate) <= 0`.
- **Regression Risk:** Cost summary, invoiceSummary, PDF/Excel preview totals.

### C-3: Empty estimate submission allowed (Both)
- **Severity:** Critical
- **Workflow:** Both
- **Location:** `src/components/create-estimate-modal.tsx:155-172` (schema), `:898-918` (submit)
- **Problem:** The Yup schema has no item/lines validation, and the submit handler only validates *persistable* lines that exist. With zero lines, `persistableLines` is empty, `invalidItems` is empty, and submission proceeds with `items: {}`.
- **Root Cause:** Items are managed in separate `lines` state outside Formik; the schema never references them. No "at least one item" rule.
- **Reproduction:** Open modal, do not add any items, click Save. Estimate is created with no items.
- **Actual Behavior:** An estimate with zero items is created/updated successfully.
- **Expected Behavior:** Require at least one valid item before saving.
- **Recommended Fix:** Add a Yup `lines`/`items` array validation with `min(1)`, or check `lines.length === 0` in `handleSubmit` before building the payload.
- **Regression Risk:** Empty estimates pollute the estimates list and downstream net-total/reporting.

### C-4: Status validation blocks OPEN/CLOSED/CANCELLED (Edit)
- **Severity:** Critical
- **Workflow:** Edit
- **Location:** `src/components/create-estimate-modal.tsx:164` and `:712`
- **Problem:** `validationSchema.status` uses `.oneOf(eventStatus.map(s => s.value))`. `eventStatus` (src/constants/event.ts:27) excludes `OPEN`, `CLOSED`, `CANCELLED`, which are valid `EstimateStatus` values (src/types/estimate.ts:11-13).
- **Root Cause:** The schema's allowed list is derived from `eventStatus` (9 values) rather than the full `EstimateStatus` union (12 values).
- **Reproduction:** Edit an estimate whose backend status is `OPEN`, `CLOSED`, or `CANCELLED`. Formik sets `initialForm.status` to that value (line 712) but Yup rejects it → form invalid → cannot save.
- **Actual Behavior:** Legitimate edits to OPEN/CLOSED/CANCELLED estimates are blocked by a validation error.
- **Expected Behavior:** Allow all `EstimateStatus` values in the schema.
- **Recommended Fix:** `.oneOf(Object.values(EstimateStatus) as EstimateStatus[])` or import the full type union.
- **Regression Risk:** Any estimate with one of the three missing statuses cannot be edited.

### C-5: No guard against editing finalized estimates (Edit)
- **Severity:** Critical
- **Workflow:** Edit
- **Location:** `src/components/create-estimate-modal.tsx:860-1109` (handleSubmit), `:1204-1213` (title)
- **Problem:** The modal allows editing any estimate passed via `initialData`, including `estimateStatus === "FINAL"` or `"EVENT_CREATED"`. There is no check on `prefillData.estimateStatus` or `estimateStatus` versioning field.
- **Root Cause:** No business-rule gate on edit eligibility. `isEditing` (line 871) only checks `prefillData.id`, not whether the estimate is finalized.
- **Reproduction:** Open a FINAL estimate for edit, modify fields, save. The finalized estimate is overwritten.
- **Actual Behavior:** Finalized estimates can be edited and their data overwritten.
- **Expected Behavior:** Block or warn when editing FINAL/EVENT_CREATED/EVENT_MERGED estimates (read-only or disallowed).
- **Recommended Fix:** Add a guard in `handleSubmit` (and disable the form) when `prefillData.estimateStatus` is a terminal status.
- **Regression Risk:** Estimate versions view, event merge, financial reporting on finalized data.

### C-6: TDS field never collected or submitted (Both)
- **Severity:** High
- **Workflow:** Both
- **Location:** `src/components/create-estimate-modal.tsx:155-172`, `:1005-1032`
- **Problem:** `EstimateDto.tds` and `CreateEstimatePayload.tds` exist but there is no TDS input in the form, no TDS in `initialForm`, and `tds` is omitted from the payload.
- **Root Cause:** The billing section only collects GST, service charge, and discount. TDS was omitted from the UI.
- **Reproduction:** Create/edit an estimate; TDS is never captured. The backend receives `tds: undefined`.
- **Actual Behavior:** TDS data is silently dropped on every save.
- **Expected Behavior:** Either collect TDS in the form and include it in the payload, or confirm it is intentionally unused.
- **Recommended Fix:** Add a TDS field to the form and `initialForm`, include `tds` in the payload, and add TDS to the cost summary/calculation if required by business rules (confirm with product).
- **Regression Risk:** Invoice/financial accuracy if backend expects TDS.

### C-7: `additionalCostAmt` hardcoded to `0`; additional costs never collected (Both)
- **Severity:** High
- **Workflow:** Both
- **Location:** `src/components/create-estimate-modal.tsx:999`, `:1005-1032`
- **Problem:** `invoiceSummary.additionalCostAmt` is hardcoded to `0` (line 999), and `EstimateDto.additionalCostEstimate` is never collected in the form or included in the payload.
- **Root Cause:** No additional-cost UI exists in the estimate modal, despite type support in `EstimateDto` and `Event`.
- **Reproduction:** Any estimate save; additional costs are always `0` in the invoice summary.
- **Actual Behavior:** Additional costs are permanently lost/zero.
- **Expected Behavior:** Collect additional costs and include them in `invoiceSummary` and the payload (confirm business rules with product).
- **Recommended Fix:** Add additional-cost fields to the form and map them into `invoiceSummary.additionalCostAmt` and `payload` (confirm field mapping with backend).
- **Regression Risk:** Financial totals, net total, client billing.

### C-8: `selectedClientId` stores name but bound to ID-valued Select (Both)
- **Severity:** High
- **Workflow:** Both
- **Location:** `src/components/create-estimate-modal.tsx:806-819`, `:1254-1294`, `:1261-1273`
- **Problem:** `handleClientChange` sets `selectedClientId` to the client **name** (`clientName`), but the client `<Select>` binds `value.value = selectedClientId` while option `value`s are `summary.clientId`. The name will never match an option ID, so the select's value binding is inconsistent after selection.
- **Root Cause:** Variable is misnamed (`selectedClientId` holds a name) and used inconsistently between state lookup (`titlesForSelectedClient` matches by name — works) and Select value binding (expects ID — broken).
- **Reproduction:** Select a client; re-open the client dropdown; the previously selected client does not appear selected by value.
- **Actual Behavior:** Client select display/value is out of sync with internal state.
- **Expected Behavior:** `selectedClientId` should hold the client ID consistently, or the Select value should use the name.
- **Recommended Fix:** Store the client ID in `selectedClientId` and derive the display name separately; align the Select `value.value` with option values.
- **Regression Risk:** Enquiry prefill by client, `fallbackClientId` lookup (which matches by `prefillData.client` name — works), UI consistency.

### C-9: Unparseable success response treated as saved with fake id (Edit)
- **Severity:** High
- **Workflow:** Edit (and Create)
- **Location:** `src/components/create-estimate-modal.tsx:1060-1101`
- **Problem:** When `res.ok` but `JSON.parse(data)` fails, `saved` stays `null` and a fallback `EstimateDto` with `id: \`tmp-${Date.now()}\`` is built and passed to `onSaved`/`onClose` with a success toast (lines 1097-1101).
- **Root Cause:** No distinction between "server confirmed success" and "response body unparseable"; a synthetic local estimate is presented as the saved record.
- **Reproduction:** Server returns HTTP 200 with a non-JSON/empty body. Frontend shows "Estimate created successfully" with a `tmp-...` id.
- **Actual Behavior:** A non-persisted estimate is treated as saved; parent may display a `tmp-...` id until refetch.
- **Expected Behavior:** Treat unparseable 200 responses as a failure or require the backend to always return JSON; do not fabricate ids.
- **Recommended Fix:** If `res.ok` but parse fails, throw/handle as error rather than fabricating a fallback; or at minimum do not present the tmp id as a saved record.
- **Regression Risk:** Parent list/versions view may briefly show a phantom estimate.

### C-10: No optimistic locking / conflict detection on edit (Edit)
- **Severity:** High
- **Workflow:** Edit
- **Location:** `src/components/create-estimate-modal.tsx:1037-1041`, `:1054-1058`
- **Problem:** Edit sends `{ ...payload, id, version }` via POST to `/api/estimates` with no `If-Match`/ETag/version conflict handling. The backend receives `version` but there is no client-side stale-data detection.
- **Root Cause:** No concurrency control; last write wins silently.
- **Reproduction:** Two users open the same estimate for edit; both save; the second save silently overwrites the first.
- **Actual Behavior:** Concurrent modifications are lost without warning.
- **Expected Behavior:** Detect stale version (e.g., 409 Conflict) and prompt the user to reload.
- **Recommended Fix:** Add response handling for 409/412 conflicts, reload the estimate, and warn the user.
- **Regression Risk:** Data loss in multi-user editing scenarios.

---

### C-11: `gst` value submitted even when `gstType === "NONE"` (Both)
- **Severity:** Medium
- **Workflow:** Both
- **Location:** `src/components/create-estimate-modal.tsx:719, 720, 1023, 1024, 1477-1482`
- **Problem:** `gstType` onChange resets `gst` to `0` (line 1481), but if prefill has `gstType="NONE"` with `gst > 0`, the form keeps `gst > 0`, the input is disabled but still displays/submits the non-zero value, and the payload sends `gst > 0` with `gstType: "NONE"`.
- **Root Cause:** Only the `onChange` handler resets the value; initial/mounted state is not reconciled.
- **Reproduction:** Prefill an estimate with `gstType="NONE"`, `gst=10`. Submit. Payload sends `gst=10`, `gstType="NONE"`.
- **Actual Behavior:** Contradictory GST/tax-type combination submitted.
- **Expected Behavior:** When `gstType === "NONE"`, force `gst = 0` in the payload (and initial form).
- **Recommended Fix:** In `handleSubmit`, if `values.gstType === "NONE"` set `gst: 0`; also reconcile in `initialForm`.
- **Regression Risk:** GST amount calculations, invoice summary correctness.

### C-12: `formatDateOutput` strips timezone; date format may mismatch backend (Both)
- **Severity:** Medium
- **Workflow:** Both
- **Location:** `src/components/create-estimate-modal.tsx:181-184`, `:1008-1010`
- **Problem:** `formatDateOutput` calls `date.toISOString().replace(/Z$/u, "")`, producing a timezone-naive local string (e.g. `2025-06-25T09:00:00.000`). The backend may expect ISO with `Z` or a specific format.
- **Root Cause:** Frontend date serialization not coordinated with backend contract.
- **Reproduction:** Save an estimate with dates; inspect the request payload — dates lack timezone.
- **Actual Behavior:** Dates sent without timezone; backend may misinterpret or reject.
- **Expected Behavior:** Send dates in the backend-expected format (confirm).
- **Recommended Fix:** Confirm backend date format and serialize accordingly (preferably ISO-8601 with UTC or explicit offset).
- **Regression Risk:** Enquiry date, event start/end dates stored incorrectly.

### C-13: `serialNumber` restarts at 1 per category (Both)
- **Severity:** Medium
- **Workflow:** Both
- **Location:** `src/components/create-estimate-modal.tsx:920-925`
- **Problem:** `serialCounters` is a `Map<string, number>` keyed by category, so serial numbers restart at 1 for each category instead of being globally sequential.
- **Root Cause:** Serial numbering scoped per category.
- **Reproduction:** Add items in two categories; both start at serial 1.
- **Actual Behavior:** Duplicate serial numbers across categories.
- **Expected Behavior:** Confirm whether backend expects global or per-category serials.
- **Recommended Fix:** Confirm with backend; use a global counter if required.
- **Regression Risk:** Item ordering/serial display in PDF/Excel.

### C-14: `checkList` hardcoded to `""` (Both)
- **Severity:** Low
- **Workflow:** Both
- **Location:** `src/components/create-estimate-modal.tsx:943`
- **Problem:** `checkList: ""` is hardcoded on every line item.
- **Root Cause:** Placeholder value not tied to any data.
- **Recommended Fix:** Confirm with backend whether `checkList` should be sent; omit if unused.

### C-15: Edit payload uses POST to `/api/estimates` (create endpoint) with `id`/`version` (Edit)
- **Severity:** Medium
- **Workflow:** Edit
- **Location:** `src/components/create-estimate-modal.tsx:1037-1058`
- **Problem:** Edit reuses the create endpoint (`POST /api/estimates`) and attaches `id`/`version` to the body, relying on the backend to interpret POST-with-id as an update.
- **Root Cause:** No dedicated update endpoint/method; create-or-update ambiguity.
- **Recommended Fix:** Confirm backend contract. If backend expects `PUT/PATCH /api/estimates/:id` for updates, switch the edit path accordingly.
- **Regression Risk:** Edit may create duplicate records if backend treats POST as create-only.

### C-16: Closing main modal abandons pending additional estimate (Edit/Additional)
- **Severity:** Medium
- **Workflow:** Additional Estimate
- **Location:** `src/components/create-estimate-modal.tsx:1587-1591`, `:1111-1173`
- **Problem:** After `handleSubmit` opens the additional-estimate confirmation (sets `pendingAdditionalEstimate`, `isSaving=false`), the user can click the main modal "Cancel" (line 1588), which calls `onClose()` and unmounts everything **without** clearing/submitting `pendingAdditionalEstimate`. The additional estimate in progress is silently abandoned.
- **Root Cause:** `pendingAdditionalEstimate` is not tied to the main modal's close; Cancel bypasses the confirmation modal's own `onClose` cleanup.
- **Reproduction:** Create additional estimate, open confirmation, click main Cancel instead of "Back to Estimate". The pending additional estimate is lost.
- **Actual Behavior:** User's additional-estimate work is discarded without warning.
- **Expected Behavior:** Warn/confirm before discarding a pending additional estimate, or route main-modal cancel through the confirmation cleanup.
- **Recommended Fix:** Block main-modal close when `pendingAdditionalEstimate` is set, or clear it deliberately with confirmation.
- **Regression Risk:** Data loss for additional estimates.

### C-17: `lines` reset when modal reopens with same `prefillData` (Both)
- **Severity:** Medium
- **Workflow:** Both
- **Location:** `src/components/create-estimate-modal.tsx:594-658`
- **Problem:** The `useEffect` (deps `[isOpen, prefillData, isAdditionalEstimate]`) calls `setLines(fromItems)` whenever `isOpen` toggles false→true with the same `prefillData`, overwriting any in-flight item edits.
- **Root Cause:** Lines are re-derived from `prefillData.items` on every open rather than preserving session edits.
- **Reproduction:** Open estimate, edit items, close without saving, reopen → item edits are gone.
- **Actual Behavior:** Unsaved item edits are lost on close/reopen.
- **Expected Behavior:** If draft preservation is intended, persist to IndexedDB/localStorage; otherwise document close=discard. (No draft recovery exists in the codebase at all.)
- **Recommended Fix:** Add draft persistence (IndexedDB) or explicitly discard-on-close; do not silently overwrite on reopen if the user expects draft retention.
- **Regression Risk:** Data loss; noted that no IndexedDB/draft-recovery mechanism exists anywhere in the codebase.

### C-18: No cleanup/abort for in-flight save on unmount (Both)
- **Severity:** Low
- **Workflow:** Both
- **Location:** `src/components/create-estimate-modal.tsx:1054-1108`
- **Problem:** `handleSubmit` initiates `apiRequest(...)` with no `AbortController` or cancellation token. If the component unmounts during save (parent closes modal/navigates), `setIsSaving(false)`, `onSaved()`, and `onClose()` still execute on an unmounted component.
- **Root Cause:** No request cancellation tracking for the save call (unlike enquiry loading which uses `requestRef`).
- **Recommended Fix:** Track save request with a ref/abort controller and guard state updates after unmount.
- **Regression Risk:** React setState-on-unmounted warnings; rare race on navigation during save.

---

### C-19: `additionalEstimate: isAdditionalEstimate || undefined` sends `undefined` for false (Both)
- **Severity:** Low
- **Workflow:** Both
- **Location:** `src/components/create-estimate-modal.tsx:1030`
- **Problem:** `|| undefined` converts `false` to `undefined`, so `additionalEstimate` is omitted for regular estimates. Functionally harmless but inconsistent typing.
- **Recommended Fix:** `additionalEstimate: isAdditionalEstimate ? true : undefined` (clarity only).

### C-20: `discountAmount` initial value uses `prefillData?.discounts` but payload key is `discounts` (Both)
- **Severity:** Low
- **Workflow:** Both
- **Location:** `src/components/create-estimate-modal.tsx:721`, `:1026`
- **Problem:** `initialForm.discountAmount = prefillData?.discounts ?? 0` and `payload.discounts = values.discountAmount`. Consistent, but the form field is named `discountAmount` while the DTO/payload field is `discounts` — naming mismatch that could confuse maintenance.
- **Recommended Fix:** Rename form field to `discounts` for consistency, or add a comment.

### C-21: `gst` disabled but still submitted when no `enquiryId` (Both)
- **Severity:** Low
- **Workflow:** Both
- **Location:** `src/components/create-estimate-modal.tsx:1237`, `:1023`
- **Problem:** `gstDisabled = values.gstType === "NONE" || !prefillData?.enquiryId`. When no enquiryId, `gst` input is disabled but `values.gst` (default `0`) is still submitted. Harmless (default 0), but disabled-field submission is redundant.
- **Recommended Fix:** Acceptable as-is; no action required.

### C-22: Phone number format not validated (Both)
- **Severity:** Low
- **Workflow:** Both
- **Location:** `src/components/create-estimate-modal.tsx:160-162`
- **Problem:** `pocContactNumber` has `.required()` but the `.matches(/^\d{10}$/)` is commented out, so any string (including non-numeric) passes.
- **Recommended Fix:** Re-enable or replace with appropriate phone validation if required by business rules.

### C-23: `clientPoC` defaults to client name (Both)
- **Severity:** Low
- **Workflow:** Both
- **Location:** `src/components/create-estimate-modal.tsx:715`
- **Problem:** `clientPoC: prefillData?.clientPoC ?? prefillData?.client ?? ""` falls back to the client name, which is semantically wrong (a person's name vs. company name).
- **Recommended Fix:** Do not fall back to `client`; use `""` if `clientPoC` absent.

### C-24: `expensesTotal` mislabeled (it equals item subtotal) (Both)
- **Severity:** Low
- **Workflow:** Both
- **Location:** `src/components/create-estimate-modal.tsx:1000`
- **Problem:** `invoiceSummary.expensesTotal = Number(totalAmount.toFixed(2))` where `totalAmount` is the item subtotal (`days*sqft*rate` sum). Labeling the subtotal as "expensesTotal" is semantically inaccurate.
- **Recommended Fix:** Confirm with backend whether `expensesTotal` should equal subtotal or a separate expense sum.

### C-25: `netTotal` equals `totalWithGST` (Both)
- **Severity:** Low
- **Workflow:** Both
- **Location:** `src/components/create-estimate-modal.tsx:1002`
- **Problem:** `netTotal` is set to `totalWithGST`. Depending on business definition, net total may exclude GST. This is a definition question, not necessarily a bug.
- **Recommended Fix:** Confirm net-total definition with product/backend.

---

## D. Missing Validation and Edge-Case Audit

| Scenario | Status | Notes |
|----------|--------|-------|
| Empty estimate submission | Not handled | No "at least one item" rule (C-3). |
| Empty categories / subcategories | Partially handled | Empty category allowed; editor allows empty subcategory markers. |
| Items with missing specification | Partially handled | Specification optional; falls back to item name (line 941). |
| Zero quantity (sqft) | Handled | Rejected (`< 1`, line 902). |
| Zero days | Handled | Rejected (`< 1`, line 903). |
| Zero rate | Handled | Rejected (`=== 0`, line 901) — but arguably free items should be allowed; business rule TBD. |
| Negative quantity/days | Handled | Rejected (`< 1`). |
| Negative rate | Not handled | Allowed → negative totals (C-2). |
| Very large values / decimal precision | Partially handled | `toFixed(2)` used; no max/ceiling; `Infinity` possible with extreme percentages. |
| Duplicate items | Not handled | No duplicate detection in create/edit (only additional-estimate comparison). |
| Rapid add/delete rows | Partially handled | Category editor handles structurally; React state may re-render heavily on large lists. |
| Edit item while save pending | Partially handled | `isSaving` disables submit; item edits during save are captured in `lines` and sent on next submit. |
| Switching categories/subcategories | Partially handled | Category editor handles renames/deletes; lines state rebuilt. |
| Close modal during API submission | Partially handled | Close blocked while `isSaving` (line 1206); but save has no abort (C-18). |
| Reopen after unsuccessful submission | Partially handled | Modal stays open on failure; `lines` retains edits. But reopen-after-close resets `lines` (C-17). |
| API timeout / network interruption | Partially handled | `apiRequest` uses raw `fetch` with no timeout; catch shows error toast. |
| Session expiration / logout during editing | Partially handled | `apiClient` handles 401 by clearing auth and redirecting to login; in-flight save fails. |
| Browser refresh / navigation during editing | Not handled | No draft persistence; all edits lost (no IndexedDB). |
| Recover partially saved data | Not handled | No IndexedDB/draft-recovery mechanism exists in the codebase. |
| Unexpected backend data (legacy items) | Partially handled | `mapEnquiryToPrefill` and prefill item mapping are defensive (coerce fields, defaults). |
| Concurrent modifications / stale data | Not handled | No optimistic locking (C-10). |
| Repeated save attempts | Partially handled | `isSaving` disables button; but no request dedup beyond UI disable. |
| Partial/malformed API responses | Partially handled | Unparseable 200 treated as saved with fake id (C-9); non-200 throws to catch. |

---

## E. Financial Calculation Audit

### `calculateEstimateSummary` (src/lib/utils/estimate.ts:3-25)

Inputs: `totalAmount`, `gst`, `serviceCharge`, `discounts`.

Calculation order:
1. `serviceChargeAmount = totalAmount * serviceCharge / 100` (via `calculatePercentageAmount`)
2. `totalWithServiceCharge = totalAmount + serviceChargeAmount`
3. `totalAfterDiscounts = totalAmount ? totalWithServiceCharge - discounts : 0`
4. `gstAmount = totalAfterDiscounts * gst / 100`
5. `totalWithGST = totalAfterDiscounts + gstAmount`

Order: Subtotal → add service charge → subtract flat discount → apply GST on the discounted amount.

### `totalAmount` (create-estimate-modal.tsx:727-730)

`totalAmount = lines.reduce((sum, line) => sum + line.days * line.sqft * line.rate, 0)`

Each line total = `days * sqft * rate`. Matches `finalAmt` in payload (line 937: `count * pricePerItem * days` where `count = sqft`, `pricePerItem = rate`). Consistent.

### `invoiceSummary` (create-estimate-modal.tsx:996-1003)

| Field | Source | Notes |
|-------|--------|-------|
| `discountAmount` | `values.discountAmount` | Flat amount. |
| `serviceChargeAmt` | `summary.serviceChargeAmount` | % of subtotal. |
| `additionalCostAmt` | `0` (hardcoded) | **Always zero** — additional costs not collected (C-7). |
| `expensesTotal` | `totalAmount` | Actually the item subtotal; semantically mislabeled (C-24). |
| `gstAmount` | `summary.gstAmount` | % of (subtotal + service − discount). |
| `netTotal` | `summary.totalWithGST` | Equals totalWithGST (C-25). |

### Discrepancies / items requiring backend confirmation

1. **Calculation order:** Service charge is added before discount; GST applied after discount. Whether backend applies GST on pre- or post-discount amounts, and whether service charge precedes discount, is unconfirmed (no backend source). This is the single largest financial-integrity risk.
2. **TDS:** `calculateEstimateSummary` does not compute TDS at all, despite `tds` existing on the DTO/payload. TDS is never collected (C-6).
3. **Additional costs:** `additionalCostAmt` hardcoded to `0`; `additionalCostEstimate` never submitted (C-7).
4. **Rounding:** Each monetary value is independently `toFixed(2)`-rounded at payload build time. Sum of rounded line totals may differ from rounded sum by a few paise; backend may recompute. Confirm whether frontend or backend is authoritative for totals.
5. **GST when NONE:** `gst` may be non-zero while `gstType === "NONE"` (C-11) → contradictory payload.

### Frontend vs Backend totals
The `CostSummary` (render) and `invoiceSummary` (payload) both call `calculateEstimateSummary` with the same inputs, so displayed totals match the payload. The risk is that *both* disagree with the backend's own calculation.

---

## F. API Contract Audit

| Aspect | Frontend | Backend Expectation (inferred) | Status |
|--------|----------|-------------------------------|--------|
| Endpoint (create & edit) | `POST /api/estimates` | Create = POST; Edit ambiguous (POST with id/version vs PUT/PATCH) | Unconfirmed (C-15) |
| `estimateStatus` | Hardcoded `"DRAFT"` (line 1028) | Preserve existing on edit | Mismatch (C-1) |
| `status` | `EstimateStatus` (eventStatus subset) | Full `EstimateStatus` incl. OPEN/CLOSED/CANCELLED | Mismatch (C-4) |
| `tds` | Not sent | `tds?: number` supported | Field dropped (C-6) |
| `additionalCostEstimate` | Not sent | Supported on `EstimateDto` | Field dropped (C-7) |
| `client` | Client name (string) | Possibly client ID | Unconfirmed |
| `clientID` | `prefillData.clientID ?? fallbackClientId` | ? | Possibly OK |
| Dates | `toISOString().replace(/Z/,"")` (no tz) | ? | Format unconfirmed (C-12) |
| `items` | `Record<string, EstimateLineItemPayload[]>` | ? | Matches DTO |
| `serialNumber` | Restarts per category | ? | Possible mismatch (C-13) |
| Error handling | 401 → logout redirect; non-ok → catch toast | ? | OK-ish |
| Unparseable 200 | Fabricated `tmp-...` id, treated as saved | Should be real JSON | Defect (C-9) |

No OpenAPI/swagger or backend source was available in the repository, so the above backend expectations are inferred from type definitions and endpoint naming only. **Backend contract verification is required before production.**

---

## G. State Management and Data Integrity

### Confirmed issues

1. **Form/lines state split:** Items live in `lines` state (React `useState`) while header fields live in Formik. The Yup schema never validates items; `totalAmount` derives from `lines`. This split means Formik's `validateOnChange`/`validateOnBlur` do not cover items (C-3).
2. **`selectedClientId` type confusion:** Stores name but used as a Select value expecting IDs (C-8).
3. **`lines` reset on reopen:** Every `isOpen` false→true re-derives `lines` from `prefillData.items`, discarding session edits (C-17).
4. **No abort on unmount:** In-flight save continues after unmount; state updates and callbacks fire on unmounted component (C-18).
5. **No draft persistence:** No IndexedDB/localStorage draft recovery; refresh/navigation loses all edits (C-17, scenario audit).
6. **Race on `prefillData` prop identity:** `useEffect` (line 227) and `initialForm` memo (line 705) both key on `prefillData`; if the parent passes a new object identity on each render, `prefillData`/`initialForm` reset and user edits are discarded. (Observed stable in current callers, but fragile.)
7. **`pendingAdditionalEstimate` abandonment:** Main-modal Cancel discards the pending additional estimate (C-16).

### State consistency
- `totalAmount` memo and `summary` (render-time `calculateEstimateSummary`) both derive from `lines` + Formik `values`; they remain consistent because both read the same sources at render time.
- `uiItemsForFallback` is built from `persistableLines` at submit time and used only in the fallback `EstimateDto`; consistent with `lines` at submit time.

---

## H. Recommended Implementation Plan

### 1. Critical fixes (immediate)
1.1. Fix `estimateStatus` hardcoding — preserve `prefillData.estimateStatus` on edit (C-1).
1.2. Reject negative `rate` in submit validation (`<= 0`) (C-2).
1.3. Require at least one item before saving (C-3).
1.4. Allow `OPEN`/`CLOSED`/`CANCELLED` in the status Yup schema (C-4).
1.5. Block edits to FINAL/EVENT_CREATED/EVENT_MERGED estimates (C-5).

### 2. High-priority fixes (pre-production)
2.1. Add TDS field to form + payload (C-6).
2.2. Add additional-cost collection + `additionalCostAmt` (C-7).
2.3. Align `selectedClientId` to store client ID consistently (C-8).
2.4. Treat unparseable 200 responses as failure, not saved-with-fake-id (C-9).
2.5. Add optimistic-locking / conflict handling (409) on edit (C-10).
2.6. Reconcile `gst = 0` when `gstType === "NONE"` (C-11).
2.7. Confirm edit endpoint/method (POST vs PUT/PATCH) with backend (C-15).
2.8. Prevent main-modal Cancel from abandoning pending additional estimate (C-16).
2.9. Verify backend financial-calculation order and totals rounding (E).

### 3. Medium-priority improvements
3.1. Confirm date serialization format (C-12).
3.2. Confirm `serialNumber` global vs per-category (C-13).
3.3. Add save-request abort/unmount guard (C-18).
3.4. Add draft persistence (IndexedDB) or explicit discard-on-close semantics (C-17).
3.5. Re-enable phone validation (C-22).
3.6. Fix `clientPoC` fallback (C-23).

### 4. Low-priority
4.1. Rename `discountAmount` field to `discounts` for consistency (C-20).
4.2. Confirm `netTotal` / `expensesTotal` definitions (C-24, C-25).
4.3. Clarify `checkList` and `additionalEstimate` payload flags (C-14, C-19).

### Suggested implementation order
1. C-1, C-2, C-3, C-4, C-5 (data integrity)
2. C-9, C-10 (API correctness)
3. C-6, C-7, C-8 (field completeness)
4. C-11, C-15, C-16 (behavioral correctness)
5. C-12 through C-25 (polish / contract confirmation)

**Note:** Several fixes (calculation order, TDS, additional costs, date format, serial numbering, edit endpoint) require **backend confirmation** before implementation, as no backend source or contract documentation is available in this repository.

---

## I. Regression Testing Checklist

### Creation flow
- [ ] Create a draft estimate with one item; verify totals (subtotal, service charge, discount, GST, net total) match `calculateEstimateSummary`.
- [ ] Create with multiple categories/subcategories/items; verify item totals and serial numbers.
- [ ] Attempt to save with zero items → must be blocked.
- [ ] Attempt to save with a negative rate → must be blocked.
- [ ] Attempt to save with zero days or zero quantity → must be blocked.
- [ ] Change `gstType` to `NONE` → `gst` should reset to 0 and submit as 0.
- [ ] Change `gstType` between CGST_SGST/IGST/NONE → summary recalculates.
- [ ] Edit an item's rate/days/sqft → line total and grand total update.
- [ ] Add then delete an item → totals reflect removal.
- [ ] Prefill from an enquiry → client, title, dates, items load correctly.
- [ ] Clear enquiry selection → fields reset appropriately.
- [ ] Save success → toast, `onSaved`, close, parent list refreshes.
- [ ] Save failure (network/500) → error toast, form stays open, `isSaving` resets.
- [ ] Double-click save → only one request (button disabled by `isSaving`).

### Edit flow
- [ ] Open an existing DRAFT estimate → all fields/items load; editing and saving updates correctly.
- [ ] Edit an estimate with status `OPEN`/`CLOSED`/`CANCELLED` → must be allowed to save (currently blocked, C-4).
- [ ] Edit a FINAL/EVENT_CREATED estimate → should be blocked/read-only (currently allowed, C-5).
- [ ] Edit → verify `estimateStatus` is preserved, not reset to `DRAFT` (C-1).
- [ ] Remove an item, change another item's rate, save → removed item gone, changed value persisted, no duplicates.
- [ ] Edit → save conflict (409) → user prompted to reload (currently not handled, C-10).
- [ ] Verify payload `clientID`, `client`, `enquiryId`, `eventID` match the original estimate.

### Additional estimate flow
- [ ] Create additional estimate → confirmation modal opens, existing vs new items compared.
- [ ] Confirm and save → new estimate created with `lastEstimateID`.
- [ ] Click main-modal "Cancel" while confirmation open → should warn or cleanly discard (C-16).

### Error / recovery
- [ ] Network interruption during save → error toast, form intact, retryable.
- [ ] 401 during save → auth cleared, redirect to login.
- [ ] Unparseable 200 response → not treated as saved (C-9).
- [ ] Refresh/navigation mid-edit → confirm data-loss behavior (no draft persistence, C-17).

### Financial accuracy
- [ ] Verify displayed Cost Summary equals `invoiceSummary` in payload.
- [ ] Verify GST applied to (subtotal + service − discount), not subtotal alone (confirm with backend).
- [ ] Verify TDS handling once added (currently missing).
- [ ] Verify large/decimal values round to 2 decimals without `Infinity`/`NaN`.

---

## Appendix: Evidence References

- `src/components/create-estimate-modal.tsx` — primary component (1619 lines)
- `src/types/estimate.ts` — `EstimateDto`, `CreateEstimatePayload`, `EstimateItem`, `EstimateStatus`, `EstimateVersionStatus`, `InvoiceSummary`
- `src/lib/utils/estimate.ts` — `calculateEstimateSummary`
- `src/lib/category-editor/hooks/useCategoryEditor.ts` — item/category/subcategory state operations
- `src/lib/category-editor/utils/grouping.ts` — `groupLines`, `flattenGroupedLines`, `isPersistableLine`
- `src/lib/category-editor/utils/line-operations.ts` — `patchLineItem`, `deleteItemLines`, etc.
- `src/lib/category-editor/utils/field.ts` — `calculateItemTotal`, `sumItemTotals`
- `src/lib/category-editor/constants.ts` — `DEFAULT_ITEM_COLUMNS` (rate min 0, days/sqft min 1)
- `src/components/artifacts-section.tsx` — thin wrapper over `CategoryEditor`
- `src/components/category-editor/item-row.tsx` — inline number editing (HTML `min` only, no JS enforcement)
- `src/components/ui/inline-number.tsx` — number input (no min enforcement in JS)
- `src/components/ui/additional-estimate-confirmation-modal.tsx` — additional estimate confirmation
- `src/lib/utils/estimate-comparison.ts` — additional estimate item comparison
- `src/constants/event.ts` — `eventStatus` (excludes OPEN/CLOSED/CANCELLED)
- `src/lib/api/api-client.ts` — `apiRequest`, 401 handling
- `src/lib/api/endpoint.ts` — `POST /api/estimates` used for both create and edit
- `src/context/estimate-prefill.tsx` — prefill context
- `src/app/(appshell)/estimates/page.tsx` — create/edit caller
- `src/components/estimate-versions-view.tsx` — additional-estimate caller

**No tests exist for the estimate flow** (no `*.test.*`/`*.spec.*` files found in `src/`). **No backend source is available** in the repository. All backend-contract findings are inferences requiring confirmation.
