import type { BillableLine } from "@/lib/utils/billing";

/* ------------------------------------------------------------------ */
/*  Bill status                                                        */
/* ------------------------------------------------------------------ */

/**
 * Lifecycle status of a bill.
 *
 * The values mirror the `BillStatus` enum of the backend, which persists the
 * name of the constant (`UNPAID`, `PARTIALLY_PAID`, ...).
 */
export type BillStatus =
    | "DRAFT"
    | "UNPAID"
    | "PARTIALLY_PAID"
    | "PAID"
    | "OVERDUE"
    | "CANCELLED";

/* ------------------------------------------------------------------ */
/*  Client bill                                                        */
/* ------------------------------------------------------------------ */

/**
 * A client bill as persisted by the backend `ClientBill` collection
 * (`POST/GET /api/client-bills`).
 *
 * The backend entity is a flat record without a status field and without an
 * event id column, so the event linkage is carried by `billNo` /
 * `enquiryCordinate` (see `buildClientBillNumber`).
 */
export interface ClientBill {
    id?: string;
    /** Event the bill was raised for. */
    eventID?: string | null;
    /** Identifier / version title of the estimate the bill was raised against. */
    estimateNo?: string | null;
    /** Enquiry the event belongs to. */
    enquiryCordinate?: string | null;
    /** Client phone number captured on the bill. */
    phonecompany?: string | null;
    /** Event title (free text, as stored by the backend). */
    event?: string | null;
    eventDate?: string | null;
    /** Client's own purchase order reference. */
    clientPONumber?: string | null;
    /** Bill number, e.g. `CB/<eventID>/<MM-YYYY>`. */
    billNo?: string | null;
    billDate?: string | null;
    /** Lifecycle status of the bill, maintained by the backend. */
    status?: BillStatus | null;
    /** Taxable amount of the bill (before GST). */
    billAmt?: number | null;
    /** GST amount. */
    gst?: number | null;
    /** Gross bill value including GST. */
    totalAmt?: number | null;
    /** TDS deducted by the client. */
    clientTDSDeduction?: number | null;
    /** Amount already received from the client. */
    advanceAmtReceived?: number | null;
    advanceReceivedDate?: string | null;
    /** Purchase order amount the bill was raised against. */
    poAmt?: number | null;
    /** TDS payable on the vendor side. */
    tdsPayable?: number | null;
    reverseCredit?: number | null;
    profit?: number | null;
    netHand?: number | null;
}

/* ------------------------------------------------------------------ */
/*  Vendor bill                                                        */
/* ------------------------------------------------------------------ */

/**
 * A vendor bill as persisted by the backend `VendorBill` collection
 * (`POST/GET /api/vendor-bills`).
 *
 * The backend entity carries the vendor's identity and its line items but no
 * monetary fields, so the amounts live in the purchase order / vendor
 * summary of the event.
 */
export interface VendorBill {
    id?: string;
    /** Event the bill was raised for. */
    eventID?: string | null;
    /** Vendor name. */
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    poc?: string | null;
    /** Vendor GSTIN. */
    gst?: string | null;
    pan?: string | null;
    gstCertificate?: string | null;
    /** Bill reference, e.g. `VB/<eventID>/<MM-YYYY>`. */
    invoiceNumber?: string | null;
    /** Lifecycle status of the bill, maintained by the backend. */
    status?: BillStatus | null;
    vendorBankName?: string | null;
    vendorBankAccount?: string | null;
    bankifscCode?: string | null;
    placeOfSupply?: string | null;
    accountHolderName?: string | null;
    items?: BillableLine[] | null;
    billCreateDate?: string | null;
    eventDate?: string | null;
}

/* ------------------------------------------------------------------ */
/*  Paginated list envelope                                            */
/* ------------------------------------------------------------------ */

/** Spring Data `Page` shape returned by the backend list endpoints. */
export interface PagedResponse<T> {
    content?: T[] | null;
    totalElements?: number;
    totalPages?: number;
    number?: number;
    size?: number;
    last?: boolean;
    first?: boolean;
    empty?: boolean;
}
