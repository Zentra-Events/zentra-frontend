/**
 * Generic, reusable Category → Sub Category → Item grouping utilities.
 *
 * This module is the single source of truth for grouping flat lists of items
 * into a hierarchical structure. It is UI-agnostic and works with any item
 * shape that exposes `category` and an optional `subCategory` field.
 *
 * Two flavours are exposed:
 *  - `groupByCategory`      → hierarchical (Category → Sub Category → Items)
 *  - `groupItemsByCategory` → flat        (Category → Items) for category-only views
 *
 * Both preserve the original ordering of categories, sub-categories and items.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Minimal shape an item must expose to be groupable. */
export interface Groupable {
    category?: string | null;
    subCategory?: string | null;
}

/** A group of items sharing the same sub-category. */
export interface SubCategoryGroup<T> {
    name: string;
    items: T[];
}

/** A category containing direct items and (optionally) sub-category groups. */
export interface CategoryGroup<T> {
    name: string;
    directItems: T[];
    subCategories: SubCategoryGroup<T>[];
}

/** Options that tweak how grouping resolves missing categories. */
export interface GroupingOptions {
    /**
     * Fallback category name used when an item has no category.
     * Defaults to "Uncategorized".
     */
    defaultCategory?: string;
}

/* ------------------------------------------------------------------ */
/*  Internal resolvers                                                 */
/* ------------------------------------------------------------------ */

const DEFAULT_CATEGORY = "Uncategorized";

/** Resolve the effective, trimmed category name of an item. */
function resolveCategoryName<T extends Groupable>(
    item: T,
    fallback: string,
): string {
    const value = item.category;
    return typeof value === "string" && value.trim()
        ? value.trim()
        : fallback;
}

/** Resolve the effective, trimmed sub-category name of an item (or null). */
function resolveSubCategoryName<T extends Groupable>(item: T): string | null {
    const value = item.subCategory;
    return typeof value === "string" && value.trim()
        ? value.trim()
        : null;
}

/* ------------------------------------------------------------------ */
/*  Hierarchical grouping: Category → Sub Category → Items             */
/* ------------------------------------------------------------------ */

/**
 * Group a flat list of items into a Category → Sub Category → Item hierarchy.
 *
 * Within each category:
 *  - Items without a sub-category are collected first (`directItems`).
 *  - The remaining items are grouped under their respective sub-category
 *    headers, in order of first appearance.
 *  - An empty sub-category header is never produced.
 *
 * When no item carries a sub-category, every item lands in `directItems`,
 * effectively yielding a "group by category only" result. Original ordering
 * is preserved within each group.
 */
export function groupByCategory<T extends Groupable>(
    items: readonly T[],
    options?: GroupingOptions,
): CategoryGroup<T>[] {
    const fallback = options?.defaultCategory ?? DEFAULT_CATEGORY;

    const order: string[] = [];
    const map = new Map<
        string,
        {
            directItems: T[];
            subOrder: string[];
            subMap: Map<string, T[]>;
        }
    >();

    for (const item of items) {
        const category = resolveCategoryName(item, fallback);

        let group = map.get(category);
        if (!group) {
            group = {
                directItems: [],
                subOrder: [],
                subMap: new Map<string, T[]>(),
            };
            map.set(category, group);
            order.push(category);
        }

        const sub = resolveSubCategoryName(item);
        if (sub) {
            if (!group.subMap.has(sub)) {
                group.subMap.set(sub, []);
                group.subOrder.push(sub);
            }
            group.subMap.get(sub)!.push(item);
        } else {
            group.directItems.push(item);
        }
    }

    return order.map(category => {
        const group = map.get(category)!;
        const subCategories: SubCategoryGroup<T>[] = group.subOrder.map(
            name => ({ name, items: group.subMap.get(name)! }),
        );
        return {
            name: category,
            directItems: group.directItems,
            subCategories,
        };
    });
}

/* ------------------------------------------------------------------ */
/*  Flat grouping: Category → Items (category only)                   */
/* ------------------------------------------------------------------ */

/**
 * Flat category-only grouping. Returns a `Map` keyed by category, preserving
 * insertion order and the original ordering of items within each category.
 *
 * Useful for views that only need a "Group by Category" result without
 * sub-category nesting.
 */
export function groupItemsByCategory<T extends Groupable>(
    items: readonly T[],
    options?: GroupingOptions,
): Map<string, T[]> {
    const fallback = options?.defaultCategory ?? DEFAULT_CATEGORY;
    const map = new Map<string, T[]>();

    for (const item of items) {
        const category = resolveCategoryName(item, fallback);
        const list = map.get(category);
        if (list) {
            list.push(item);
        } else {
            map.set(category, [item]);
        }
    }

    return map;
}

/* ------------------------------------------------------------------ */
/*  Flattening helpers                                                */
/* ------------------------------------------------------------------ */

/**
 * Flatten a hierarchical grouping back into a single ordered array.
 *
 * Within each category, direct items come first, followed by each
 * sub-category's items in order. Category and sub-category ordering is
 * preserved.
 */
export function flattenCategoryGroups<T>(
    groups: readonly CategoryGroup<T>[],
): T[] {
    return groups.flatMap(group => [
        ...group.directItems,
        ...group.subCategories.flatMap(sub => sub.items),
    ]);
}

/**
 * Flatten a flat category map into a single ordered array, preserving the
 * category and item ordering of the map.
 */
export function flattenItemsByCategory<T>(
    grouped: ReadonlyMap<string, T[]>,
): T[] {
    return Array.from(grouped.values()).flatMap(items => items);
}
