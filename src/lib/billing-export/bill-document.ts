import { formatExportCurrency, numberToWords } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Bill export model                                                  */
/* ------------------------------------------------------------------ */

/** Visual weight of a summary row in the exported document. */
export type BillSummaryVariant =
    | "subtotal"
    | "tax"
    | "deduction"
    | "total"
    | "paid"
    | "outstanding";

export interface BillLineItem {
    /** Item / element name. */
    name: string;
    /** Specification or description. */
    details: string;
    quantity: number;
    unit: string;
    rate: number;
    amount: number;
}

export type BillExportRow =
    | { type: "meta"; label: string; value: string }
    | { type: "table-header" }
    | { type: "item"; serial: number; item: BillLineItem }
    | { type: "summary"; label: string; value: number; variant: BillSummaryVariant };

export interface BillDocumentModel {
    title: string;
    subtitle?: string;
    billNumber?: string;
    billDate?: string;
    meta: { label: string; value: string }[];
    rows: BillExportRow[];
    summary: { label: string; value: number; variant: BillSummaryVariant }[];
    /** Total amount of the bill, rendered in words under the summary. */
    amountInWords: string;
    filenameBase: string;
}

export const BILL_EXPORT_COLUMNS = ["Sl. No", "Elements", "Details", "nos", "Unit", "Rate", "Amount"] as const;

/* ------------------------------------------------------------------ */
/*  Builders                                                           */
/* ------------------------------------------------------------------ */

export interface BillDocumentConfig {
    title: string;
    subtitle?: string;
    billNumber?: string;
    billDate?: string;
    meta: { label: string; value: string }[];
    items: BillLineItem[];
    summary: { label: string; value: number; variant: BillSummaryVariant }[];
    totalAmount: number;
    filenameBase: string;
}

/**
 * Build the serializable document model of a bill.
 *
 * The model is intentionally free of any PDF/Excel dependency so it can be
 * rendered by several exporters and rendered inside the preview modal.
 */
export function buildBillDocumentModel(config: BillDocumentConfig): BillDocumentModel {
    const rows: BillExportRow[] = config.meta.map(entry => ({
        type: "meta",
        label: entry.label,
        value: entry.value,
    }));

    rows.push({ type: "table-header" });

    config.items.forEach((item, index) => {
        rows.push({ type: "item", serial: index + 1, item });
    });

    return {
        title: config.title,
        subtitle: config.subtitle,
        billNumber: config.billNumber,
        billDate: config.billDate,
        meta: config.meta,
        rows,
        summary: config.summary,
        amountInWords: numberToWords(Math.round(config.totalAmount)),
        filenameBase: config.filenameBase,
    };
}

/** Summary row helper keeping the label/value/variant triplet consistent. */
export function billSummaryRow(
    label: string,
    value: number,
    variant: BillSummaryVariant,
): { label: string; value: number; variant: BillSummaryVariant } {
    return { label, value, variant };
}

/** Safe file name fragment for a downloaded bill. */
export function toFilenameFragment(value: string | undefined | null): string {
    return (value ?? "")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/[\s_]+/g, "-")
        .toLowerCase() || "bill";
}

export { formatExportCurrency };
