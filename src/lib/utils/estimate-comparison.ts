import { GroupedCategory, GroupedItem, generateId } from "./artifact-utils";
import { EventItem } from "@/types/event";

export type { GroupedCategory, GroupedItem } from "./artifact-utils";

export interface ComparisonItem extends GroupedItem {
    category: string;
    subCategory: string;
}

export type MatchStatus = "new-item" | "exact-match" | "quantity-changed" | "partial-match";

export interface ItemComparisonResult {
    item: ComparisonItem;
    status: MatchStatus;
    message: string | null;
    existingItem: ComparisonItem | null;
}

export function groupEventItemsByCategory(items: EventItem[] = []): GroupedCategory[] {
    const categoryMap = new Map<
        string,
        {
            name: string;
            directItems: GroupedItem[];
            subCategoryMap: Map<string, { id: string; name: string; items: GroupedItem[] }>;
        }
    >();

    items.forEach((item, index) => {
        const category = item.category?.trim() || "General";
        if (!categoryMap.has(category)) {
            categoryMap.set(category, {
                name: category,
                directItems: [],
                subCategoryMap: new Map(),
            });
        }

        const group = categoryMap.get(category)!;
        const quantity = Number.isFinite(item.count ?? NaN) && item.count! > 0 ? item.count! : 1;
        const days = Number.isFinite(item.days ?? NaN) && item.days! > 0 ? item.days! : 1;
        const rate = Number.isFinite(item.pricePerItem ?? NaN) ? item.pricePerItem! : 0;
        const vendor = typeof item.vendor === "string" ? item.vendor : (item.vendor?.name ?? "");

        group.directItems.push({
            id: `event-item-${category}-${index}-${generateId().slice(0, 6)}`,
            item: item.item ?? "Item",
            specification: item.description ?? "",
            days,
            sqft: quantity,
            rate,
            vendor,
            unit: "nos",
        });
    });

    const result: GroupedCategory[] = [];
    let categoryIndex = 0;

    for (const [, group] of categoryMap) {
        categoryIndex += 1;
        const subCategories = Array.from(group.subCategoryMap.values()).map(sub => ({
            ...sub,
            romanIndex: "",
        }));

        result.push({
            id: `event-cat-${categoryIndex}-${generateId().slice(0, 6)}`,
            name: group.name,
            directItems: group.directItems,
            subCategories,
        });
    }

    return result;
}

/**
 * Flatten a GroupedCategory[] into a flat array of ComparisonItem objects,
 * each carrying its category and subCategory context.
 */
export function flattenGroupedToComparisonItems(categories: GroupedCategory[]): ComparisonItem[] {
    const items: ComparisonItem[] = [];

    for (const cat of categories) {
        for (const item of cat.directItems) {
            items.push({
                ...item,
                category: cat.name,
                subCategory: "",
            });
        }
        for (const sub of cat.subCategories) {
            for (const item of sub.items) {
                items.push({
                    ...item,
                    category: cat.name,
                    subCategory: sub.name,
                });
            }
        }
    }

    return items;
}

/**
 * Build a unique composite key for matching items.
 * Format: "category::subCategory::item"
 */
export function buildComparisonKey(category: string, subCategory: string, item: string): string {
    return `${category}::${subCategory}::${item}`.toLowerCase().trim();
}

/**
 * Build a detailed key that includes specification, days, and rate
 * for exact-match comparison (excluding quantity/sqft).
 * Format: "category::subCategory::item::specification::days::rate"
 */
function buildDetailedKey(ci: ComparisonItem): string {
    return `${ci.category}::${ci.subCategory}::${ci.item}::${ci.specification}::${ci.days}::${ci.rate}`
        .toLowerCase()
        .trim();
}

/**
 * Compare new estimate items against existing event items and return
 * a detailed comparison result for each new item.
 *
 * Matching rules:
 * 1. Items are matched by category + subCategory + item (all three must match)
 * 2. If they match and specification + days + rate also match but quantity differs → "quantity-changed"
 * 3. If they match but specification, days, or rate differ → "partial-match"
 * 4. If no match on category/subCategory/item → "new-item"
 */
export function compareAdditionalEstimateItems(
    existingEventCategories: GroupedCategory[],
    newEstimateCategories: GroupedCategory[],
): ItemComparisonResult[] {
    const existingItems = flattenGroupedToComparisonItems(existingEventCategories);
    const newItems = flattenGroupedToComparisonItems(newEstimateCategories);

    // Build lookup maps from existing items
    // Primary map: keyed by (category + subCategory + item) -> existing item
    const primaryLookup = new Map<string, ComparisonItem>();
    // Detailed map: keyed by (full detailed key) -> existing item (for exact match check)
    const detailedLookup = new Map<string, ComparisonItem>();

    for (const item of existingItems) {
        const primaryKey = buildComparisonKey(item.category, item.subCategory, item.item);
        primaryLookup.set(primaryKey, item);

        const detailedKey = buildDetailedKey(item);
        detailedLookup.set(detailedKey, item);
    }

    const results: ItemComparisonResult[] = [];

    for (const newItem of newItems) {
        const primaryKey = buildComparisonKey(newItem.category, newItem.subCategory, newItem.item);
        const existingMatch = primaryLookup.get(primaryKey);

        if (!existingMatch) {
            // No match on category + subCategory + item → completely new item
            results.push({
                item: newItem,
                status: "new-item",
                message: null,
                existingItem: null,
            });
            continue;
        }

        // Category + SubCategory + Item match. Check if Specification, Days, Rate also match.
        const detailedKey = buildDetailedKey(newItem);
        const exactMatch = detailedLookup.get(detailedKey);

        if (exactMatch) {
            // Specification + Days + Rate match.
            // Check if only quantity (sqft) differs
            if (newItem.sqft !== exactMatch.sqft) {
                // Case 1: Only quantity changed
                results.push({
                    item: newItem,
                    status: "quantity-changed",
                    message:
                        "An identical item already exists in the event. Only the quantity has changed. Do you want to add this as additional quantity to the existing item?",
                    existingItem: exactMatch,
                });
            } else {
                // Case: Everything matches exactly (including quantity) - exact duplicate
                results.push({
                    item: newItem,
                    status: "exact-match",
                    message:
                        "An identical item already exists in the event with the same quantity. This will be treated as a duplicate.",
                    existingItem: exactMatch,
                });
            }
        } else {
            // Case 2: Category + SubCategory + Item match, but Specification/Days/Rate differ
            results.push({
                item: newItem,
                status: "partial-match",
                message:
                    "This item matches an existing item, but its Specification, Days, or Rate has changed. It will be treated as a new item when the additional estimate is approved.",
                existingItem: existingMatch,
            });
        }
    }

    return results;
}

/**
 * Count the number of items by match status across a comparison result set.
 */
export function summarizeComparisonResults(results: ItemComparisonResult[]): {
    exactMatchCount: number;
    quantityChangedCount: number;
    partialMatchCount: number;
    newItemCount: number;
    totalCount: number;
} {
    let exactMatchCount = 0;
    let quantityChangedCount = 0;
    let partialMatchCount = 0;
    let newItemCount = 0;

    for (const r of results) {
        switch (r.status) {
            case "exact-match":
                exactMatchCount++;
                break;
            case "quantity-changed":
                quantityChangedCount++;
                break;
            case "partial-match":
                partialMatchCount++;
                break;
            case "new-item":
                newItemCount++;
                break;
        }
    }

    return {
        exactMatchCount,
        quantityChangedCount,
        partialMatchCount,
        newItemCount,
        totalCount: results.length,
    };
}
