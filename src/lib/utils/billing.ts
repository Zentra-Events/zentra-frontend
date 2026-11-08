import { calculatePercentageAmount } from "@/lib/utils";
import { calculateEstimateSummary } from "@/lib/utils/estimate";

/* ------------------------------------------------------------------ */
/*  Numeric helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Coerce any value to a finite number, falling back to `fallback` when the
 * value is null / undefined / NaN / Infinity. A real `0` is preserved.
 */
export function toFiniteNumber(value: unknown, fallback = 0): number {
    const num = typeof value === "number" ? value : Number(value ?? NaN);
    return Number.isFinite(num) ? num : fallback;
}

/**
 * Amount of a single billable line.
 *
 * Mirrors the backend line formula used by
 * `EventUtil.calculateVendorTotals` and
 * `EstimateController.generateategorySummary`
 * (`quantity * pricePerItem * days`) and the frontend convention used by the
 * purchase order preview (`quantity ?? 1`, `days ?? 1`).
 */
export function getBillableLineAmount(item: {
    quantity?: number | null;
    pricePerItem?: number | null;
    days?: number | null;
}): number {
    const quantity = toFiniteNumber(item.quantity, 1);
    const rate = toFiniteNumber(item.pricePerItem, 0);
    const days = toFiniteNumber(item.days, 1);
    return quantity * rate * days;
}

/* ------------------------------------------------------------------ */
/*  Estimate line items                                                */
/* ------------------------------------------------------------------ */

/**
 * Shape of an estimate line item as returned by the backend `EventItem`
 * model. Only the fields used for billing are listed.
 */
export interface EstimateLineLike {
    item?: string | null;
    description?: string | null;
    specification?: string | null;
    category?: string | null;
    subCategory?: string | null;
    unit?: string | null;
    vendor?: string | null;
    quantity?: number | null;
    pricePerItem?: number | null;
    rate?: number | null;
    unitCost?: number | null;
    days?: number | null;
    finalAmt?: number | null;
    total?: number | null;
}

/** Rate of an estimate line item. */
export function getEstimateItemRate(item: EstimateLineLike): number {
    return toFiniteNumber(item.pricePerItem ?? item.rate ?? item.unitCost, 0);
}

/**
 * Amount of an estimate line item.
 *
 * The backend stores the resolved amount in `finalAmt`; when it is missing
 * the amount is derived with the same formula the backend uses for its
 * category totals (`quantity * pricePerItem * days`).
 */
export function getEstimateItemAmount(item: EstimateLineLike): number {
    const finalAmt = toFiniteNumber(item.finalAmt, Number.NaN);
    if (Number.isFinite(finalAmt)) return finalAmt;

    const total = toFiniteNumber(item.total, Number.NaN);
    if (Number.isFinite(total)) return total;

    return getBillableLineAmount({
        quantity: item.quantity,
        pricePerItem: getEstimateItemRate(item),
        days: item.days,
    });
}

export function getEstimateItemName(item: EstimateLineLike): string {
    return (item.item ?? "").trim() || "—";
}

export function getEstimateItemDetails(item: EstimateLineLike): string {
    return (item.specification ?? item.description ?? "").trim() || "—";
}

export function getEstimateItemUnit(item: EstimateLineLike): string {
    return (item.unit ?? "").trim() || "nos";
}

/**
 * Flatten the `category -> items` map of an estimate into a single list,
 * keeping the category of every line.
 */
export function flattenEstimateItems(estimate: {
    items?: Record<string, EstimateLineLike[]> | null;
}): EstimateLineLike[] {
    const items = estimate.items;
    if (!items || typeof items !== "object") return [];

    return Object.entries(items).flatMap(([category, group]) =>
        (Array.isArray(group) ? group : []).map(line => ({
            ...line,
            category: line.category ?? category,
        })),
    );
}

/* ------------------------------------------------------------------ */
/*  Client side billing                                                */
/* ------------------------------------------------------------------ */

/**
 * Estimate version statuses that make an estimate part of the event's
 * approved, billable amount. Mirrors the filter already applied on the event
 * detail page.
 */
export const BILLABLE_ESTIMATE_STATUSES = ["EVENT_CREATED", "EVENT_MERGED"] as const;

export function isBillableEstimate(estimate: { estimateStatus?: string | null }): boolean {
    const status = estimate.estimateStatus ?? "";
    return (BILLABLE_ESTIMATE_STATUSES as readonly string[]).includes(status);
}

/**
 * Keep only the estimate versions that are part of the approved, billable
 * amount of the event (the estimate the event was created from plus any
 * additional estimate merged into it).
 *
 * Versions are de-duplicated by id so a repeated record can never inflate the
 * billable amount.
 */
export function selectBillableEstimates<T extends { id?: string; estimateStatus?: string | null }>(
    estimates: readonly T[] | null | undefined,
): T[] {
    if (!Array.isArray(estimates)) return [];

    const seen = new Set<string>();
    return estimates.filter(estimate => {
        if (!isBillableEstimate(estimate)) return false;

        const key = estimate.id ?? estimate.versionTitle;
        if (!key) return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Subtotal of a single estimate, before tax.
 *
 * The backend already stores the per-category subtotals on the estimate
 * (`categorySummary[].subTotal`, computed as `quantity * pricePerItem * days`),
 * so that is preferred. When it is missing the amount is derived from the
 * estimate's own line items using the same formula.
 */
export function getEstimateSubTotal(estimate: {
    categorySummary?: { category?: string; subTotal?: number }[] | null;
    items?: Record<string, BillableLine[]> | null;
}): number {
    const categorySummary = estimate.categorySummary;
    if (Array.isArray(categorySummary) && categorySummary.length > 0) {
        return categorySummary.reduce(
            (sum, category) => sum + toFiniteNumber(category?.subTotal, 0),
            0,
        );
    }

    const items = estimate.items;
    if (items && typeof items === "object") {
        return Object.values(items).reduce(
            (sum, group) =>
                sum +
                (Array.isArray(group) ? group : []).reduce(
                    (groupSum, item) => groupSum + getBillableLineAmount(item),
                    0,
                ),
            0,
        );
    }

    return 0;
}

/**
 * Approved estimate amount (before tax) for an event: the sum of the
 * subtotals of every billable estimate version.
 */
export function sumBillableEstimateAmount(
    estimates: readonly {
        categorySummary?: { category?: string; subTotal?: number }[] | null;
        items?: Record<string, BillableLine[]> | null;
    }[] | null
    | undefined,
): number {
    if (!Array.isArray(estimates)) return 0;
    return estimates.reduce((sum, estimate) => sum + getEstimateSubTotal(estimate), 0);
}

export interface ClientBillInput {
    /** Approved estimate amount before tax. */
    baseAmount: number;
    /** Service charge, expressed as a percentage of the base amount. */
    serviceChargePercent: number;
    /** Discount, expressed as a flat rupee amount. */
    discountAmount: number;
    /** GST, expressed as a percentage of the taxable amount. */
    gstPercent: number;
    /** TDS, expressed as a percentage of the taxable amount. */
    tdsPercent: number;
    /** Amount already received from the client. */
    receivedAmount: number;
}

export interface ClientBillTotals {
    baseAmount: number;
    serviceChargePercent: number;
    serviceChargeAmount: number;
    discountAmount: number;
    /** Base + service charge - discount. GST and TDS are applied on this. */
    taxableAmount: number;
    gstPercent: number;
    gstAmount: number;
    tdsPercent: number;
    tdsAmount: number;
    /** Invoice value including GST, before the TDS deduction. */
    grossAmount: number;
    /** Total client bill amount: taxable + GST - TDS. */
    totalAmount: number;
    receivedAmount: number;
    outstandingAmount: number;
}

/**
 * Client bill totals.
 *
 * The rule is the one already established in the application
 * (`create-purchase-order-modal.tsx` and `profit-summary.tsx`):
 *
 *   service charge = base * serviceChargePercent / 100
 *   taxable        = base + service charge - discount
 *   GST            = taxable * gstPercent / 100
 *   TDS            = taxable * tdsPercent / 100
 *   total bill     = taxable + GST - TDS
 *   outstanding    = total bill - received
 *
 * GST and TDS are applied on the same taxable base, and the discount is a
 * flat amount (not a percentage) exactly as the rest of the application
 * treats `event.discounts`.
 */
export function calculateClientBillTotals(input: ClientBillInput): ClientBillTotals {
    const baseAmount = toFiniteNumber(input.baseAmount, 0);
    const serviceChargePercent = toFiniteNumber(input.serviceChargePercent, 0);
    const discountAmount = toFiniteNumber(input.discountAmount, 0);
    const gstPercent = toFiniteNumber(input.gstPercent, 0);
    const tdsPercent = toFiniteNumber(input.tdsPercent, 0);
    const receivedAmount = toFiniteNumber(input.receivedAmount, 0);

    const { serviceChargeAmount, gstAmount } = calculateEstimateSummary({
        totalAmount: baseAmount,
        gst: gstPercent,
        serviceCharge: serviceChargePercent,
        discounts: discountAmount,
    });

    // Mirrors the guard of `calculateEstimateSummary`: without a base amount
    // there is nothing to tax, so the taxable amount collapses to zero
    // instead of turning into a negative discount.
    const taxableAmount = baseAmount
        ? baseAmount + serviceChargeAmount - discountAmount
        : 0;
    const tdsAmount = calculatePercentageAmount(taxableAmount, tdsPercent);
    const grossAmount = taxableAmount + gstAmount;
    const totalAmount = grossAmount - tdsAmount;

    return {
        baseAmount,
        serviceChargePercent,
        serviceChargeAmount,
        discountAmount,
        taxableAmount,
        gstPercent,
        gstAmount,
        tdsPercent,
        tdsAmount,
        grossAmount,
        totalAmount,
        receivedAmount,
        outstandingAmount: totalAmount - receivedAmount,
    };
}

/* ------------------------------------------------------------------ */
/*  Vendor side billing                                                */
/* ------------------------------------------------------------------ */

export interface VendorBillInput {
    /** Sum of the purchase order line amounts for this vendor. */
    subtotal: number;
    /** GST percentage for this vendor. */
    gstPercent: number;
    /** TDS percentage for this vendor. */
    tdsPercent: number;
    /** Amount already paid to the vendor as an advance. */
    advanceAmount: number;
}

export interface VendorBillTotals {
    subtotal: number;
    gstPercent: number;
    gstAmount: number;
    tdsPercent: number;
    tdsAmount: number;
    /** Net amount payable to the vendor: subtotal + GST - TDS. */
    totalAmount: number;
    paidAmount: number;
    outstandingAmount: number;
}

/**
 * Vendor bill totals.
 *
 * Mirrors the backend `VendorSummary` convention
 * (`adjusted = total + total * gst/100 - total * tds/100`,
 * `balance = adjusted - advance`) and the purchase order modal's
 * `subtotal + gst - tds` net total.
 */
export function calculateVendorBillTotals(input: VendorBillInput): VendorBillTotals {
    const subtotal = toFiniteNumber(input.subtotal, 0);
    const gstPercent = toFiniteNumber(input.gstPercent, 0);
    const tdsPercent = toFiniteNumber(input.tdsPercent, 0);
    const advanceAmount = toFiniteNumber(input.advanceAmount, 0);

    const gstAmount = calculatePercentageAmount(subtotal, gstPercent);
    const tdsAmount = calculatePercentageAmount(subtotal, tdsPercent);
    const totalAmount = subtotal + gstAmount - tdsAmount;

    return {
        subtotal,
        gstPercent,
        gstAmount,
        tdsPercent,
        tdsAmount,
        totalAmount,
        paidAmount: advanceAmount,
        outstandingAmount: totalAmount - advanceAmount,
    };
}

/* ------------------------------------------------------------------ */
/*  Vendor grouping                                                    */
/* ------------------------------------------------------------------ */

export interface BillableLine {
    item?: string | null;
    description?: string | null;
    category?: string | null;
    subCategory?: string | null;
    unit?: string | null;
    vendor?: string | null;
    quantity?: number | null;
    pricePerItem?: number | null;
    days?: number | null;
    /** Amount resolved by the backend when the line was created. */
    finalAmt?: number | null;
}

/**
 * Per vendor financial rollup as stored by the backend in
 * `event.vendorSummary`.
 */
export interface VendorSummaryLike {
    vendor?: string | null;
    gst?: number | null;
    tds?: number | null;
    totalAmount?: number | null;
    advanceAmount?: number | null;
    adjustedAmt?: number | null;
    balance?: number | null;
}

export interface VendorBillGroup {
    /** Key used by the backend `vendorSummary[].vendor` field. */
    vendorKey: string;
    vendorName: string;
    items: BillableLine[];
    totals: VendorBillTotals;
}

/** Vendor key used for items that are fulfilled in-house (no external vendor). */
export const SELF_VENDOR_KEY = "SELF";

/**
 * Group the event's purchase order lines by vendor and attach the matching
 * per-vendor financial summary (GST %, TDS %, advance).
 *
 * The backend stores the purchase order as a flat list of line items on the
 * event (`event.items`), each carrying its own vendor attribution, plus a
 * per-vendor rollup in `event.vendorSummary`. Every line belongs to exactly
 * one vendor, so grouping never duplicates or drops an amount.
 */
export function buildVendorBillGroups(
    items: readonly BillableLine[] | null | undefined,
    vendorSummary: readonly VendorSummaryLike[] | null | undefined,
    vendorList: readonly { id?: string; name?: string }[] | null | undefined,
): VendorBillGroup[] {
    const lines = Array.isArray(items) ? items : [];

    const summaryByVendor = new Map<string, VendorSummaryLike>();
    (vendorSummary ?? []).forEach(summary => {
        const key = normalizeVendorKey(summary?.vendor);
        if (key) summaryByVendor.set(key, summary);
    });

    const grouped = new Map<string, BillableLine[]>();
    lines.forEach(line => {
        const key = normalizeVendorKey(line?.vendor);
        if (!key) return;
        const bucket = grouped.get(key);
        if (bucket) bucket.push(line);
        else grouped.set(key, [line]);
    });

    // Vendors that only exist in the summary (no lines in the payload) are
    // still surfaced so their outstanding balance is not hidden.
    summaryByVendor.forEach((summary, key) => {
        if (!grouped.has(key)) grouped.set(key, []);
    });

    return Array.from(grouped.entries()).map(([vendorKey, vendorItems]) => {
        const summary = summaryByVendor.get(vendorKey);
        const subtotal = vendorItems.reduce(
            (sum, line) => sum + getBillableLineAmount(line),
            0,
        );

        return {
            vendorKey,
            vendorName: resolveVendorName(vendorKey, vendorList),
            items: vendorItems,
            totals: calculateVendorBillTotals({
                // The stored vendor total is the source of truth when present;
                // otherwise fall back to the sum of the vendor's own lines.
                subtotal: summary?.totalAmount != null ? toFiniteNumber(summary.totalAmount, 0) : subtotal,
                gstPercent: toFiniteNumber(summary?.gst, 0),
                tdsPercent: toFiniteNumber(summary?.tds, 0),
                advanceAmount: toFiniteNumber(summary?.advanceAmount, 0),
            }),
        };
    });
}

/**
 * Normalise a vendor identifier to the key used by the backend.
 * Items without a vendor are fulfilled in-house and use `SELF`.
 */
export function normalizeVendorKey(vendor: string | null | undefined): string {
    const trimmed = (vendor ?? "").trim();
    if (!trimmed) return SELF_VENDOR_KEY;
    if (trimmed.toLowerCase() === "self") return SELF_VENDOR_KEY;
    return trimmed;
}

export function resolveVendorName(
    vendorKey: string,
    vendorList: readonly { id?: string; name?: string }[] | null | undefined,
): string {
    if (vendorKey === SELF_VENDOR_KEY) return SELF_VENDOR_KEY;
    const match = (vendorList ?? []).find(v => v.id === vendorKey);
    return match?.name ?? vendorKey;
}

/* ------------------------------------------------------------------ */
/*  Summaries of already generated bills                               */
/* ------------------------------------------------------------------ */

export interface ClientBillSummary {
    /** Taxable amount of the bill (before GST). */
    taxableAmount: number;
    gstAmount: number;
    tdsAmount: number;
    /** Invoice value including GST, before the TDS deduction. */
    grossAmount: number;
    /** Net bill amount: taxable + GST - TDS. */
    totalAmount: number;
    /** Amount already received from the client. */
    receivedAmount: number;
    /** Outstanding balance: total bill amount - amount received. */
    outstandingAmount: number;
}

/**
 * Summary of an already generated client bill.
 *
 * A stored client bill keeps the resulting amounts instead of the percentages
 * they were calculated from, so the percentages are derived back from the
 * stored amounts and the shared client rule is applied again. The figures are
 * therefore the same as the ones shown by the billing modal.
 */
export function summarizeClientBill(bill: {
    billAmt?: number | null;
    gst?: number | null;
    totalAmt?: number | null;
    clientTDSDeduction?: number | null;
    advanceAmtReceived?: number | null;
}): ClientBillSummary {
    const taxableAmount = toFiniteNumber(bill.billAmt, 0);
    const gstAmount = toFiniteNumber(bill.gst, 0);
    const tdsAmount = toFiniteNumber(bill.clientTDSDeduction, 0);
    const receivedAmount = toFiniteNumber(bill.advanceAmtReceived, 0);
    const grossAmount = toFiniteNumber(bill.totalAmt, taxableAmount + gstAmount);

    if (taxableAmount > 0) {
        const totals = calculateClientBillTotals({
            baseAmount: taxableAmount,
            serviceChargePercent: 0,
            discountAmount: 0,
            gstPercent: (gstAmount / taxableAmount) * 100,
            tdsPercent: (tdsAmount / taxableAmount) * 100,
            receivedAmount,
        });

        return {
            taxableAmount: totals.taxableAmount,
            gstAmount: totals.gstAmount,
            tdsAmount: totals.tdsAmount,
            grossAmount: totals.grossAmount,
            totalAmount: totals.totalAmount,
            receivedAmount: totals.receivedAmount,
            outstandingAmount: totals.outstandingAmount,
        };
    }

    // Without a taxable amount the percentages cannot be derived, so the
    // stored amounts are used as they are.
    const totalAmount = grossAmount - tdsAmount;

    return {
        taxableAmount,
        gstAmount,
        tdsAmount,
        grossAmount,
        totalAmount,
        receivedAmount,
        outstandingAmount: totalAmount - receivedAmount,
    };
}

export interface VendorBillSummary {
    /** Sum of the line items stored on the bill. */
    subtotalAmount: number;
    /** Net amount payable to the vendor, when it can be derived. */
    totalAmount: number | null;
    /** Amount already paid to the vendor, when it can be derived. */
    paidAmount: number | null;
    /** Outstanding balance, when it can be derived. */
    outstandingAmount: number | null;
}

/**
 * Summary of an already generated vendor bill.
 *
 * A stored vendor bill keeps the line items of the purchase order but no
 * monetary fields, so the amounts are derived from the per vendor rollup of
 * the event (`event.vendorSummary`) whenever it is available. Without that
 * rollup only the sum of the line items is known.
 */
export function summarizeVendorBill(
    items: readonly BillableLine[] | null | undefined,
    vendorSummary?: VendorSummaryLike | null,
): VendorBillSummary {
    const subtotalAmount = (items ?? []).reduce(
        (sum, line) => sum + getBillableLineAmount(line),
        0,
    );

    if (!vendorSummary) {
        return {
            subtotalAmount,
            totalAmount: null,
            paidAmount: null,
            outstandingAmount: null,
        };
    }

    const totals = calculateVendorBillTotals({
        // The stored vendor total is the source of truth when present;
        // otherwise fall back to the sum of the bill's own lines.
        subtotal:
            vendorSummary.totalAmount != null
                ? toFiniteNumber(vendorSummary.totalAmount, 0)
                : subtotalAmount,
        gstPercent: toFiniteNumber(vendorSummary.gst, 0),
        tdsPercent: toFiniteNumber(vendorSummary.tds, 0),
        advanceAmount: toFiniteNumber(vendorSummary.advanceAmount, 0),
    });

    return {
        subtotalAmount,
        totalAmount: totals.totalAmount,
        paidAmount: totals.paidAmount,
        outstandingAmount: totals.outstandingAmount,
    };
}

/* ------------------------------------------------------------------ */
/*  Event profit & loss                                                */
/* ------------------------------------------------------------------ */

export interface EventVendorFinancial {
    totalAmount?: number | null;
    gst?: number | null;
    tds?: number | null;
}

export interface EventProfitAndLossInput {
    totalEstimatedCost: number;
    gstPercent: number;
    tdsPercent: number;
    serviceChargePercent: number;
    discountAmount: number;
    vendorSummaries: readonly EventVendorFinancial[] | null | undefined;
    /**
     * Optional flat client TDS amount (not a percentage). When provided, the
     * client TDS is applied as a direct amount instead of being computed from
     * `tdsPercent`. Vendor TDS calculations are unaffected.
     */
    clientTdsAmount?: number;
}

export interface EventProfitAndLoss {
    estimatedAmount: number;
    serviceChargeAmount: number;
    serviceChargePercent: number;
    discountAmount: number;
    taxableAmount: number;
    gstAmount: number;
    gstPercent: number;
    tdsAmount: number;
    tdsPercent: number;
    totalClientBilledAmount: number;
    clientBilledWithoutGst: number;
    totalVendorGst: number;
    totalVendorTds: number;
    totalVendorNet: number;
    profit: number;
    netHand: number;
}

/**
 * Event level profit & loss.
 *
 * Shared client-side P&L rule used by both the billing screens and the
 * Purchase Order Preview Profit Summary (internal, admin only).
 *
 * INPUTS
 *   totalEstimatedCost  — approved estimate amount
 *   gstPercent          — client GST % (e.g. 18 = 18%)
 *   tdsPercent          — client TDS % (unused here; kept 0)
 *   clientTdsAmount     — client TDS as a FLAT applied amount
 *                         (eventData.tds); NOT a percentage
 *   serviceChargePercent — client service charge %
 *   discountAmount      — client discount (flat amount)
 *   vendorSummaries     — vendor-wise rollup from eventData
 *                         (totalAmount, gst, tds, adjustedAmt…)
 *
 * HELPER
 *   calculatePercentageAmount(amount, pct) = amount × pct / 100
 *   toFiniteNumber(v, fb)                  — coerces NaN/Inf/null to fb (default 0)
 *
 * CALCULATION STEPS (client side)
 *   1 estimatedAmount   = totalEstimatedCost
 *   2 serviceChargeAmt  = estimatedAmount × serviceChargePercent / 100
 *   3 taxableAmount     = estimatedAmount + serviceCharge - discount
 *   4 gstAmount         = taxableAmount × gstPercent / 100
 *   5 tdsAmount         = clientTdsAmount  (flat; tdsPercent unused)
 *   6 totalClientBilled = taxableAmount + gstAmount - tdsAmount
 *   7 clientBilledWoGST  = totalClientBilled - gstAmount
 *                                          (= taxableAmount - tds)
 *
 * VENDOR-SIDE ROLLUP (from vendorSummaries)
 *   totalVendorGst  = Σ totalAmount × gst   / 100
 *   totalVendorTds  = Σ totalAmount × tds   / 100
 *   totalVendorNet  = Σ (totalAmount + vendorGst - vendorTds)
 *
 * FINAL FIGURES
 *   Profit   = clientBilledWoGST + totalVendorGst
 *              - (totalVendorTds + totalVendorNet)
 *   Net Hand = clientBilledWoGST - (totalVendorTds + totalVendorNet)
 */
export function calculateEventProfitAndLoss(
    input: EventProfitAndLossInput,
): EventProfitAndLoss {
    const estimatedAmount = toFiniteNumber(input.totalEstimatedCost, 0);
    const gstPercent = toFiniteNumber(input.gstPercent, 0);
    const tdsPercent = toFiniteNumber(input.tdsPercent, 0);
    const serviceChargePercent = toFiniteNumber(input.serviceChargePercent, 0);
    const discountAmount = toFiniteNumber(input.discountAmount, 0);

    const serviceChargeAmount = calculatePercentageAmount(
        estimatedAmount,
        serviceChargePercent,
    );
    const taxableAmount = estimatedAmount + serviceChargeAmount - discountAmount;
    const gstAmount = calculatePercentageAmount(taxableAmount, gstPercent);
    // Client TDS may be a flat applied amount (client-billing screen) rather
    // than a percentage. When `clientTdsAmount` is provided it is used directly;
    // otherwise TDS is computed from `tdsPercent`. Vendor TDS (below) always
    // uses the percentage convention and is unaffected.
    const tdsAmount = input.clientTdsAmount !== undefined
        ? toFiniteNumber(input.clientTdsAmount, 0)
        : calculatePercentageAmount(taxableAmount, tdsPercent);
    const totalClientBilledAmount = taxableAmount + gstAmount - tdsAmount;
    const clientBilledWithoutGst = totalClientBilledAmount - gstAmount;

    const vendorSummaries = input.vendorSummaries ?? [];

    const totalVendorGst = vendorSummaries.reduce(
        (sum, vendor) =>
            sum +
            calculatePercentageAmount(
                toFiniteNumber(vendor?.totalAmount, 0),
                toFiniteNumber(vendor?.gst, 0),
            ),
        0,
    );

    const totalVendorTds = vendorSummaries.reduce(
        (sum, vendor) =>
            sum +
            calculatePercentageAmount(
                toFiniteNumber(vendor?.totalAmount, 0),
                toFiniteNumber(vendor?.tds, 0),
            ),
        0,
    );

    const totalVendorNet = vendorSummaries.reduce((sum, vendor) => {
        const base = toFiniteNumber(vendor?.totalAmount, 0);
        const vendorGst = calculatePercentageAmount(base, toFiniteNumber(vendor?.gst, 0));
        const vendorTds = calculatePercentageAmount(base, toFiniteNumber(vendor?.tds, 0));
        return sum + base + vendorGst - vendorTds;
    }, 0);

    return {
        estimatedAmount,
        serviceChargeAmount,
        serviceChargePercent,
        discountAmount,
        taxableAmount,
        gstAmount,
        gstPercent,
        tdsAmount,
        tdsPercent,
        totalClientBilledAmount,
        clientBilledWithoutGst,
        totalVendorGst,
        totalVendorTds,
        totalVendorNet,
        profit: clientBilledWithoutGst + totalVendorGst - (totalVendorTds + totalVendorNet),
        netHand: clientBilledWithoutGst - (totalVendorTds + totalVendorNet),
    };
}

/* ------------------------------------------------------------------ */
/*  Client bill summary (vendor costs vs client billing) */
/* ------------------------------------------------------------------ */

export interface ClientBillSummaryInput {
    /** Approved estimate amount before tax (vendor cost base for the PO). */
    totalEstimatedCost: number;
    /** Client GST percentage (eventData.gst). */
    gstPercent: number;
    /** Client service charge percentage (eventData.serviceCharge). */
    serviceChargePercent: number;
    /** Client discount flat amount (eventData.discounts). */
    discountAmount: number;
    /** Flat TDS amount deducted by the client (eventData.tds). */
    clientTdsAmount: number;
    /** Advance already received from the client (eventData.advanceAmt). */
    advanceAmount: number;
    /** Amount already received from the client (PO Client Billing input / eventData.receivedAmount). */
    receivedAmount: number;
    /** Vendor-side rollup (kept for the shared P&L computation only). */
    vendorSummaries: readonly EventVendorFinancial[] | null | undefined;
}

export interface PurchaseOrderClientBillSummary {
    /** Approved estimate amount before tax (vendor cost base for the PO). */
    estimatedAmount: number;
    /** Service charge amount (base * serviceChargePercent / 100). */
    serviceChargeAmount: number;
    /** Discount flat amount. */
    discountAmount: number;
    /** Sum of vendor totalAmount (vendor cost before GST). */
    originalAmount: number;
    /** Sum of vendor GST amounts (totalAmount * gst% / 100). */
    gstAmount: number;
    /** Original Amount + GST Amount. */
    total: number;
    /** Client billed amount without GST + client GST (= total billed to client). */
    amountReceivedFromClient: number;
    /** Flat TDS amount deducted by the client. */
    tdsDeducted: number;
    /** Amount Received from Client - Client GST. */
    finalAmount: number;
    /** Advance received from the client. */
    advance: number;
    /** Final Amount - Advance. */
    balance: number;
}

/**
 * Client Bill Summary for the Purchase Order Preview.
 *
 * All client-bill figures come from the Client Estimate and the PO Client
 * Billing input (never from Vendor Summary). Reuses
 * `calculateEventProfitAndLoss` for the client-side GST/TDS so the values are
 * identical to the Profit Summary.
 *
 * INPUTS
 *   totalEstimatedCost   — approved estimate amount
 *   gstPercent           — client GST % (eventData.gst)
 *   serviceChargePercent — client service charge % (eventData.serviceCharge)
 *   discountAmount       — client discount flat amount (eventData.discounts)
 *   clientTdsAmount      — client TDS flat applied amount (eventData.tds)
 *   advanceAmount        — client advance received (eventData.advanceAmt)
 *   receivedAmount       — amount received from client (PO billing input)
 *   vendorSummaries      — vendor-side rollup (shared P&L computation only)
 *
 * HELPER
 *   calculatePercentageAmount(amount, pct) = amount × pct / 100
 *   toFiniteNumber(v, fb)                  — coerces NaN/Inf/null to fb (default 0)
 *
 * CALCULATION STEPS (all from client estimate / PO billing input)
 *   1 estimatedAmount    = totalEstimatedCost
 *   2 serviceChargeAmt   = estimatedAmount × serviceChargePercent / 100
 *   3 discountAmount     = discountAmount (flat)
 *   4 originalAmount     = estimatedAmount + serviceChargeAmt - discountAmount
 *   5 gstAmount          = originalAmount × gstPercent / 100
 *   6 total              = originalAmount + gstAmount
 *   7 amountReceivedFromClient = receivedAmount (from PO billing input)
 *   8 tdsDeducted        = clientTdsAmount (flat TDS applied by client)
 *   9 finalAmount        = amountReceivedFromClient - gstAmount
 *  10 advance            = advanceAmount
 *  11 balance            = total - amountReceived - advance - tdsDeducted
 *
 * NOTE: Vendor Summary is passed only for the shared P&L computation inside
 * `calculateEventProfitAndLoss`; it does NOT alter client bill figures.
 */
export function calculateClientBillSummary(
    input: ClientBillSummaryInput,
): PurchaseOrderClientBillSummary {
    const pnl = calculateEventProfitAndLoss({
        totalEstimatedCost: input.totalEstimatedCost,
        gstPercent: input.gstPercent,
        tdsPercent: 0,
        clientTdsAmount: input.clientTdsAmount,
        serviceChargePercent: input.serviceChargePercent,
        discountAmount: input.discountAmount,
        vendorSummaries: input.vendorSummaries,
    });

    const serviceChargeAmount = pnl.serviceChargeAmount;
    const discountAmount = pnl.discountAmount;
    const estimatedAmount = pnl.estimatedAmount;
    const originalAmount = estimatedAmount + serviceChargeAmount - discountAmount;
    const gstAmount = pnl.gstAmount;

    // Amount Received from Client comes straight from the PO Client Billing
    // input; it is never derived from the estimate or vendor summary.
    const amountReceivedFromClient = toFiniteNumber(input.receivedAmount, 0);
    const tdsDeducted = pnl.tdsAmount;
    const finalAmount = amountReceivedFromClient - gstAmount;
    const advance = toFiniteNumber(input.advanceAmount, 0);

    const total = originalAmount + gstAmount;

    return {
        estimatedAmount,
        serviceChargeAmount,
        discountAmount,
        originalAmount,
        gstAmount,
        total,
        amountReceivedFromClient,
        tdsDeducted,
        finalAmount,
        advance,
        balance: total - amountReceivedFromClient - advance - tdsDeducted,
    };
}
