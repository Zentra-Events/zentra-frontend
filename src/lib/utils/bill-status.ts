import type { BillStatus } from "@/types/bill";

/* ------------------------------------------------------------------ */
/*  Status catalogue                                                   */
/* ------------------------------------------------------------------ */

/** Every status a bill can carry, in the order they are shown to the user. */
export const BILL_STATUSES: readonly BillStatus[] = [
    "DRAFT",
    "UNPAID",
    "PARTIALLY_PAID",
    "PAID",
    "OVERDUE",
    "CANCELLED",
] as const;

/** Human readable label of every status. */
export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
    DRAFT: "Draft",
    UNPAID: "Unpaid",
    PARTIALLY_PAID: "Partially Paid",
    PAID: "Paid",
    OVERDUE: "Overdue",
    CANCELLED: "Cancelled",
};

/** Badge variant used to render every status. */
export const BILL_STATUS_VARIANTS: Record<
    BillStatus,
    "default" | "success" | "warning" | "danger" | "info"
> = {
    DRAFT: "default",
    UNPAID: "danger",
    PARTIALLY_PAID: "warning",
    PAID: "success",
    OVERDUE: "danger",
    CANCELLED: "info",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Checks whether an unknown value is a known bill status.
 *
 * The backend answers with the name of the enum constant, but bills created
 * before the status existed have no status at all.
 */
export function isBillStatus(value: unknown): value is BillStatus {
    return typeof value === "string" && BILL_STATUSES.includes(value as BillStatus);
}

/**
 * Normalises a status coming from the backend.
 *
 * @returns the status or `null` when the value is missing or unknown
 */
export function normalizeBillStatus(value: unknown): BillStatus | null {
    if (!isBillStatus(value)) return null;
    return value;
}

/** Label of a status, falling back to the raw value for unknown statuses. */
export function getBillStatusLabel(status: BillStatus | string | null | undefined): string {
    if (!status) return "Unknown";
    return BILL_STATUS_LABELS[status as BillStatus] ?? String(status);
}

/** Badge variant of a status. */
export function getBillStatusVariant(
    status: BillStatus | string | null | undefined,
): "default" | "success" | "warning" | "danger" | "info" {
    if (!status) return "default";
    return BILL_STATUS_VARIANTS[status as BillStatus] ?? "default";
}

/**
 * Derives a status from the amounts of a bill.
 *
 * This is only a fallback for bills that were created before the backend
 * started to store the status: a bill without a balance is paid, a bill with
 * a partial payment is partially paid and a bill without any payment is
 * unpaid.
 */
export function deriveBillStatus(
    outstandingAmount: number | null | undefined,
    paidAmount: number | null | undefined,
): BillStatus {
    if (outstandingAmount === null || outstandingAmount === undefined) {
        return "DRAFT";
    }

    if (outstandingAmount <= 0) {
        return "PAID";
    }

    if ((paidAmount ?? 0) > 0) {
        return "PARTIALLY_PAID";
    }

    return "UNPAID";
}

/**
 * Resolves the status of a bill.
 *
 * The stored status always wins; the derived one is used for bills that do
 * not carry a status yet.
 */
export function resolveBillStatus(
    status: BillStatus | string | null | undefined,
    outstandingAmount: number | null | undefined,
    paidAmount: number | null | undefined,
): BillStatus {
    return (
        normalizeBillStatus(status) ??
        deriveBillStatus(outstandingAmount, paidAmount)
    );
}
