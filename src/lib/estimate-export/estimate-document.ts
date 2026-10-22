import moment from "moment";
import type { EstimateDto, EstimateItem } from "@/types/estimate";
import { calculateEstimateSummary } from "@/lib/utils/estimate";

export const ESTIMATE_EXPORT_COLORS = {
    titleBg: "FFE6E0F8",
    headerBg: "FFE6E0F8",
    categoryBg: "FFD9EAD3",
    subCategoryBg: "FFEEF5EA",
    totalBg: "FFB4C6E7",
    subTotalBg: "FFFFF2CC",
    summaryBg: "FFE6E0F8",
    border: "FF000000",
} as const;

export const ESTIMATE_EXPORT_COLUMNS = [
    "Sl. No",
    "Elements",
    "Details",
    "nos",
    "Rate",
    "Amount",
] as const;

export type EstimateExportRow =
    | { type: "title"; text: string }
    | { type: "meta"; label: string; value: string }
    | { type: "table-header" }
    | { type: "section-title"; text: string }
    | { type: "category"; serial: string; name: string }
    | { type: "subCategory"; name: string }
    | { type: "item"; serial: number; item: EstimateItem }
    | { type: "summary"; label: string; value: number; variant: "total" | "service" | "subtotal" | "gst" | "grand" | "discount" };

export interface EstimateDocumentModel {
    title: string;
    meta: { label: string; value: string }[];
    rows: EstimateExportRow[];
    summary: {
        itemsTotal: number;
        serviceChargeAmount: number;
        subTotal: number;
        gstAmount: number;
        grandTotal: number;
        serviceChargePercent: number;
        gstPercent: number;
        discounts: number;
    };
    filenameBase: string;
}

const ADDITIONAL_REQUIREMENTS_PATTERN = /additional\s*requirements?/i;

function toRomanLower(index: number): string {
    const numerals: [number, string][] = [
        [1000, "m"],
        [900, "cm"],
        [500, "d"],
        [400, "cd"],
        [100, "c"],
        [90, "xc"],
        [50, "l"],
        [40, "xl"],
        [10, "x"],
        [9, "ix"],
        [5, "v"],
        [4, "iv"],
        [1, "i"],
    ];
    let n = index;
    let result = "";
    for (const [value, numeral] of numerals) {
        while (n >= value) {
            result += numeral;
            n -= value;
        }
    }
    return result;
}

function formatEventDate(fromDate?: string | null, toDate?: string | null): string {
    if (!fromDate) return "N/A";
    const from = moment(fromDate);
    if (!toDate || moment(toDate).isSame(from, "day")) {
        return from.format("Do MMMM YYYY, dddd");
    }
    return `${from.format("Do MMMM YYYY")} – ${moment(toDate).format("Do MMMM YYYY")}`;
}

function buildEstimateNumber(estimate: EstimateDto): string {
    const client = (estimate.client || "Client").replace(/\s+/g, "");
    const monthYear = estimate.createdAt
        ? moment(estimate.createdAt).format("MMM/YYYY")
        : moment().format("MMM/YYYY");
    const version = (estimate.version || "v1").replace(/\s+/g, "");
    const idPart = estimate.id ? estimate.id.slice(0, 6).toUpperCase() : "EST";
    return `${idPart}/${client}/${version}/${monthYear}`;
}

function getItemAmount(item: EstimateItem): number {
    if (typeof item.finalAmt === "number" && !Number.isNaN(item.finalAmt)) return item.finalAmt;
    if (typeof item.total === "number" && !Number.isNaN(item.total)) return item.total;
    const rate = item.pricePerItem ?? item.rate ?? 0;
    const qty = item.quantity ?? 0;
    return Number((qty * rate * (item.days || 1)).toFixed(2));
}

function getItemRate(item: EstimateItem): number {
    return item.pricePerItem ?? item.rate ?? item.unitCost ?? 0;
}

function getItemName(item: EstimateItem): string {
    return (item.item || "").trim() || "—";
}

function getItemDetails(item: EstimateItem): string {
    return (item.specification || item.description || "").trim() || "—";
}

function splitItemCategories(items: Record<string, EstimateItem[]>) {
    const main: { category: string; items: EstimateItem[] }[] = [];
    const additional: { category: string; items: EstimateItem[] }[] = [];

    Object.entries(items || {}).forEach(([category, categoryItems]) => {
        const entry = { category, items: categoryItems || [] };
        if (ADDITIONAL_REQUIREMENTS_PATTERN.test(category)) {
            additional.push(entry);
        } else {
            main.push(entry);
        }
    });

    return { main, additional };
}

export interface GroupedCategoryItems {
    directItems: EstimateItem[];
    subCategories: { name: string; items: EstimateItem[] }[];
}

/** Groups category items: direct items first, then sub categories in first-seen order. */
export function groupCategoryItems(items: EstimateItem[]): GroupedCategoryItems {
    const directItems: EstimateItem[] = [];
    const subCategoryMap = new Map<string, EstimateItem[]>();
    const subCategoryOrder: string[] = [];

    for (const item of items) {
        const subName = (item.subCategory || "").trim();
        if (!subName) {
            directItems.push(item);
            continue;
        }
        if (!subCategoryMap.has(subName)) {
            subCategoryMap.set(subName, []);
            subCategoryOrder.push(subName);
        }
        subCategoryMap.get(subName)!.push(item);
    }

    return {
        directItems,
        subCategories: subCategoryOrder.map(name => ({
            name,
            items: subCategoryMap.get(name)!,
        })),
    };
}

function appendCategoryRows(
    rows: EstimateExportRow[],
    categories: { category: string; items: EstimateItem[] }[],
    startCategoryIndex: number,
): number {
    let categoryIndex = startCategoryIndex;

    categories.forEach(({ category, items: categoryItems }) => {
        if (!categoryItems.length) return;

        categoryIndex += 1;
        rows.push({
            type: "category",
            serial: toRomanLower(categoryIndex),
            name: category,
        });

        const { directItems, subCategories } = groupCategoryItems(categoryItems);

        directItems.forEach((item, itemIndex) => {
            rows.push({
                type: "item",
                serial: itemIndex + 1,
                item,
            });
        });

        subCategories.forEach(({ name, items: subItems }) => {
            rows.push({
                type: "subCategory",
                name,
            });

            subItems.forEach((item, itemIndex) => {
                rows.push({
                    type: "item",
                    serial: itemIndex + 1,
                    item,
                });
            });
        });
    });

    return categoryIndex;
}

export function buildEstimateDocumentModel(estimate: EstimateDto, eventName?: string): EstimateDocumentModel {
    const items = estimate.items || {};
    const { main, additional } = splitItemCategories(items);

    const itemsTotal = Object.values(items)
        .flat()
        .reduce((sum, item) => sum + getItemAmount(item), 0);

    const discounts = estimate.discounts ?? 0;
    const { serviceChargeAmount, gstAmount, totalWithGST } = calculateEstimateSummary({
        totalAmount: itemsTotal,
        gst: estimate.gst,
        serviceCharge: estimate.serviceCharge,
        discounts,
    });

    const subTotal = itemsTotal + serviceChargeAmount - discounts;

    const displayTitle = estimate.title || eventName || estimate.highlvelRequirement || "Event";
    const title = `Estimate For ${displayTitle}`;

    const rows: EstimateExportRow[] = [
        { type: "title", text: title },
        { type: "meta", label: "Bill to", value: estimate.client || "—" },
        {
            type: "meta",
            label: "Event date",
            value: formatEventDate(estimate.fromDate, estimate.toDate),
        },
        { type: "meta", label: "Venue", value: estimate.venue || "—" },
        {
            type: "meta",
            label: "Estimate Date",
            value: estimate.createdAt
                ? moment(estimate.createdAt).format("DD/MM/YYYY")
                : estimate.enquiryDate
                  ? moment(estimate.enquiryDate).format("DD/MM/YYYY")
                  : moment().format("DD/MM/YYYY"),
        },
        { type: "meta", label: "Estimate no", value: buildEstimateNumber(estimate) },
        { type: "table-header" },
    ];

    let categoryIndex = 0;
    categoryIndex = appendCategoryRows(rows, main, categoryIndex);

    if (additional.length > 0) {
        rows.push({ type: "section-title", text: "Additional requirements" });
        rows.push({ type: "table-header" });
        appendCategoryRows(rows, additional, categoryIndex);
    }

    rows.push(
        {
            type: "summary",
            label: "Total",
            value: itemsTotal,
            variant: "total",
        },
        {
            type: "summary",
            label: `Service charge @${estimate.serviceCharge}%`,
            value: serviceChargeAmount,
            variant: "service",
        },
    );

    if (discounts > 0) {
        rows.push({
            type: "summary",
            label: "Discount",
            value: discounts,
            variant: "discount",
        });
    }

    rows.push(
        {
            type: "summary",
            label: "Total",
            value: subTotal,
            variant: "subtotal",
        },
        {
            type: "summary",
            label: `GST@${estimate.gst}%`,
            value: gstAmount,
            variant: "gst",
        },
        {
            type: "summary",
            label: "Grand Total",
            value: totalWithGST,
            variant: "grand",
        },
    );

    const safeName = displayTitle.replace(/[^\w\-]+/g, "_").slice(0, 40);
    const version = estimate.version || "estimate";

    return {
        title,
        meta: rows
            .filter((r): r is Extract<EstimateExportRow, { type: "meta" }> => r.type === "meta")
            .map(r => ({ label: r.label, value: r.value })),
        rows,
        summary: {
            itemsTotal,
            serviceChargeAmount,
            subTotal,
            gstAmount,
            grandTotal: totalWithGST,
            serviceChargePercent: estimate.serviceCharge,
            gstPercent: estimate.gst,
            discounts,
        },
        filenameBase: `Estimate_${safeName}_${version}`,
    };
}

export { getItemAmount, getItemRate, getItemName, getItemDetails };

export { formatExportCurrency } from "@/lib/utils";
