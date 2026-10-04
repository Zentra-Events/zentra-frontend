import { DEFAULT_CURRENCY_SYMBOL, DEFAULT_ITEM_COLUMNS, DEFAULT_UNIT_VALUE } from "../constants";
import type { CategoryEditorItemColumnSpec, CategoryEditorLine, CategoryEditorLineItem } from "../types";

/** Read an arbitrary named field off a grouped item. */
export function readItemField<L extends CategoryEditorLine>(
    item: CategoryEditorLineItem<L>,
    field: string,
): unknown {
    return (item as unknown as Record<string, unknown>)[field];
}

/** Coerce a text-like field to a string. */
export function itemTextValue<L extends CategoryEditorLine>(
    item: CategoryEditorLineItem<L>,
    field: string,
): string {
    const value = readItemField(item, field);
    if (typeof value === "string") return value;
    return value == null ? "" : String(value);
}

/** Coerce a numeric field to a finite number (0 when missing/invalid). */
export function itemNumberValue<L extends CategoryEditorLine>(
    item: CategoryEditorLineItem<L>,
    field: string,
): number {
    const value = readItemField(item, field);
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : 0;
}

/** Coerce a unit-like field to a non-empty string. */
export function itemUnitValue<L extends CategoryEditorLine>(
    item: CategoryEditorLineItem<L>,
    field: string,
    fallback: string = DEFAULT_UNIT_VALUE,
): string {
    const value = readItemField(item, field);
    return typeof value === "string" && value.trim() ? value : fallback;
}

/**
 * Compute the row total as the product of every numeric column flagged
 * with `contributesToTotal`. Matches the legacy `days * sqft * rate`.
 */
export function calculateItemTotal<L extends CategoryEditorLine>(
    item: CategoryEditorLineItem<L>,
    columns: readonly CategoryEditorItemColumnSpec[] = DEFAULT_ITEM_COLUMNS,
): number {
    let total = 1;
    let hasFactor = false;
    for (const column of columns) {
        if (column.type !== "number" || !column.contributesToTotal) continue;
        total *= itemNumberValue(item, column.field);
        hasFactor = true;
    }
    return hasFactor ? total : 0;
}

/** Format a row total for display (currency-prefixed, two decimals). */
export function formatItemTotal<L extends CategoryEditorLine>(
    item: CategoryEditorLineItem<L>,
    columns: readonly CategoryEditorItemColumnSpec[] = DEFAULT_ITEM_COLUMNS,
    currencySymbol: string = DEFAULT_CURRENCY_SYMBOL,
): string {
    return `${currencySymbol}${calculateItemTotal(item, columns).toFixed(2)}`;
}

/** Sum the totals of many grouped items. */
export function sumItemTotals<L extends CategoryEditorLine>(
    items: readonly CategoryEditorLineItem<L>[],
    columns: readonly CategoryEditorItemColumnSpec[] = DEFAULT_ITEM_COLUMNS,
): number {
    return items.reduce((sum, item) => sum + calculateItemTotal(item, columns), 0);
}