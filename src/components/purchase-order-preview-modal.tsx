"use client";

/* ==================================================================- */
/*  PURCHASE ORDER PREVIEW MODAL                                       */
/*                                                                     */
/*  Displays the purchase order preview with several financial tables. */
/*  All monetary values are rendered via formatExportCurrency.         */
/*                                                                     */
/*  TABLES (in render order):                                          */
/*   1 Meta Header             — event/client/venue/ID/PAN info        */
/*   2 Payment Terms           — static terms & conditions             */
/*   3 Category-wise Items     — item breakdown grouped by category    */
/*   4 Vendor-Wise Financial   — per-vendor GST/TDS/net/advance/balance */
/*   5 Grand Summary           — consolidated vendor totals + balance  */
/*   6 Client Bill Summary     — client estimate → final balance       */
/*   7 Profit Summary          — internal P&L (admin/super_admin only) */
/*                                                                     */
/*  SHARED CALCULATION HELPERS                                         */
/*   groupItemsByCategory()        — per-item amount/GST/TDS/netTotal   */
/*   buildVendorFinancials()       — per-vendor financial rows          */
/*   calculateEventProfitAndLoss() — client + vendor P&L (in billing)   */
/*   calculateClientBillSummary()  — client bill figures (in billing)   */
/*   calculatePercentageAmount(a,p) = a × p / 100                      */
/*   toFiniteNumber(v, fb)         — coerces NaN/Inf/null to fb (0)     */
/*                                                                     */
/*  SEE ALSO: docs/purchase-order-preview-calculations.md              */
/* ==================================================================- */

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { FileSpreadsheet, FileText } from "lucide-react";
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
import { formatShortDate } from "@/lib/utils/date";
import { calculateClientBillSummary, toFiniteNumber } from "@/lib/utils/billing";
import { purchaseOrderPreviewStyles } from "@/constants/event";
import { ProfitSummary } from "./profit-summary";
import { Access } from "./access";
import { toast } from "sonner";
import { useAuth } from "@/context/auth";
import { hasPermission } from "@/lib/utils/permissions";
import { fetchExpenseTotal } from "@/lib/api/expense";
import { downloadPurchaseOrderExcel } from "@/lib/purchase-export/purchase-excel";
import { downloadPurchaseOrderPdf } from "@/lib/purchase-export/purchase-pdf";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getVendorDisplayName(
    item: RawItemWithCategory,
    vendorList: Array<{ id?: string; name: string }> | undefined,
    inventoryList: Array<{ id?: string; name: string }> | undefined,
): string {
    // Inventory items are explicitly marked via inventoryID. They are never
    // treated as plain vendorless items.
    if (item.inventoryID) return "SELF";

    // Items with no vendor and no inventory marker are vendorless, not inventory.
    if (!item.vendor) return "Unassigned Vendor";

    // A vendor whose id/name matches an inventory entry is treated as SELF.
    const isSelf = inventoryList?.some(
        inv =>
            inv.id === item.vendor ||
            (item.vendor && inv.name?.toLowerCase() === item.vendor.toLowerCase()),
    );
    if (isSelf) return "SELF";

    // Look up vendor name
    const vendor = vendorList?.find(v => v.id === item.vendor);
    return vendor?.name || item.vendor;
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
    /** Present when the item is explicitly sourced from inventory. */
    inventoryID?: string | number;
}

/**
 * Group purchase items by category (then by sub-category) and compute
 * per-item financials.
 *
 * CALCULATION (per raw item):
 *   amount      = (quantity ?? 1) × (pricePerItem ?? 0) × (days ?? 1)
 *   lookupKey   = "SELF" for inventory items (inventoryID set),
 *                 item.vendor otherwise (vendorless items use "",
 *                 which matches no vendor financials → GST/TDS = 0)
 *   gstPct      = vendorFinancials[lookupKey].gst   ?? 0
 *   tdsPct      = vendorFinancials[lookupKey].tds   ?? 0
 *   gstAmount   = amount × gstPct / 100
 *   tdsAmount   = amount × tdsPct / 100
 *   netTotal    = amount + gstAmount - tdsAmount
 *
 * vendorFinancials is built from eventData.vendorSummary keyed by vendor id.
 * Inventory entries (vendor empty or "SELF") are keyed as "SELF".
 *
 * OUTPUT (per category):
 *   category          — category name ("Uncategorized" if missing)
 *   items             — all PurchaseItemRow in the category
 *   directItems       — items with no sub-category
 *   subCategories     — { name, items[] } grouped by subCategory
 *   subtotal          = Σ item.amount   (gross, excludes GST/TDS)
 *
 * Each item row also carries vendorName (via getVendorDisplayName) and
 * vendorId for badge rendering ("SELF" vs vendor).
 */
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
            // Inventory entries (vendor empty or "SELF") are keyed as "SELF".
            // Plain vendorless items (no inventoryID) do not create a "SELF"
            // entry here; they get no vendor financials in groupItemsByCategory.
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
        // Only explicitly-marked inventory items use the "SELF" vendor financials.
        // Plain vendorless items have no vendor financials, so GST/TDS = 0.
        const isInventoryItem = Boolean(item.inventoryID);
        const lookupKey = isInventoryItem ? "SELF" : (item.vendor ?? "");
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
            vendorName: getVendorDisplayName(item, vendorList, inventoryList),
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
 * Build vendor-wise financial rows from vendorSummary data.
 *
 * One row per vendor in eventData.vendorSummary. Values come directly from
 * the API rollup:
 *
 *   vendorName   — vendorList name, or vs.vendor, or "SELF"
 *   totalAmount  = vs.totalAmount ?? 0          (vendor cost before GST)
 *   gstPercent   = vs.gst   ?? 0                (vendor GST %)
 *   gstType      = vs.gstType ?? "NONE"
 *   tdsPercent   = vs.tds   ?? 0                (vendor TDS %)
 *   adjustedAmt  = vs.adjustedAmt ?? 0          (vendor net total)
 *   advanceAmount= vs.advanceAmount ?? 0
 *   balance      = vs.balance ?? 0
 *
 * GST/TDS amounts shown in the table are computed as:
 *   GST  = totalAmount × gstPercent / 100
 *   TDS  = totalAmount × tdsPercent / 100
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
/*  Category Table                                                     */
/* ------------------------------------------------------------------ */

/**
 * Render all category-grouped items in one table, with category and
 * sub-category rows between item rows.
 *
 * COLUMNS (per item row):
 *   Sl. No      — running serial across direct items + sub-category groups
 *   Item        — item.itemName || "—"
 *   Description — item.description || "—"
 *   Days        — item.days
 *   Qty         — item.qty
 *   Unit        — item.unit || "nos"
 *   Rate        — formatExportCurrency(item.rate)  (pricePerItem ?? 0)
 *   Total Amount— formatExportCurrency(item.amount)   (= qty × rate × days)
 *   GST Amount  — "+{gstAmount}" or "—"   (green when > 0)
 *   TDS Amount  — "-{tdsAmount}" or "—"   (red when > 0)
 *   Net Total   — formatExportCurrency(item.netTotal)  (= amount + GST - TDS)
 *   Vendor      — badge ("SELF" vs vendor name)
 *
 * CATEGORY TOTALS:
 *   Category Subtotal   = Σ item.amount          (gross, excludes GST/TDS)
 *   Net SubTotal        = Σ item.netTotal        (= amount + GST - TDS)
 */
function CategoryItemsTable({ categories }: { categories: CategoryPurchaseRow[] }) {
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

    return (
        <table className="w-full border-collapse text-xs border border-black">
            <thead>
                <tr className={purchaseOrderPreviewStyles.headerBg}>
                    <th className="border border-black px-2 py-2 text-center font-bold w-10">
                        Sl. No
                    </th>
                    <th className="border border-black px-2 py-2 text-center font-bold">Item</th>
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
                    <th className="border border-black px-2 py-2 text-center font-bold">Vendor</th>
                </tr>
            </thead>
            <tbody>
                {categories.map((categoryData, categoryIndex) => {
                    const { category, items, subtotal, directItems, subCategories } = categoryData;
                    const netSubTotal = items.reduce((sum, item) => sum + item.netTotal, 0);
                    let serialCounter = 1;
                    const itemRows: ReactNode[] = [];

                    directItems.forEach((item, idx) => {
                        itemRows.push(renderItemRow(item, `item-${idx}`, serialCounter));
                        serialCounter += 1;
                    });
                    subCategories.forEach(sub => {
                        itemRows.push(
                            <tr
                                key={`sub-${categoryIndex}-${sub.name}`}
                                className={purchaseOrderPreviewStyles.subCategoryBg}
                            >
                                <td className="border border-black px-2 py-2" />
                                <td
                                    colSpan={11}
                                    className="border border-black px-2 py-2 font-semibold"
                                >
                                    Sub Category: {sub.name}
                                </td>
                            </tr>,
                        );
                        sub.items.forEach((item, idx) => {
                            itemRows.push(
                                renderItemRow(item, `sub-${sub.name}-${idx}`, serialCounter),
                            );
                            serialCounter += 1;
                        });
                    });

                    return (
                        <Fragment key={category}>
                            <tr className={purchaseOrderPreviewStyles.categoryBg}>
                                <td className="border border-black px-2 py-2 text-center font-medium">
                                    {toRomanLower(categoryIndex + 1)}
                                </td>
                                <td
                                    colSpan={11}
                                    className="border border-black px-2 py-2 font-bold"
                                >
                                    {category}
                                    <span className="float-right text-xs font-semibold">
                                        {items.length} item{items.length !== 1 ? "s" : ""}
                                    </span>
                                </td>
                            </tr>
                            {itemRows}
                            <tr className={purchaseOrderPreviewStyles.subTotalBg}>
                                <td
                                    className="border border-black px-2 py-1.5 font-semibold"
                                    colSpan={9}
                                >
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
                                <td
                                    className="border border-black px-2 py-1.5 font-bold"
                                    colSpan={9}
                                >
                                    Net SubTotal
                                </td>
                                <td
                                    className="border border-black px-2 py-1.5 text-right font-bold"
                                    colSpan={3}
                                >
                                    {formatExportCurrency(netSubTotal)}
                                </td>
                            </tr>
                        </Fragment>
                    );
                })}
            </tbody>
        </table>
    );
}

/* ------------------------------------------------------------------ */
/*  GST / TDS Amount Cell                                             */
/* ------------------------------------------------------------------ */

interface GstTdsCellProps {
    amount: number;
    percent: number;
}

/**
 * Render a vertically stacked GST/TDS cell: the actual calculated amount
 * on the primary line, with the applicable percentage in brackets below.
 * Shows an em-dash when there is no value to display.
 */
function GstTdsCell({ amount, percent }: GstTdsCellProps) {
    const hasValue = amount > 0 && Number.isFinite(amount);
    return (
        <div className="text-right">
            {hasValue ? (
                <>
                    <div className="font-medium">{formatExportCurrency(amount)}</div>
                    <div className="text-[10px] text-muted-foreground">({percent}%)</div>
                </>
            ) : (
                <div className="text-muted-foreground">—</div>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Vendor-Wise Financial Summary                                     */
/* ------------------------------------------------------------------ */

/**
 * Vendor-Wise Financial Summary table.
 *
 * One row per vendor (from buildVendorFinancials), plus a GRAND TOTAL row.
 *
 * PER-VENDOR ROW:
 *   Vendor        — vendorName
 *   Total Amount  = v.totalAmount
 *   GST           = v.totalAmount × v.gstPercent / 100   (with "(pct%)" below)
 *   TDS           = v.totalAmount × v.tdsPercent / 100   (with "(pct%)" below)
 *   Net Total     = v.adjustedAmt
 *   Advance Paid  = v.advanceAmount   (red when > 0)
 *   Balance       = v.balance         (green)
 *
 * GRAND TOTAL ROW:
 *   Total Amount  = Σ v.totalAmount
 *   GST           = +Σ (v.totalAmount × v.gstPercent / 100)
 *   TDS           = -Σ (v.totalAmount × v.tdsPercent / 100)
 *   Net Total     = Σ v.adjustedAmt
 *   Advance Paid  = Σ v.advanceAmount
 *   Balance       = Σ v.balance
 */
export function VendorFinancialSummary({ vendorRows }: { vendorRows: VendorFinancialRow[] }) {
    if (vendorRows.length === 0) return null;

    const grandTotalAmount = vendorRows.reduce((sum, v) => sum + v.totalAmount, 0);
    const grandGstAmount = vendorRows.reduce(
        (sum, v) => sum + v.totalAmount * ((v.gstPercent ?? 0) / 100),
        0,
    );
    const grandTdsAmount = vendorRows.reduce(
        (sum, v) => sum + v.totalAmount * ((v.tdsPercent ?? 0) / 100),
        0,
    );
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
                        <th className="border border-black px-2 py-2 text-center font-bold">GST</th>
                        <th className="border border-black px-2 py-2 text-center font-bold">TDS</th>
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
                            <td className="border border-black px-2 py-1.5">
                                <GstTdsCell
                                    amount={v.totalAmount * ((v.gstPercent ?? 0) / 100)}
                                    percent={v.gstPercent ?? 0}
                                />
                            </td>
                            <td className="border border-black px-2 py-1.5">
                                <GstTdsCell
                                    amount={v.totalAmount * ((v.tdsPercent ?? 0) / 100)}
                                    percent={v.tdsPercent ?? 0}
                                />
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
                        <td className="border border-black px-2 py-1.5 text-right font-bold text-green-700">
                            {grandGstAmount > 0 ? `+${formatExportCurrency(grandGstAmount)}` : "—"}
                        </td>
                        <td className="border border-black px-2 py-1.5 text-right font-bold text-destructive">
                            {grandTdsAmount > 0 ? `-${formatExportCurrency(grandTdsAmount)}` : "—"}
                        </td>
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

export function buildUnassignedVendorRow(items: EventResponse["items"]): VendorFinancialRow | null {
    const rawItems = (items ?? []) as RawItemWithCategory[];
    // Unassigned = no vendor and not explicitly sourced from inventory.
    const unassigned = rawItems.filter(item => !item.vendor && !item.inventoryID);
    if (unassigned.length === 0) return null;

    const totalAmount = unassigned.reduce(
        (sum, item) => sum + (item.quantity ?? 1) * (item.pricePerItem ?? 0) * (item.days ?? 1),
        0,
    );

    // Unassigned items carry no vendor financials, so GST/TDS = 0 and
    // netTotal == amount (adjustedAmt == totalAmount).
    return {
        vendorName: "Unassigned Vendor",
        totalAmount,
        gstPercent: 0,
        gstType: "NONE",
        tdsPercent: 0,
        adjustedAmt: totalAmount,
        advanceAmount: 0,
        balance: totalAmount,
    };
}

/* ------------------------------------------------------------------ */
/*  Grand Summary                                                     */
/* ------------------------------------------------------------------ */

/**
 * Grand Summary — Consolidated Vendor Summary table.
 *
 * Aggregates across all categories and vendor rows.
 *
 * ROWS:
 *   GRAND TOTAL (Subtotal)   = Σ category.subtotal
 *                                (= Σ item.amount across all categories)
 *   Total GST                = Σ v.totalAmount × v.gstPercent / 100  (vendors)
 *   Total TDS                = Σ category.items.tdsAmount  (item-level)
 *   GRAND TOTAL (After Tax)  = Σ v.adjustedAmt  (vendors)
 *   Total Advance Paid       = Σ v.advanceAmount
 *   GRAND OUTSTANDING BALANCE= GRAND TOTAL (After Tax) - Total Advance Paid
 *
 * AMOUNT IN WORDS:
 *   Shown when grandOutstanding > 0: numberToWords(grandOutstanding)
 */
function GrandSummary({
    categories,
    vendorRows,
}: {
    categories: CategoryPurchaseRow[];
    vendorRows: VendorFinancialRow[];
}) {
    const grandSubtotal = categories.reduce((sum, cat) => sum + cat.subtotal, 0);

    // Compute GST and TDS from vendor-wise financial summary
    const grandGstAmount = vendorRows.reduce(
        (sum, v) => sum + v.totalAmount * ((v.gstPercent ?? 0) / 100),
        0,
    );
    const grandTds = categories.reduce(
        (sum, cat) => sum + cat.items.reduce((s, item) => s + item.tdsAmount, 0),
        0,
    );
    const grandAdvance = vendorRows.reduce((sum, v) => sum + v.advanceAmount, 0);
    const grandTotal = vendorRows.reduce((sum, v) => sum + v.adjustedAmt, 0);
    const grandOutstanding = grandTotal - grandAdvance;

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
                    {grandGstAmount > 0 && (
                        <tr className="text-green-700">
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
                                +{formatExportCurrency(grandGstAmount)}
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
/*  Expenses Summary                                                   */
/* ------------------------------------------------------------------ */

/**
 * Expenses Summary table.
 *
 * Displays the aggregated total expense for the event as a single row,
 * fetched from `GET /api/expenses/total`. Shows the expense date and the
 * total amount. Handles loading, empty, and error states without affecting
 * the rest of the preview.
 */
function ExpenseSummaryTable({
    expenseSummary,
    loading,
    error,
}: {
    expenseSummary: {
        startDate: string;
        endDate?: string;
        totalAmount: number;
        hasExpenses: boolean;
    } | null;
    loading: boolean;
    error: string | null;
}) {
    const dateRange = expenseSummary?.endDate
        ? `${expenseSummary.startDate} - ${expenseSummary.endDate}`
        : expenseSummary?.startDate;
    return (
        <div className="mb-6">
            <div className="font-bold text-sm mb-2 uppercase text-muted-foreground tracking-wider">
                Expenses Summary
            </div>
            <table className="w-full border-collapse text-xs border border-black">
                <thead>
                    <tr className={purchaseOrderPreviewStyles.headerBg}>
                        <th className="border border-black px-2 py-2 text-center font-bold">
                            Event Date
                        </th>
                        <th className="border border-black px-2 py-2 text-center font-bold">
                            Total Amount
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="border border-black px-2 py-1.5 text-center">
                            {loading ? "Loading…" : dateRange || "—"}
                        </td>
                        <td className="border border-black px-2 py-1.5 text-right">
                            {loading
                                ? "…"
                                : error || !expenseSummary?.hasExpenses
                                  ? "No expenses"
                                  : formatExportCurrency(expenseSummary.totalAmount)}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Client Bill Summary                                               */
/* ------------------------------------------------------------------ */

/**
 * Client Bill Summary table.
 *
 * All figures come from `calculateClientBillSummary` (in @/lib/utils/billing),
 * which derives everything from the Client Estimate / PO Client Billing input
 * — never from Vendor Summary.
 *
 * ROWS:
 *   Estimated Amount            = totalEstimatedCost
 *   Service Charge ({pct}%)     = estimated × serviceChargePercent / 100
 *   Discount                    = discountAmount (flat)
 *   Original Amount             = Estimated + Service Charge - Discount
 *   GST Amount                  = Original Amount × gstPercent / 100
 *   Total (Original + GST)      = Original Amount + GST Amount
 *   Amount Received from Client = receivedAmount  (PO billing input)
 *   TDS Deducted by Client      = clientTdsAmount  (flat TDS applied by client)
 *   Final Amount                = Amount Received - GST Amount
 *   Advance                     = advanceAmount
 *   Balance                     = Total - Amount Received - Advance - TDS Deducted
 */
function ClientBillSummary({
    eventData,
    vendorRows,
    totalEstimatedCost,
    receivedAmount,
    amountRecievedFromClientDate,
}: {
    eventData: EventResponse;
    vendorRows: VendorFinancialRow[];
    totalEstimatedCost: number;
    receivedAmount: number;
    amountRecievedFromClientDate: string | null | undefined;
}) {
    const summary = useMemo(
        () =>
            calculateClientBillSummary({
                totalEstimatedCost: totalEstimatedCost ?? 0,
                gstPercent: eventData.gst ?? 0,
                serviceChargePercent: eventData.serviceCharge ?? 0,
                discountAmount: eventData.discounts ?? 0,
                clientTdsAmount: eventData.tds ?? 0,
                advanceAmount: eventData.advanceAmt ?? 0,
                receivedAmount,
                vendorSummaries: vendorRows.map(v => ({
                    totalAmount: v.totalAmount,
                    gst: v.gstPercent,
                })),
            }),
        [eventData, vendorRows, totalEstimatedCost, receivedAmount],
    );

    return (
        <div>
            <div className="font-bold text-sm mb-2 uppercase text-muted-foreground tracking-wider">
                Client Bill Summary
            </div>
            <table className="w-full border-collapse text-xs border border-black">
                <tbody>
                    <tr>
                        <td className="border border-black px-3 py-1.5" colSpan={4}>
                            Estimated Amount
                        </td>
                        <td className="border border-black px-3 py-1.5 text-right" colSpan={4}>
                            {formatExportCurrency(summary.estimatedAmount)}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black px-3 py-1.5" colSpan={4}>
                            Service Charge ({eventData.serviceCharge ?? 0}%)
                        </td>
                        <td
                            className="border border-black px-3 py-1.5 text-right text-green-700"
                            colSpan={4}
                        >
                            {formatExportCurrency(summary.serviceChargeAmount)}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black px-3 py-1.5" colSpan={4}>
                            Discount
                        </td>
                        <td
                            className="border border-black px-3 py-1.5 text-right text-destructive"
                            colSpan={4}
                        >
                            −{formatExportCurrency(summary.discountAmount)}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black px-3 py-1.5" colSpan={4}>
                            Original Amount
                        </td>
                        <td className="border border-black px-3 py-1.5 text-right" colSpan={4}>
                            {formatExportCurrency(summary.originalAmount)}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black px-3 py-1.5" colSpan={4}>
                            GST Amount
                        </td>
                        <td
                            className="border border-black px-3 py-1.5 text-right text-green-700"
                            colSpan={4}
                        >
                            {formatExportCurrency(summary.gstAmount)}
                        </td>
                    </tr>
                    <tr className={purchaseOrderPreviewStyles.totalBg}>
                        <td className="border border-black px-3 py-2 font-bold" colSpan={4}>
                            Total (Original + GST)
                        </td>
                        <td
                            className="border border-black px-3 py-2 text-right font-bold"
                            colSpan={4}
                        >
                            {formatExportCurrency(summary.total)}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black px-3 py-1.5" colSpan={4}>
                            Amount Received from Client
                            {amountRecievedFromClientDate
                                ? ` (${formatShortDate(amountRecievedFromClientDate)})`
                                : null}
                        </td>
                        <td
                            className="border border-black px-3 py-1.5 text-right text-green-700"
                            colSpan={4}
                        >
                            {formatExportCurrency(summary.amountReceivedFromClient)}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black px-3 py-1.5" colSpan={4}>
                            TDS Deducted by Client
                        </td>
                        <td
                            className="border border-black px-3 py-1.5 text-right text-destructive"
                            colSpan={4}
                        >
                            −{formatExportCurrency(summary.tdsDeducted)}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black px-3 py-1.5 font-bold" colSpan={4}>
                            Final Amount
                        </td>
                        <td
                            className={`border border-black px-3 py-1.5 text-right font-bold ${
                                summary.finalAmount < 0 ? "text-destructive" : "text-green-700"
                            }`}
                            colSpan={4}
                        >
                            {formatExportCurrency(summary.finalAmount)}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black px-3 py-1.5" colSpan={4}>
                            Advance
                        </td>
                        <td
                            className="border border-black px-3 py-1.5 text-right text-green-700"
                            colSpan={4}
                        >
                            {formatExportCurrency(summary.advance)}
                        </td>
                    </tr>
                    <tr className={purchaseOrderPreviewStyles.balanceBg}>
                        <td
                            className="border border-black px-3 py-2 font-bold text-sm text-green-800"
                            colSpan={4}
                        >
                            Balance
                        </td>
                        <td
                            className={`border border-black px-3 py-2 text-right font-bold text-sm ${
                                summary.balance < 0 ? "text-destructive" : "text-green-800"
                            }`}
                            colSpan={4}
                        >
                            {formatExportCurrency(summary.balance)}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Main Content                                                      */
/* ------------------------------------------------------------------ */

function PurchaseOrderPreviewContent({
    eventData,
    eventName,
    categories,
    vendorFinancialRows,
    totalEstimatedCost,
    receivedAmount,
    amountRecievedFromClientDate,
    expenseSummary,
    expenseLoading,
    expenseError,
}: {
    eventData: EventResponse;
    eventName?: string;
    categories: CategoryPurchaseRow[];
    vendorFinancialRows: VendorFinancialRow[];
    totalEstimatedCost: number;
    receivedAmount: number;
    amountRecievedFromClientDate: string | null | undefined;
    expenseSummary: {
        startDate: string;
        endDate?: string;
        totalAmount: number;
        hasExpenses: boolean;
    } | null;
    expenseLoading: boolean;
    expenseError: string | null;
}) {
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
            <div className="font-bold text-sm mb-2 uppercase text-muted-foreground tracking-wider">
                Category-wise Item Breakdown
            </div>
            <CategoryItemsTable categories={categories} />

            {/* Vendor-Wise Financial Summary */}
            {vendorFinancialRows.length > 0 && (
                <VendorFinancialSummary vendorRows={vendorFinancialRows} />
            )}

            {/* Grand Summary */}
            <div className="mt-6">
                <div className="font-bold text-sm mb-2 uppercase text-muted-foreground tracking-wider">
                    Consolidated Vendor Summary
                </div>
                <GrandSummary categories={categories} vendorRows={vendorFinancialRows} />
            </div>

            {/* Expenses Summary */}
            <ExpenseSummaryTable
                expenseSummary={expenseSummary}
                loading={expenseLoading}
                error={expenseError}
            />

            {/* Client Bill Summary */}
            <div className="mt-6">
                <ClientBillSummary
                    eventData={eventData}
                    vendorRows={vendorFinancialRows}
                    totalEstimatedCost={totalEstimatedCost}
                    receivedAmount={receivedAmount}
                    amountRecievedFromClientDate={amountRecievedFromClientDate}
                />
            </div>

            {/* Profit Summary – internal (event management team) */}
            <Access roles={["admin", "super_admin"]}>
                <div className="mt-6">
                    <div className="font-bold text-sm mb-2 uppercase text-muted-foreground tracking-wider">
                        Profit Summary
                    </div>
                    <ProfitSummary
                        eventData={eventData}
                        totalEstimatedCost={totalEstimatedCost}
                        expenseSummary={expenseSummary}
                    />
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
    const [downloading, setDownloading] = useState<"pdf" | "excel" | null>(null);
    const { user } = useAuth();
    const includeProfitSummary = hasPermission(user, ["admin", "super_admin"]);
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
    const vendorFinancialRows = useMemo(() => {
        const rows = buildVendorFinancials(eventData.vendorSummary, vendorList);
        const unassigned = buildUnassignedVendorRow(eventData.items);
        return unassigned ? [...rows, unassigned] : rows;
    }, [eventData.vendorSummary, vendorList, eventData.items]);

    // Amount received from the client, restored from the saved event data.
    const receivedAmount = toFiniteNumber(eventData.amountRecievedFromClient, 0);
    const amountRecievedFromClientDate =
        (eventData.amountRecievedFromClientDate as string | null) ?? null;

    // Expenses Summary fetched from `GET /api/expenses/total` when the preview opens.
    const [expenseSummary, setExpenseSummary] = useState<{
        startDate: string;
        endDate?: string;
        totalAmount: number;
        hasExpenses: boolean;
    } | null>(null);
    const [expenseLoading, setExpenseLoading] = useState(false);
    const [expenseError, setExpenseError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const loadExpenseSummary = async () => {
            if (!eventData?.eventID) {
                setExpenseLoading(false);
                return;
            }
            setExpenseLoading(true);
            setExpenseError(null);
            try {
                const poc = user?.name || "";
                const data = await fetchExpenseTotal(eventData.eventID, poc);
                if (cancelled) return;
                const totalAmount = data.reduce(
                    (sum, entry) => sum + Number(entry.totalAmount ?? 0),
                    0,
                );
                setExpenseSummary({
                    startDate: formatShortDate(eventData.eventStartDate),
                    endDate: eventData.eventEndDate
                        ? formatShortDate(eventData.eventEndDate)
                        : undefined,
                    totalAmount,
                    hasExpenses: data.length > 0,
                });
            } catch (err) {
                if (cancelled) return;
                console.error("Failed to fetch Expenses Summary:", err);
                setExpenseError(
                    err instanceof Error ? err.message : "Unable to load Expenses Summary.",
                );
            } finally {
                if (!cancelled) setExpenseLoading(false);
            }
        };
        loadExpenseSummary();
        return () => {
            cancelled = true;
        };
    }, [eventData?.eventID, user?.name]);

    const handleDownload = async (format: "pdf" | "excel") => {
        if (downloading) return;
        setDownloading(format);
        try {
            if (format === "pdf") {
                await downloadPurchaseOrderPdf(
                    eventData,
                    eventName,
                    categories,
                    vendorFinancialRows,
                    {
                        totalEstimatedCost,
                        includeProfitSummary,
                        expenseSummary,
                    },
                );
                toast.success("PDF downloaded");
            } else {
                await downloadPurchaseOrderExcel(
                    eventData,
                    eventName,
                    categories,
                    vendorFinancialRows,
                    {
                        totalEstimatedCost,
                        includeProfitSummary,
                        expenseSummary,
                    },
                );
                toast.success("Excel downloaded");
            }
        } catch (error) {
            console.error(`Failed to download purchase order ${format}:`, error);
            toast.error(`Failed to download ${format === "pdf" ? "PDF" : "Excel"}`);
        } finally {
            setDownloading(null);
        }
    };

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
                        categories={categories}
                        vendorFinancialRows={vendorFinancialRows}
                        totalEstimatedCost={totalEstimatedCost}
                        receivedAmount={receivedAmount}
                        amountRecievedFromClientDate={amountRecievedFromClientDate}
                        expenseSummary={expenseSummary}
                        expenseLoading={expenseLoading}
                        expenseError={expenseError}
                    />
                </div>
            </ModalBody>
            <ModalFooter>
                <Button variant="outline" onClick={onClose}>
                    Close
                </Button>
                <Button
                    onClick={() => handleDownload("pdf")}
                    disabled={downloading !== null}
                    className="flex items-center gap-2"
                    icon={<FileText size={16} />}
                >
                    {downloading === "pdf" ? "Downloading…" : "Download PDF"}
                </Button>
                <Button
                    onClick={() => handleDownload("excel")}
                    disabled={downloading !== null}
                    className="flex items-center gap-2"
                    icon={<FileSpreadsheet size={16} />}
                >
                    {downloading === "excel" ? "Downloading…" : "Download Excel"}
                </Button>
            </ModalFooter>
        </Modal>
    );
}
