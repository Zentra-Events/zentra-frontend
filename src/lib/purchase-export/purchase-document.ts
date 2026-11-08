import type {
    CategoryPurchaseRow,
    EventResponse,
    VendorFinancialRow,
} from "@/types/event";
import { numberToWords } from "@/lib/utils";
import {
    calculateClientBillSummary,
    calculateEventProfitAndLoss,
    toFiniteNumber,
    type PurchaseOrderClientBillSummary,
} from "@/lib/utils/billing";

export const PURCHASE_EXPORT_COLORS = {
    titleBg: "FFE6E0F8",
    headerBg: "FFE6E0F8",
    categoryBg: "FFD9EAD3",
    subCategoryBg: "FFEEF5EA",
    subtotalBg: "FFFFF2CC",
    totalBg: "FFB4C6E7",
    summaryBg: "FFFFFFFF",
    advanceBg: "FFFCE4EC",
    balanceBg: "FFE8F5E9",
    vendorFinBg: "FFF3E5F5",
    border: "FF000000",
} as const;

export const PURCHASE_PAYMENT_TERMS = [
    ["Payment Terms", "As per contract / 30 days from invoice"],
    ["Delivery", "As per event schedule"],
    ["GST", "Extra as applicable"],
    ["TDS", "As per income tax act"],
] as const;

export function purchaseArgbToRgb(argb: string): [number, number, number] {
    return [
        parseInt(argb.slice(2, 4), 16),
        parseInt(argb.slice(4, 6), 16),
        parseInt(argb.slice(6, 8), 16),
    ];
}

export interface PurchaseOrderDocumentModel {
    title: string;
    filenameBase: string;
    meta: { label: string; value: string }[];
    categories: CategoryPurchaseRow[];
    vendorRows: VendorFinancialRow[];
    totals: {
        subtotal: number;
        gst: number;
        tds: number;
        afterTax: number;
        advance: number;
        outstanding: number;
        gstPercent: number;
    };
    amountInWords: string;
    amountRecievedFromClientDate: string | null;
    profitSummary?: {
        estimatedAmount: number;
        serviceChargeAmount: number;
        serviceChargePercent: number;
        discountAmount: number;
        gstAmount: number;
        gstPercent: number;
        tdsAmount: number;
        tdsPercent: number;
        taxableAmount: number;
        totalClientBilledAmount: number;
        clientBilledWithoutGst: number;
        totalVendorGst: number;
        totalVendorTds: number;
        totalVendorNet: number;
        profit: number;
        netHand: number;
    };
    clientBillSummary?: PurchaseOrderClientBillSummary;
    /** Aggregated expense total fetched from `GET /api/expenses/total`. */
    expenseSummary?: {
        startDate: string;
        endDate?: string;
        totalAmount: number;
        hasExpenses: boolean;
    } | null;
}

function dateRange(start?: string, end?: string): string {
    if (!start || !end) return "—";
    const format = (value: string) =>
        new Date(value).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    return `${format(start)} – ${format(end)}`;
}

function filenamePart(value: string): string {
    return value
        .normalize("NFKD")
        .replace(/[^\w-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "event";
}

export function buildPurchaseOrderDocumentModel(
    eventData: EventResponse,
    eventName: string | undefined,
    categories: CategoryPurchaseRow[],
    vendorRows: VendorFinancialRow[],
    options?: {
        totalEstimatedCost?: number;
        includeProfitSummary?: boolean;
        expenseSummary?: {
            startDate: string;
            endDate?: string;
            totalAmount: number;
            hasExpenses: boolean;
        } | null;
    },
): PurchaseOrderDocumentModel {
    const title = eventData.title || eventName || "Purchase Order Details";
    const subtotal = categories.reduce((sum, category) => sum + category.subtotal, 0);
    const gst = categories.reduce(
        (sum, category) => sum + category.items.reduce((itemSum, item) => itemSum + item.gstAmount, 0),
        0,
    );
    const tds = categories.reduce(
        (sum, category) => sum + category.items.reduce((itemSum, item) => itemSum + item.tdsAmount, 0),
        0,
    );
    const afterTax = vendorRows.reduce((sum, vendor) => sum + vendor.adjustedAmt, 0);
    const advance = vendorRows.reduce((sum, vendor) => sum + vendor.advanceAmount, 0);
    const outstanding = afterTax - advance;
    const profitSummary = options?.includeProfitSummary
        ? calculateEventProfitAndLoss({
              totalEstimatedCost: options.totalEstimatedCost ?? 0,
              gstPercent: eventData.gst ?? 0,
              tdsPercent: 0,
              clientTdsAmount: eventData.tds ?? 0,
              serviceChargePercent: eventData.serviceCharge ?? 0,
              discountAmount: eventData.discounts ?? 0,
              vendorSummaries: eventData.vendorSummary ?? [],
          })
        : undefined;

    const clientBillSummary = calculateClientBillSummary({
        totalEstimatedCost: options?.totalEstimatedCost ?? 0,
        gstPercent: eventData.gst ?? 0,
        serviceChargePercent: eventData.serviceCharge ?? 0,
        discountAmount: eventData.discounts ?? 0,
        clientTdsAmount: eventData.tds ?? 0,
        advanceAmount: eventData.advanceAmt ?? 0,
        receivedAmount: toFiniteNumber((eventData as { amountRecievedFromClient?: number }).amountRecievedFromClient, 0),
        vendorSummaries: eventData.vendorSummary ?? [],
    });

    return {
        title,
        filenameBase: `purchase-order-${filenamePart(title)}`,
        meta: [
            { label: "Client", value: eventData.client || "—" },
            { label: "Event Date", value: dateRange(eventData.eventStartDate, eventData.eventEndDate) },
            { label: "Venue", value: eventData.venue || eventData.location || "—" },
            { label: "Event ID", value: eventData.eventID || eventData.id || "—" },
            ...(eventData.billingAddress ? [{ label: "Billing Address", value: eventData.billingAddress }] : []),
            ...(eventData.pan ? [{ label: "PAN", value: eventData.pan }] : []),
        ],
        categories,
        vendorRows,
        totals: {
            subtotal,
            gst,
            tds,
            afterTax,
            advance,
            outstanding,
            gstPercent: subtotal > 0 ? (gst / subtotal) * 100 : 0,
        },
        amountInWords: outstanding > 0 ? numberToWords(outstanding) : "",
        amountRecievedFromClientDate: (eventData as { amountRecievedFromClientDate?: string | null }).amountRecievedFromClientDate ?? null,
        profitSummary,
        clientBillSummary,
        expenseSummary: options?.expenseSummary,
    };
}

export function formatPurchaseGst(gstPercent: number, gstType?: string): string {
    if (!(gstPercent > 0)) return "—";
    const labels: Record<string, string> = {
        NONE: "No GST",
        CGST_SGST: "CGST + SGST",
        IGST: "IGST",
    };
    return !gstType || gstType === "NONE"
        ? `${gstPercent}%`
        : `${gstPercent}% (${labels[gstType] ?? gstType})`;
}
