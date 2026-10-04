import { toRomanLower } from "@/lib/utils";
import { generateId } from "@/lib/utils/id";
import type {
    CategoryEditorGroup,
    CategoryEditorLine,
    CategoryEditorLineItem,
    CategoryEditorSubGroup,
} from "../types";
import { getLineCategoryName } from "./line-operations";

/* ------------------------------------------------------------------ */
/*  Group flat lines into hierarchical structure                       */
/* ------------------------------------------------------------------ */

export function groupLines<L extends CategoryEditorLine>(
    lines: readonly L[],
): CategoryEditorGroup<L>[] {
    const groupMap = new Map<
        string,
        {
            name: string;
            firstLineId: string;
            directItems: CategoryEditorLineItem<L>[];
            subCategoryMap: Map<string, { id: string; name: string; items: CategoryEditorLineItem<L>[] }>;
        }
    >();

    for (const line of lines) {
        const catName = getLineCategoryName(line);
        if (!groupMap.has(catName)) {
            groupMap.set(catName, {
                name: catName,
                firstLineId: line.id,
                directItems: [],
                subCategoryMap: new Map(),
            });
        }
        const group = groupMap.get(catName)!;
        const kind = line.kind ?? "item";

        if (kind === "category_marker") {
            continue;
        }

        if (kind === "subcategory_marker") {
            const subName = line.subCategory.trim();
            if (!group.subCategoryMap.has(subName)) {
                group.subCategoryMap.set(subName, {
                    id: line.id,
                    name: subName,
                    items: [],
                });
            }
            continue;
        }

        const item: CategoryEditorLineItem<L> = {
            id: line.id,
            item: line.item,
            specification: line.specification,
            days: line.days,
            sqft: line.sqft,
            rate: line.rate,
            vendor: line.vendor,
            unit: line.unit || "nos",
        } as CategoryEditorLineItem<L>;

        if (line.subCategory && line.subCategory.trim()) {
            const subName = line.subCategory.trim();
            if (!group.subCategoryMap.has(subName)) {
                group.subCategoryMap.set(subName, {
                    id: generateId(),
                    name: subName,
                    items: [],
                });
            }
            group.subCategoryMap.get(subName)!.items.push(item);
        } else {
            group.directItems.push(item);
        }
    }

    const result: CategoryEditorGroup<L>[] = [];
    let groupIndex = 0;
    for (const [, group] of groupMap) {
        groupIndex++;
        const subCategories: CategoryEditorSubGroup<L>[] = [];
        let subIndex = 0;
        for (const [, sub] of group.subCategoryMap) {
            subIndex++;
            subCategories.push({
                ...sub,
                romanIndex: toRomanLower(subIndex),
            });
        }
        result.push({
            // Derive the id from the first line of the category so it stays
            // stable across re-renders (adding sub-categories / items must not
            // change the category id used as a React key and focus target).
            id: `cat-${groupIndex}-${group.firstLineId}`,
            name: group.name,
            directItems: group.directItems,
            subCategories,
        });
    }
    return result;
}

/* ------------------------------------------------------------------ */
/*  Flatten grouped structure back to flat lines                       */
/* ------------------------------------------------------------------ */

export function flattenGroupedLines<L extends CategoryEditorLine>(
    groups: readonly CategoryEditorGroup<L>[],
): L[] {
    const lines: L[] = [];

    for (const group of groups) {
        for (const item of group.directItems) {
            lines.push({
                id: item.id,
                category: group.name,
                subCategory: "",
                item: item.item,
                specification: item.specification,
                days: item.days,
                sqft: item.sqft,
                rate: item.rate,
                vendor: item.vendor,
                unit: item.unit || "nos",
            } as L);
        }
        for (const sub of group.subCategories) {
            for (const item of sub.items) {
                lines.push({
                    id: item.id,
                    category: group.name,
                    subCategory: sub.name,
                    item: item.item,
                    specification: item.specification,
                    days: item.days,
                    sqft: item.sqft,
                    rate: item.rate,
                    vendor: item.vendor,
                    unit: item.unit || "nos",
                } as L);
            }
        }
    }
    return lines;
}

/* ------------------------------------------------------------------ */
/*  Factories for new lines / markers                                  */
/* ------------------------------------------------------------------ */

export function createEmptyLine(category: string, subCategory = ""): CategoryEditorLine {
    return {
        id: generateId(),
        category,
        subCategory,
        item: "",
        specification: "",
        days: 1,
        sqft: 1,
        rate: 0,
        vendor: "",
        kind: "item",
        unit: "nos",
    };
}

export function createCategoryMarker(category: string): CategoryEditorLine {
    return {
        id: generateId(),
        category,
        subCategory: "",
        item: "",
        specification: "",
        days: 1,
        sqft: 1,
        rate: 0,
        vendor: "",
        kind: "category_marker",
        unit: "nos",
    };
}

export function createSubCategoryMarker(category: string, subCategory: string): CategoryEditorLine {
    return {
        id: generateId(),
        category,
        subCategory,
        item: "",
        specification: "",
        days: 1,
        sqft: 1,
        rate: 0,
        vendor: "",
        kind: "subcategory_marker",
        unit: "nos",
    };
}

/** True when a line is a real item (not a category/sub-category marker). */
export function isPersistableLine<L extends CategoryEditorLine>(line: L): boolean {
    return !line.kind || line.kind === "item";
}

/* ------------------------------------------------------------------ */
/*  Name uniqueness helpers                                            */
/* ------------------------------------------------------------------ */

export function getCategoryNames<L extends CategoryEditorLine>(
    lines: readonly L[],
): string[] {
    return [...new Set(lines.map(getLineCategoryName))];
}

export function getSubCategoryNames<L extends CategoryEditorLine>(
    lines: readonly L[],
    category: string,
): string[] {
    return [
        ...new Set(
            lines
                .filter(l => getLineCategoryName(l) === category && l.subCategory)
                .map(l => l.subCategory),
        ),
    ].filter(Boolean);
}

export function getUniqueCategoryName<L extends CategoryEditorLine>(
    lines: readonly L[],
    baseName = "New Category",
): string {
    const existing = new Set(lines.map(getLineCategoryName));
    let name = baseName;
    let counter = 1;
    while (existing.has(name)) {
        name = `${baseName} ${counter++}`;
    }
    return name;
}

export function getUniqueSubCategoryName<L extends CategoryEditorLine>(
    lines: readonly L[],
    category: string,
    baseName = "New Sub Category",
): string {
    const existing = new Set(getSubCategoryNames(lines, category));
    let name = baseName;
    let counter = 1;
    while (existing.has(name)) {
        name = `${baseName} ${counter++}`;
    }
    return name;
}