import moment from "moment";
import type { ChecklistItem } from "@/components/checklist-modal/types";
import { groupByCategory } from "@/lib/utils";
import { toRomanLower } from "@/lib/utils";
import { ESTIMATE_EXPORT_COLORS } from "@/lib/estimate-export/estimate-document";

export { ESTIMATE_EXPORT_COLORS as CHECKLIST_EXPORT_COLORS };

export const CHECKLIST_EXPORT_COLUMNS = [
    "Sl. No",
    "Elements",
    "Details",
    "nos",
    "Unit",
    "Days",
    "Vendor",
    "Status",
    "Deadline",
] as const;

export const CHECKLIST_COLUMN_COUNT = CHECKLIST_EXPORT_COLUMNS.length;

export type ChecklistExportRow =
    | { type: "title"; text: string }
    | { type: "meta"; label: string; value: string }
    | { type: "table-header" }
    | { type: "category"; serial: string; name: string }
    | { type: "subCategory"; name: string }
    | { type: "item"; serial: number; item: ChecklistItem; vendorDisplay: string };

export interface ChecklistExportContext {
    eventName?: string;
    clientName?: string;
    eventStartDate?: string;
    eventEndDate?: string;
    venue?: string;
}

export interface ChecklistDocumentModel {
    title: string;
    meta: { label: string; value: string }[];
    rows: ChecklistExportRow[];
    filenameBase: string;
}

type VendorRef = { id?: string | number; name?: string };
type InventoryRef = { id?: string | number; itemName?: string };

function formatEventDate(fromDate?: string, toDate?: string): string {
    if (!fromDate) return "N/A";
    const from = moment(fromDate);
    if (!toDate || moment(toDate).isSame(from, "day")) {
        return from.format("Do MMMM YYYY, dddd");
    }
    return `${from.format("Do MMMM YYYY")} – ${moment(toDate).format("Do MMMM YYYY")}`;
}

export function resolveChecklistVendorDisplay(
    item: ChecklistItem,
    vendorList: VendorRef[],
    inventoryList: InventoryRef[],
): string {
    if (item.inventoryID) {
        const inv = inventoryList.find(i => String(i.id) === String(item.inventoryID));
        return inv?.itemName ? `📦 ${inv.itemName}` : "Inventory";
    }
    const vendor = vendorList.find(v => String(v.id) === String(item.vendor));
    return vendor?.name || item.vendor || "—";
}

export function getChecklistItemName(item: ChecklistItem): string {
    return (item.item || "").trim() || "—";
}

export function getChecklistItemDetails(item: ChecklistItem): string {
    return (item.description || "").trim() || "—";
}

export function getChecklistItemUnit(item: ChecklistItem): string {
    return (item.unit || "nos").trim() || "nos";
}

function appendCategoryRows(
    rows: ChecklistExportRow[],
    groups: ReturnType<typeof groupByCategory<ChecklistItem>>,
    vendorList: VendorRef[],
    inventoryList: InventoryRef[],
    startCategoryIndex: number,
): number {
    let categoryIndex = startCategoryIndex;

    groups.forEach(group => {
        const itemCount =
            group.directItems.length +
            group.subCategories.reduce((sum, sub) => sum + sub.items.length, 0);
        if (itemCount === 0) return;

        categoryIndex += 1;
        rows.push({
            type: "category",
            serial: toRomanLower(categoryIndex),
            name: group.name,
        });

        group.directItems.forEach((item, itemIndex) => {
            rows.push({
                type: "item",
                serial: itemIndex + 1,
                item,
                vendorDisplay: resolveChecklistVendorDisplay(item, vendorList, inventoryList),
            });
        });

        group.subCategories.forEach(sub => {
            rows.push({
                type: "subCategory",
                name: sub.name,
            });

            sub.items.forEach((item, itemIndex) => {
                rows.push({
                    type: "item",
                    serial: itemIndex + 1,
                    item,
                    vendorDisplay: resolveChecklistVendorDisplay(item, vendorList, inventoryList),
                });
            });
        });
    });

    return categoryIndex;
}

export function buildChecklistDocumentModel(
    checklistData: ChecklistItem[],
    context: ChecklistExportContext = {},
    vendorList: VendorRef[] = [],
    inventoryList: InventoryRef[] = [],
): ChecklistDocumentModel {
    const displayTitle = context.eventName?.trim() || "Event";
    const title = `Checklist For ${displayTitle}`;
    const groups = groupByCategory(checklistData);

    const rows: ChecklistExportRow[] = [
        { type: "title", text: title },
        { type: "meta", label: "Client", value: context.clientName || "—" },
        {
            type: "meta",
            label: "Event date",
            value: formatEventDate(context.eventStartDate, context.eventEndDate),
        },
        { type: "meta", label: "Venue", value: context.venue || "—" },
        {
            type: "meta",
            label: "Generated on",
            value: moment().format("DD/MM/YYYY"),
        },
        { type: "table-header" },
    ];

    appendCategoryRows(rows, groups, vendorList, inventoryList, 0);

    const safeName = displayTitle.replace(/[^\w\-]+/g, "_").slice(0, 40);

    return {
        title,
        meta: rows
            .filter((r): r is Extract<ChecklistExportRow, { type: "meta" }> => r.type === "meta")
            .map(r => ({ label: r.label, value: r.value })),
        rows,
        filenameBase: `Checklist_${safeName}`,
    };
}
