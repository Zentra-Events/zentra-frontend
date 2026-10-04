import type { CategoryEditorItemColumnSpec } from "./types";

/**
 * Default, overridable copy used throughout the editor. Future pages can
 * pass their own labels/columns/units without editing shared constants.
 */
export interface CategoryEditorStrings {
    addCategory: string;
    addSubCategory: string;
    addItem: string;
    addUngroupedItem: string;
    categoryNamePlaceholder: string;
    subCategoryNamePlaceholder: string;
    emptyStateText: string;
    newCategoryName: string;
    newSubCategoryName: string;
}

export const DEFAULT_LABELS: CategoryEditorStrings = {
    addCategory: "Add Category",
    addSubCategory: "Sub Category",
    addItem: "Item",
    addUngroupedItem: "Add General Item",
    categoryNamePlaceholder: "Category name",
    subCategoryNamePlaceholder: "Sub category",
    emptyStateText: "No elements added yet.",
    newCategoryName: "New Category",
    newSubCategoryName: "New Sub Category",
};

/** Default item columns (matches the legacy artifacts layout exactly). */
export const DEFAULT_ITEM_COLUMNS: readonly CategoryEditorItemColumnSpec[] = [
    {
        field: "item",
        label: "Element",
        type: "text",
        align: "left",
        placeholder: "Item name",
        className: "text-xs",
    },
    {
        field: "specification",
        label: "Specification",
        type: "text",
        align: "left",
        placeholder: "Specification",
        className: "text-xs",
    },
    {
        field: "days",
        label: "Days",
        type: "number",
        align: "center",
        min: 1,
        contributesToTotal: true,
        className: "mx-auto text-xs",
    },
    {
        field: "sqft",
        label: "Qty",
        type: "number",
        align: "center",
        min: 1,
        contributesToTotal: true,
        className: "mx-auto text-xs",
    },
    {
        field: "unit",
        label: "Unit",
        type: "unit",
        align: "center",
    },
    {
        field: "rate",
        label: "Rate",
        type: "number",
        align: "center",
        min: 0,
        step: 0.01,
        prefix: "₹",
        contributesToTotal: true,
        className: "tabular-nums text-xs",
    },
    {
        field: "total",
        label: "Total",
        type: "total",
        align: "right",
    },
];

/** Default unit options for the unit column. */
export const DEFAULT_UNIT_OPTIONS = ["sq.ft", "nos", "g", "kg", "cm", "m", "ft", "in"] as const;

/** Fallback unit used when a line has no unit yet. */
export const DEFAULT_UNIT_VALUE = "nos";

/** Currency symbol used when formatting monetary values. */
export const DEFAULT_CURRENCY_SYMBOL = "₹";

export type UnitOption = (typeof DEFAULT_UNIT_OPTIONS)[number];