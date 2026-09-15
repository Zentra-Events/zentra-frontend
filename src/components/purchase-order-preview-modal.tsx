import { useMemo, type ReactNode } from "react";
import Image from "next/image";
import type {
    CategoryPurchaseRow,
    EventResponse,
    PurchaseItemRow,
    PurchaseOrderPreviewModalProps,
    VendorFinancialRow,
} from "@/types/event";
import { Modal, ModalBody, ModalFooter } from "./ui";
import { Button } from "./ui/button";
import { formatExportCurrency, numberToWords, toRomanLower } from "@/lib/utils";
import { purchaseOrderPreviewStyles } from "@/constants/event";
import { ProfitSummary } from "./profit-summary";
import { Access } from "./access";

/* ------------------------------------------------------------------ */
/*  GST Type metadata                                                */
/* ------------------------------------------------------------------ */

/** Human-readable label for each GST tax type. */
export const GST_TYPE_LABEL: Record<string, string> = {
    NONE: "No GST",
    CGST_SGST: "CGST + SGST",
    IGST: "IGST",
};

/**
 * Render a GST percentage with its tax type (when one is applied).
 * - No GST type (or NONE): show the percentage value as-is.
 * - Applied type (e.g. CGST_SGST / IGST): show the percentage with the
 *   type displayed in brackets, e.g. `18% (CGST + SGST)`.
 */
function formatGstWithType(gstPercent: number, gstType?: string): string {
    const gstValue = gstPercent > 0 ? `${gstPercent}%` : "—";
    const isNoGst = !gstType || gstType === "NONE";
    if (isNoGst || gstValue === "—") return gstValue;
    const typeLabel = GST_TYPE_LABEL[gstType] ?? gstType;
    return `${gstValue} (${typeLabel})`;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getVendorDisplayName(
    vendorId: string | undefined | null,
    vendorList: Array<{ id?: string; name: string }> | undefined,
    inventoryList: Array<{ id?: string; name: string }> | undefined,
): string {
    if (!vendorId) return "SELF";

    // Check if this vendor matches an inventory (self) item
    const isSelf = inventoryList?.some(
        inv => inv.id === vendorId || inv.name?.toLowerCase() === vendorId.toLowerCase(),
    );
    if (isSelf) return "SELF";

    // Look up vendor name
    const vendor = vendorList?.find(v => v.id === vendorId);
    return vendor?.name || vendorId;
}

/** Raw item type that may carry category info from the API */
interface RawItemWithCategory {
    item?: string;
    description?: string;
    quantity?: number;
    pricePerItem?: number;
    vendor?: string;
    days?: number;
    serialNumber?: number;
    category?: string;
    subCategory?: string;
    unit?: string;
}

export function groupItemsByCategory(
    items: EventResponse["items"],
    vendorList: Array<{ id?: string; name: string }> | undefined,
    inventoryList: Array<{ id?: string; name: string }> | undefined,
    vendorSummary: EventResponse["vendorSummary"],
): CategoryPurchaseRow[] {
    const rawItems = (items ?? []) as RawItemWithCategory[];
    if (rawItems.length === 0) return [];

    // Build a vendor-to-financials lookup from vendorSummary
    const vendorFinancials = new Map<
        string,
        {
            gst: number;
            tds: number;
            totalAmount: number;
            advanceAmount: number;
            adjustedAmt: number;
            balance: number;
        }
    >();

    if (vendorSummary && vendorSummary.length > 0) {
        vendorSummary.forEach(vs => {
            // Use "SELF" as the key for inventory items (vendor is empty or "SELF")
            const vendorId = !vs.vendor || vs.vendor === "SELF" ? "SELF" : vs.vendor;
            vendorFinancials.set(vendorId, {
                gst: vs.gst ?? 0,
                tds: vs.tds ?? 0,
                totalAmount: vs.totalAmount ?? 0,
                advanceAmount: vs.advanceAmount ?? 0,
                adjustedAmt: vs.adjustedAmt ?? 0,
                balance: vs.balance ?? 0,
            });
        });
    }

    // Gather all items with their vendor details and per-item GST/TDS/netTotal
    // For each item, look up its vendor in vendorSummary to get GST% and TDS%
    const allItems: PurchaseItemRow[] = rawItems.map((item, idx) => {
        const amount = (item.quantity ?? 1) * (item.pricePerItem ?? 0) * (item.days ?? 1);
        // Use "SELF" lookup key for items with no vendor (inventory items)
        const lookupKey = !item.vendor ? "SELF" : item.vendor;
        const fin = vendorFinancials.get(lookupKey);
        const gstPct = fin?.gst ?? 0;
        const tdsPct = fin?.tds ?? 0;
        const gstAmount = amount * (gstPct / 100);
        const tdsAmount = amount * (tdsPct / 100);
        const netTotal = amount + gstAmount - tdsAmount;

        return {
            serial: idx + 1,
            itemName: item.item || "—",
            description: item.description || "",
            qty: item.quantity ?? 1,
            unit: item.unit && item.unit.trim() ? item.unit.trim() : "nos",
            rate: item.pricePerItem ?? 0,
            days: item.days ?? 1,
            amount,
            gstAmount,
            tdsAmount,
            netTotal,
            vendorName: getVendorDisplayName(item.vendor, vendorList, inventoryList),
            vendorId: item.vendor,
        };
    });

    // Group by category, then by sub-category within each category
    const grouped = new Map<string, { item: PurchaseItemRow; sub: string }[]>();
    rawItems.forEach((item, idx) => {
        const category = item.category || "Uncategorized";
        if (!grouped.has(category)) {
            grouped.set(category, []);
        }
        grouped.get(category)!.push({
            item: allItems[idx],
            sub: item.subCategory?.trim() || "",
        });
    });

    return Array.from(grouped.entries()).map(([category, catEntries]) => {
        const catItems = catEntries.map(entry => entry.item);
        const subtotal = catItems.reduce((sum, item) => sum + item.amount, 0);

        // Partition into direct items (no sub-category) and sub-category groups.
        const directItems: PurchaseItemRow[] = [];
        const subMap = new Map<string, PurchaseItemRow[]>();
        const subOrder: string[] = [];
        catEntries.forEach(({ item, sub }) => {
            if (sub) {
                if (!subMap.has(sub)) {
                    subMap.set(sub, []);
                    subOrder.push(sub);
                }
                subMap.get(sub)!.push(item);
            } else {
                directItems.push(item);
            }
        });

        return {
            category,
            items: catItems,
            directItems,
            subCategories: subOrder.map(name => ({ name, items: subMap.get(name)! })),
            subtotal,
        };
    });
}

/**
 * Build vendor-wise financial rows from vendorSummary data
 */
export function buildVendorFinancials(
    vendorSummary: EventResponse["vendorSummary"],
    vendorList: Array<{ id?: string; name: string }> | undefined,
): VendorFinancialRow[] {
    if (!vendorSummary || vendorSummary.length === 0) return [];

    return vendorSummary.map(vs => {
        const vendorName = vendorList?.find(v => v.id === vs.vendor)?.name || vs.vendor || "SELF";
        return {
            vendorName,
            totalAmount: vs.totalAmount ?? 0,
            gstPercent: vs.gst ?? 0,
            gstType: vs.gstType ?? "NONE",
            tdsPercent: vs.tds ?? 0,
            adjustedAmt: vs.adjustedAmt ?? 0,
            advanceAmount: vs.advanceAmount ?? 0,
            balance: vs.balance ?? 0,
        };
    });
}

/* ------------------------------------------------------------------ */
/*  Meta Header Section                                                */
/* ------------------------------------------------------------------ */

function MetaHeader({ eventData, eventName }: { eventData: EventResponse; eventName?: string }) {
    const title = eventData.title || eventName || "Purchase Order Details";
    const clientName = eventData.client || "—";
    const eventDates =
        eventData.eventStartDate && eventData.eventEndDate
            ? `${new Date(eventData.eventStartDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
              })} – ${new Date(eventData.eventEndDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
              })}`
            : "—";
    const venue = eventData.venue || eventData.location || "—";

    return (
        <div className="mb-4">
            <div
                className={`${purchaseOrderPreviewStyles.titleBg} py-3 text-center font-bold text-base rounded-t`}
            >
                Purchase Order — {title}
            </div>
            <div className="flex gap-6 pt-2 items-stretch">
                <div className="flex-1 space-y-1 min-w-0">
                    <div className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-2">
                        <span className="font-semibold shrink-0">Client :</span>
                        <span>{clientName}</span>
                    </div>
                    <div className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-2">
                        <span className="font-semibold shrink-0">Event Date :</span>
                        <span>{eventDates}</span>
                    </div>
                    <div className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-2">
                        <span className="font-semibold shrink-0">Venue :</span>
                        <span>{venue}</span>
                    </div>
                    <div className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-2">
                        <span className="font-semibold shrink-0">Event ID :</span>
                        <span>{eventData.eventID || eventData.id || "—"}</span>
                    </div>
                    {eventData.billingAddress && (
                        <div className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-2">
                            <span className="font-semibold shrink-0">Billing Address :</span>
                            <span>{eventData.billingAddress}</span>
                        </div>
                    )}
                    {eventData.pan && (
                        <div className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-2">
                            <span className="font-semibold shrink-0">PAN :</span>
                            <span>{eventData.pan}</span>
                        </div>
                    )}
                </div>
                <div className="w-[120px] shrink-0 flex items-center justify-center">
                    <Image
                        src="/logo.svg"
                        alt="Company logo"
                        width={100}
                        height={48}
                        className="object-contain max-h-20 w-auto"
                    />
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Payment Terms Section                                             */
/* ------------------------------------------------------------------ */

function PaymentTermsSection() {
    return (
        <div className="mb-6 p-3 border border-black/20 rounded bg-gray-50 text-xs">
            <div className="font-bold text-sm mb-2 uppercase text-muted-foreground tracking-wider">
                Terms & Conditions
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                <div className="grid grid-cols-[minmax(100px,auto)_1fr] gap-x-2">
                    <span className="font-semibold">Payment Terms :</span>
                    <span>As per contract / 30 days from invoice</span>
                </div>
                <div className="grid grid-cols-[minmax(100px,auto)_1fr] gap-x-2">
                    <span className="font-semibold">Delivery :</span>
                    <span>As per event schedule</span>
                </div>
                <div className="grid grid-cols-[minmax(100px,auto)_1fr] gap-x-2">
                    <span className="font-semibold">GST :</span>
                    <span>Extra as applicable</span>
                </div>
                <div className="grid grid-cols-[minmax(100px,auto)_1fr] gap-x-2">
                    <span className="font-semibold">TDS :</span>
                    <span>As per income tax act</span>
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  CGST / SGST Split Helper                                          */
/* ------------------------------------------------------------------ */

interface GstSplit {
    cgstPercent: number;
    sgstPercent: number;
    cgstAmount: number;
    sgstAmount: number;
}

function splitGst(gstPercent: number, amount: number): GstSplit {
    const halfPercent = gstPercent / 2;
    const gstAmount = amount * (gstPercent / 100);
    return {
        cgstPercent: halfPercent,
        sgstPercent: halfPercent,
        cgstAmount: gstAmount / 2,
        sgstAmount: gstAmount / 2,
    };
}

/* ------------------------------------------------------------------ */
/*  Category Table                                                     */
/* ------------------------------------------------------------------ */

function CategoryTable({
    categoryData,
    index,
}: {
    categoryData: CategoryPurchaseRow;
    index: number;
}) {
    const { category, items, subtotal, directItems, subCategories } = categoryData;

    const netSubTotal = items.reduce((sum, item) => sum + item.netTotal, 0);

    const renderItemRow = (item: PurchaseItemRow, key: string, serial: number) => (
        <tr key={key}>
            <td className="border border-black px-2 py-1.5 text-center align-top">{serial}</td>
            <td className="border border-black px-2 py-1.5 align-top font-medium">
                {item.itemName}
            </td>
            <td className="border border-black px-2 py-1.5 align-top whitespace-pre-wrap text-muted-foreground">
                {item.description || "—"}
            </td>
            <td className="border border-black px-2 py-1.5 text-right align-top">{item.days}</td>
            <td className="border border-black px-2 py-1.5 text-right align-top">{item.qty}</td>
            <td className="border border-black px-2 py-1.5 text-center align-top">
                {item.unit || "nos"}
            </td>
            <td className="border border-black px-2 py-1.5 text-right align-top">
                {formatExportCurrency(item.rate)}
            </td>
            <td className="border border-black px-2 py-1.5 text-right align-top font-medium">
                {formatExportCurrency(item.amount)}
            </td>
            <td className="border border-black px-2 py-1.5 text-right align-top text-green-700">
                {item.gstAmount > 0 ? "+" + formatExportCurrency(item.gstAmount) : "—"}
            </td>
            <td className="border border-black px-2 py-1.5 text-right align-top text-destructive">
                {item.tdsAmount > 0 ? "-" + formatExportCurrency(item.tdsAmount) : "—"}
            </td>
            <td className="border border-black px-2 py-1.5 text-right align-top font-bold">
                {formatExportCurrency(item.netTotal)}
            </td>
            <td className="border border-black px-2 py-1.5 align-top">
                <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                        item.vendorName === "SELF"
                            ? purchaseOrderPreviewStyles.selfBadge
                            : purchaseOrderPreviewStyles.vendorBadge
                    }`}
                >
                    {item.vendorName}
                </span>
            </td>
        </tr>
    );

    // Running serial across direct items and each sub-category group.
    let serialCounter = 1;
    const itemRows: ReactNode[] = [];
    directItems.forEach((item, idx) => {
        itemRows.push(renderItemRow(item, `item-${idx}`, serialCounter));
        serialCounter += 1;
    });
    subCategories.forEach(sub => {
        itemRows.push(
            <tr key={`sub-${sub.name}`} className={purchaseOrderPreviewStyles.subCategoryBg}>
                <td colSpan={12} className="border border-black px-2 py-2 font-semibold text-left">
                    Sub Category: {sub.name}
                </td>
            </tr>,
        );
        sub.items.forEach((item, idx) => {
            itemRows.push(renderItemRow(item, `sub-${sub.name}-${idx}`, serialCounter));
            serialCounter += 1;
        });
    });

    return (
        <div className="mb-6">
            {/* Category Header */}
            <div
                className={`flex items-center justify-between px-3 py-2 ${purchaseOrderPreviewStyles.categoryBg} border border-black`}
            >
                <span className="font-bold text-sm uppercase tracking-wider">
                    {toRomanLower(index + 1)}. {category}
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                    {items.length} item{items.length !== 1 ? "s" : ""}
                </span>
            </div>

            {/* Items Table */}
            <table className="w-full border-collapse text-xs border border-black">
                <thead>
                    <tr className={purchaseOrderPreviewStyles.headerBg}>
                        <th className="border border-black px-2 py-2 text-center font-bold w-10">
                            Sl. No
                        </th>
                        <th className="border border-black px-2 py-2 text-center font-bold">
                            Item
                        </th>
                        <th className="border border-black px-2 py-2 text-center font-bold">
                            Description
                        </th>
                        <th className="border border-black px-2 py-2 text-center font-bold w-12">
                            Days
                        </th>
                        <th className="border border-black px-2 py-2 text-center font-bold w-12">
                            Qty
                        </th>
                        <th className="border border-black px-2 py-2 text-center font-bold w-16">
                            Unit
                        </th>
                        <th className="border border-black px-2 py-2 text-center font-bold w-20">
                            Rate
                        </th>
                        <th className="border border-black px-2 py-2 text-center font-bold w-20">
                            Total Amount
                        </th>
                        <th className="border border-black px-2 py-2 text-center font-bold w-16">
                            GST(%)
                        </th>
                        <th className="border border-black px-2 py-2 text-center font-bold w-14">
                            TDS(%)
                        </th>
                        <th className="border border-black px-2 py-2 text-center font-bold w-20">
                            Net Total
                        </th>
                        <th className="border border-black px-2 py-2 text-center font-bold">
                            Vendor
                        </th>
                    </tr>
                </thead>
                <tbody>{itemRows}</tbody>
            </table>

            {/* Category Financial Summary - only Subtotal and Net SubTotal */}
            <table className="w-full border-collapse text-xs border border-black mt-0">
                <tbody>
                    <tr className={purchaseOrderPreviewStyles.subTotalBg}>
                        <td className="border border-black px-2 py-1.5 font-semibold" colSpan={9}>
                            Category Subtotal
                        </td>
                        <td
                            className="border border-black px-2 py-1.5 text-right font-semibold"
                            colSpan={3}
                        >
                            {formatExportCurrency(subtotal)}
                        </td>
                    </tr>
                    <tr className={purchaseOrderPreviewStyles.totalBg}>
                        <td className="border border-black px-2 py-1.5 font-bold" colSpan={9}>
                            Net SubTotal
                        </td>
                        <td
                            className="border border-black px-2 py-1.5 text-right font-bold"
                            colSpan={3}
                        >
                            {formatExportCurrency(netSubTotal)}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Vendor-Wise Financial Summary                                     */
/* ------------------------------------------------------------------ */

export function VendorFinancialSummary({ vendorRows }: { vendorRows: VendorFinancialRow[] }) {
    if (vendorRows.length === 0) return null;

    const grandTotalAmount = vendorRows.reduce((sum, v) => sum + v.totalAmount, 0);
    const grandNetTotal = vendorRows.reduce((sum, v) => sum + v.adjustedAmt, 0);
    const grandAdvance = vendorRows.reduce((sum, v) => sum + v.advanceAmount, 0);
    const grandBalance = vendorRows.reduce((sum, v) => sum + v.balance, 0);

    return (
        <div className="mb-6">
            <div className="font-bold text-sm mb-2 uppercase text-muted-foreground tracking-wider">
                Vendor-Wise Financial Summary
            </div>
            <table className="w-full border-collapse text-xs border border-black">
                <thead>
                    <tr className={purchaseOrderPreviewStyles.vendorFinBg}>
                        <th className="border border-black px-2 py-2 text-center font-bold">
                            Vendor
                        </th>
                        <th className="border border-black px-2 py-2 text-center font-bold">
                            Total Amount
                        </th>
                        <th className="border border-black px-2 py-2 text-center font-bold">
                            GST (%)
                        </th>
                        <th className="border border-black px-2 py-2 text-center font-bold">
                            TDS (%)
                        </th>
                        <th className="border border-black px-2 py-2 text-center font-bold">
                            Net Total
                        </th>
                        <th className="border border-black px-2 py-2 text-center font-bold">
                            Advance Paid
                        </th>
                        <th className="border border-black px-2 py-2 text-center font-bold">
                            Balance
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {vendorRows.map((v, idx) => (
                        <tr key={`vendor-fin-${idx}`}>
                            <td className="border border-black px-2 py-1.5 font-medium">
                                {v.vendorName}
                            </td>
                            <td className="border border-black px-2 py-1.5 text-right">
                                {formatExportCurrency(v.totalAmount)}
                            </td>
                            <td className="border border-black px-2 py-1.5 text-center">
                                {formatGstWithType(v.gstPercent, v.gstType)}
                            </td>
                            <td className="border border-black px-2 py-1.5 text-center">
                                {v.tdsPercent > 0 ? `${v.tdsPercent}%` : "—"}
                            </td>
                            <td className="border border-black px-2 py-1.5 text-right">
                                {v.adjustedAmt !== 0 ? formatExportCurrency(v.adjustedAmt) : "—"}
                            </td>
                            <td className="border border-black px-2 py-1.5 text-right text-destructive font-medium">
                                {v.advanceAmount > 0 ? formatExportCurrency(v.advanceAmount) : "—"}
                            </td>
                            <td className="border border-black px-2 py-1.5 text-right font-bold text-green-800">
                                {formatExportCurrency(v.balance)}
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className={purchaseOrderPreviewStyles.totalBg}>
                        <td className="border border-black px-2 py-1.5 font-bold">GRAND TOTAL</td>
                        <td className="border border-black px-2 py-1.5 text-right font-bold">
                            {formatExportCurrency(grandTotalAmount)}
                        </td>
                        <td className="border border-black px-2 py-1.5" />
                        <td className="border border-black px-2 py-1.5" />
                        <td className="border border-black px-2 py-1.5 text-right font-bold">
                            {formatExportCurrency(grandNetTotal)}
                        </td>
                        <td className="border border-black px-2 py-1.5 text-right font-bold text-destructive">
                            {formatExportCurrency(grandAdvance)}
                        </td>
                        <td className="border border-black px-2 py-1.5 text-right font-bold text-green-800">
                            {formatExportCurrency(grandBalance)}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Grand Summary                                                      */
/* ------------------------------------------------------------------ */

function GrandSummary({
    categories,
    vendorRows,
}: {
    categories: CategoryPurchaseRow[];
    vendorRows: VendorFinancialRow[];
}) {
    const grandSubtotal = categories.reduce((sum, cat) => sum + cat.subtotal, 0);

    // Compute GST and TDS from per-item amounts
    const grandGst = categories.reduce(
        (sum, cat) => sum + cat.items.reduce((s, item) => s + item.gstAmount, 0),
        0,
    );
    const grandTds = categories.reduce(
        (sum, cat) => sum + cat.items.reduce((s, item) => s + item.tdsAmount, 0),
        0,
    );
    const grandAdvance = vendorRows.reduce((sum, v) => sum + v.advanceAmount, 0);
    const grandTotal = vendorRows.reduce((sum, v) => sum + v.adjustedAmt, 0);
    const grandOutstanding = grandTotal - grandAdvance;

    // CGST/SGST split - compute effective GST% from item totals
    const effectiveGstPercent =
        grandSubtotal > 0
            ? (categories.reduce(
                  (sum, cat) => sum + cat.items.reduce((s, item) => s + item.gstAmount, 0),
                  0,
              ) /
                  grandSubtotal) *
              100
            : 0;

    const grandGstSplit = grandGst > 0 ? splitGst(effectiveGstPercent, grandSubtotal) : null;

    return (
        <div>
            {/* Consolidated Summary Table */}
            <table className="w-full border-collapse text-xs border border-black">
                <tbody>
                    <tr className={purchaseOrderPreviewStyles.subTotalBg}>
                        <td className="border border-black px-3 py-2 font-bold text-sm" colSpan={5}>
                            GRAND TOTAL (Subtotal)
                        </td>
                        <td
                            className="border border-black px-3 py-2 text-right font-bold text-sm"
                            colSpan={3}
                        >
                            {formatExportCurrency(grandSubtotal)}
                        </td>
                    </tr>
                    {grandGstSplit && grandGst > 0 && (
                        <>
                            <tr className="text-green-700">
                                <td
                                    className="border border-black px-3 py-1.5 text-muted-foreground"
                                    colSpan={5}
                                >
                                    CGST @ {grandGstSplit.cgstPercent.toFixed(2)}%
                                </td>
                                <td
                                    className="border border-black px-3 py-1.5 text-right text-success font-medium"
                                    colSpan={3}
                                >
                                    +{formatExportCurrency(grandGstSplit.cgstAmount)}
                                </td>
                            </tr>
                            <tr className="text-green-700">
                                <td
                                    className="border border-black px-3 py-1.5 text-muted-foreground"
                                    colSpan={5}
                                >
                                    SGST @ {grandGstSplit.sgstPercent.toFixed(2)}%
                                </td>
                                <td
                                    className="border border-black px-3 py-1.5 text-right text-success font-medium"
                                    colSpan={3}
                                >
                                    +{formatExportCurrency(grandGstSplit.sgstAmount)}
                                </td>
                            </tr>
                        </>
                    )}
                    {!grandGstSplit && grandGst > 0 && (
                        <tr>
                            <td
                                className="border border-black px-3 py-1.5 text-muted-foreground"
                                colSpan={5}
                            >
                                Total GST
                            </td>
                            <td
                                className="border border-black px-3 py-1.5 text-right text-success font-medium"
                                colSpan={3}
                            >
                                +{formatExportCurrency(grandGst)}
                            </td>
                        </tr>
                    )}
                    {grandTds > 0 && (
                        <tr>
                            <td
                                className="border border-black px-3 py-1.5 text-muted-foreground"
                                colSpan={5}
                            >
                                Total TDS
                            </td>
                            <td
                                className="border border-black px-3 py-1.5 text-right text-destructive font-medium"
                                colSpan={3}
                            >
                                -{formatExportCurrency(grandTds)}
                            </td>
                        </tr>
                    )}
                    <tr className={purchaseOrderPreviewStyles.totalBg}>
                        <td className="border border-black px-3 py-2 font-bold" colSpan={5}>
                            GRAND TOTAL (After Tax)
                        </td>
                        <td
                            className="border border-black px-3 py-2 text-right font-bold"
                            colSpan={3}
                        >
                            {formatExportCurrency(grandTotal)}
                        </td>
                    </tr>
                    {grandAdvance > 0 && (
                        <tr className={purchaseOrderPreviewStyles.advanceBg}>
                            <td
                                className="border border-black px-3 py-1.5 font-semibold text-destructive"
                                colSpan={5}
                            >
                                Total Advance Paid
                            </td>
                            <td
                                className="border border-black px-3 py-1.5 text-right font-semibold text-destructive"
                                colSpan={3}
                            >
                                -{formatExportCurrency(grandAdvance)}
                            </td>
                        </tr>
                    )}
                    <tr className={purchaseOrderPreviewStyles.balanceBg}>
                        <td
                            className="border border-black px-3 py-2 font-bold text-sm text-green-800"
                            colSpan={5}
                        >
                            GRAND OUTSTANDING BALANCE
                        </td>
                        <td
                            className="border border-black px-3 py-2 text-right font-bold text-sm text-green-800"
                            colSpan={3}
                        >
                            {formatExportCurrency(grandOutstanding)}
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Amount in Words */}
            {grandOutstanding > 0 && (
                <div className="mt-3 p-3 border border-black/20 rounded bg-gray-50 text-xs">
                    <div className="grid grid-cols-[minmax(100px,auto)_1fr] gap-x-2">
                        <span className="font-semibold shrink-0">Amount in Words :</span>
                        <span className="italic">{numberToWords(grandOutstanding)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Main Content                                                      */
/* ------------------------------------------------------------------ */

function PurchaseOrderPreviewContent({
    eventData,
    eventName,
    vendorList,
    inventoryList,
    totalEstimatedCost,
}: {
    eventData: EventResponse;
    eventName?: string;
    vendorList?: Array<{ id?: string; name: string }>;
    inventoryList?: Array<{ id?: string; name: string }>;
    totalEstimatedCost: number;
}) {
    const categories = useMemo(
        () =>
            groupItemsByCategory(
                eventData.items,
                vendorList,
                inventoryList,
                eventData.vendorSummary,
            ),
        [eventData.items, eventData.vendorSummary, vendorList, inventoryList],
    );

    const vendorFinancialRows = useMemo(
        () => buildVendorFinancials(eventData.vendorSummary, vendorList),
        [eventData.vendorSummary, vendorList],
    );

    if (categories.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground text-sm">
                No purchase order items available for this event.
            </div>
        );
    }

    return (
        <div className="space-y-3 font-sans text-sm text-gray-900">
            <MetaHeader eventData={eventData} eventName={eventName} />

            {/* Payment Terms */}
            <PaymentTermsSection />

            {/* Category-wise Item Breakdown */}
            {categories.map((cat, idx) => (
                <CategoryTable key={cat.category} categoryData={cat} index={idx} />
            ))}

            {/* Vendor-Wise Financial Summary */}
            {vendorFinancialRows.length > 0 && (
                <VendorFinancialSummary vendorRows={vendorFinancialRows} />
            )}

            {/* Grand Summary */}
            <div className="mt-6">
                <div className="font-bold text-sm mb-2 uppercase text-muted-foreground tracking-wider">
                    Consolidated Summary
                </div>
                <GrandSummary categories={categories} vendorRows={vendorFinancialRows} />
            </div>

            {/* Profit Summary – internal (event management team) */}
            <Access roles={["admin"]}>
                <div className="mt-6">
                    <div className="font-bold text-sm mb-2 uppercase text-muted-foreground tracking-wider">
                        Profit Summary
                    </div>
                    <ProfitSummary eventData={eventData} totalEstimatedCost={totalEstimatedCost} />
                </div>
            </Access>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Modal Component                                                    */
/* ------------------------------------------------------------------ */

export function PurchaseOrderPreviewModal({
    eventData,
    eventName,
    vendorList,
    inventoryList,
    totalEstimatedCost,
    onClose,
}: PurchaseOrderPreviewModalProps) {
    return (
        <Modal
            open
            onClose={onClose}
            size="xxl"
            title="Purchase Order Preview"
            description={`${eventData.title || eventName || "Event"} — Detailed breakdown`}
            showCloseIcon
            className="max-w-6xl"
        >
            <ModalBody className="bg-white">
                <div className="overflow-x-auto rounded border border-gray-200 p-4 bg-white">
                    <PurchaseOrderPreviewContent
                        eventData={eventData}
                        eventName={eventName}
                        vendorList={vendorList}
                        inventoryList={inventoryList}
                        totalEstimatedCost={totalEstimatedCost}
                    />
                </div>
            </ModalBody>
            <ModalFooter>
                <Button variant="outline" onClick={onClose}>
                    Close
                </Button>
            </ModalFooter>
        </Modal>
    );
}
