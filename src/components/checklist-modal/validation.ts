/**
 * Shared validation for Execution Checklist items.
 *
 * Centralized so the editor (inline field errors) and the modal (Save gate +
 * hierarchy highlighting) both rely on the exact same rules. Vendor / Inventory
 * are OPTIONAL fields — an item may be saved without either. The
 * `hasVendorOrInventory` helper powers a non-blocking confirmation that lists
 * such items when the user saves.
 */
import type { ChecklistItem } from "./types";

/** Field name -> error message. A present key means the field is invalid. */
export interface ChecklistItemValidation {
    item?: string;
    status?: string;
    description?: string;
    days?: string;
    quantity?: string;
    unit?: string;
    vendor?: string;
    inventoryID?: string;
    [field: string]: string | undefined;
}

const isPositiveNumber = (value: number | undefined): boolean =>
    value != null && Number.isFinite(Number(value)) && Number(value) > 0;

/** Validate one checklist item and return a map of field errors (empty = valid). */
export function validateChecklistItem(item: ChecklistItem): ChecklistItemValidation {
    const errors: ChecklistItemValidation = {};

    // Item Name — Required
    if (!item.item?.trim()) {
        errors.item = "Item Name is required.";
    }

    // Status — Required
    if (!item.status) {
        errors.status = "Status is required.";
    }

    // Description — Required
    if (!item.description?.trim()) {
        errors.description = "Description is required.";
    }

    // Days — Required
    if (!isPositiveNumber(item.days)) {
        errors.days = "Days is required.";
    }

    // Quantity — Required
    if (!isPositiveNumber(item.quantity)) {
        errors.quantity = "Quantity is required.";
    }

    // Unit — Required
    if (!item.unit?.trim()) {
        errors.unit = "Unit is required.";
    }

    // Vendor / Inventory are OPTIONAL fields. Missing either does NOT block
    // saving; if any item lacks a Vendor and an Inventory, the modal surfaces a
    // non-blocking confirmation listing those items (see hasVendorOrInventory).

    return errors;
}

/**
 * True when the item has a Vendor (when inventory is not used) OR an Inventory
 * (when "Use Inventory" is enabled). Both are optional, so this only drives an
 * informational confirmation on Save — it never blocks persisting the item.
 */
export function hasVendorOrInventory(item: ChecklistItem): boolean {
    if (item.isInventoryItem) {
        return item.inventoryID != null && String(item.inventoryID).trim() !== "";
    }
    return !!(item.vendor && item.vendor.trim() !== "");
}

/** True when the item has at least one validation error. */
export function hasValidationErrors(item: ChecklistItem): boolean {
    return Object.keys(validateChecklistItem(item)).length > 0;
}