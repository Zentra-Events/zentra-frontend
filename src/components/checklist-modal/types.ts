/**
 * Shared types for the Execution Checklist modal.
 *
 * The checklist is item-centric: the single source of truth is a flat
 * `ChecklistItem[]` (the same shape persisted to the backend). The hierarchical
 * Category → Sub Category → Item tree is *derived* for display via the shared
 * `groupByCategory` utility, which is why `ChecklistItem` only needs the
 * `category` / `subCategory?` fields to be groupable.
 */

import type { Vendor } from "@/types/vendor";
import type { Inventory } from "@/types/inventory";
import type { EventChecklistItem } from "@/types/checklist";

/** Persisted status values understood by the backend. */
export type ChecklistItemStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

/** Options for the Status select. */
export const statusOptions = [
    { value: "PENDING", label: "Pending" },
    { value: "IN_PROGRESS", label: "Progress" },
    { value: "COMPLETED", label: "Completed" },
];

/**
 * A single flat checklist line. Mirrors the backend `EventItem` / checklist
 * model so the existing save logic (POST `items`) keeps working unchanged.
 */
export interface ChecklistItem {
    category: string;
    subCategory?: string;
    item: string;
    description?: string;
    quantity: number;
    days?: number;
    /** Quantity unit (reuses the estimate module's unit list, default "nos"). */
    unit?: string;
    /** Legacy financial field retained for data compatibility; NOT shown in the editor. */
    pricePerItem?: number;
    startDate?: string;
    endDate?: string;
    deadlineDate?: string;
    vendor?: string;
    inventoryID?: string | number;
    status?: string;
    isInventoryItem?: boolean;
    /** Client-only stable identity (stripped before persisting). */
    _uid?: string;
}

/** Raw estimate item that can be seeded into the checklist on first load. */
export interface EventItem {
    category?: string;
    subCategory?: string;
    item?: string;
    description?: string;
    quantity?: number;
    count?: number;
    unit?: string;
    vendor?: string;
   startDate?: string | null;
    endDate?: string | null;
    deadlineDate?: string | null;
    status?: string;
   
    inventoryID?: string | number;
    
    pricePerItem?: number;
    days?: number;
}

export interface ChecklistModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventData: {
    id?: string;
    title?: string;
    eventID?: string;
    checklistAssignedTo?: string | null;
    items?: EventChecklistItem[];
    checklist?: EventChecklistItem[] | ChecklistItem[];
};
    /** Global checklist assignee (one per checklist), mapped from the API response. */
    checklistAssignedTo?: string;
    onSave: () => void;
    onCancel?: () => void;
    vendorList: Vendor[];
    inventoryList: Inventory[];
    loadingVendors?: boolean;
    loadingInventory?: boolean;
}

/** Which kind of node is currently highlighted in the editor panel. */
export type SelectedNode =
    | { type: "item"; uid: string }
    | { type: "category"; name: string }
    | { type: "subcategory"; category: string; name: string };

/** Flattened summary shown in the sticky footer. */
export interface ChecklistSummary {
    total: number;
    completed: number;
    remaining: number;
}
