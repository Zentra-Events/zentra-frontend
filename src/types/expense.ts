/**
 * Expense types aligned with the `/api/expenses` backend contract.
 *
 * NOTE: The deployed backend currently does NOT serialize an `id` for expense
 * records. MongoDB auto-generates an `_id` for every expense document, but the
 * backend `Expense` entity does not map it to a `@Id String id` property, so it
 * is absent from all responses (list, create and by-id). The `id` field below is
 * therefore optional: the UI enables edit/delete actions when the backend starts
 * returning it, and clearly surfaces the gap while it does not.
 */

export type ExpenseStatus =
    | "ESTIMATE_SUBMITTED"
    | "ESTIMATE_REVIEW"
    | "ESTIMATE_APPROVED"
    | "ESTIMATE_REJECTED";

export interface Expense {
    /** Backend MongoDB id. Currently NOT returned by the deployed API. */
    id?: string;
    itemName: string;
    eventID?: string;
    amount: number;
    comments?: string | null;
    poc?: string | null;
    createdDate?: string | null;
    lastUpdateddDate?: string | null;
    expenseStatus?: ExpenseStatus | string;
    /** Base64-encoded file data or file reference returned by the backend. */
    receipt?: string | null;
    /** Original file name of the uploaded receipt. */
    receiptFileName?: string | null;
    /** MIME type of the uploaded receipt (e.g. image/jpeg, application/pdf). */
    receiptContentType?: string | null;
}

/** Aggregated expense total returned by `GET /api/expenses/total`. */
export interface ExpenseSummary {
    eventID: string;
    poc: string;
    totalAmount: number;
}
