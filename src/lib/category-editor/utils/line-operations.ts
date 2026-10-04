import type { CategoryEditorItemPatch, CategoryEditorLine } from "../types";

/**
 * Pure operations on flat line arrays. Keeping these generic over the line
 * type means the editor can be reused by any page that edits a
 * Category → Sub Category → Item structure.
 */

export const DEFAULT_GENERAL_CATEGORY = "General";

/** Resolve the effective category name of a line. */
export function getLineCategoryName<L extends CategoryEditorLine>(line: L): string {
    return line.category || DEFAULT_GENERAL_CATEGORY;
}

function getCategoryLineIndices<L extends CategoryEditorLine>(
    lines: readonly L[],
    categoryName: string,
): number[] {
    return lines
        .map((line, index) => (getLineCategoryName(line) === categoryName ? index : -1))
        .filter(index => index >= 0);
}

export function insertLineAt<L extends CategoryEditorLine>(
    lines: readonly L[],
    index: number,
    line: L,
): L[] {
    const next = [...lines];
    next.splice(index, 0, line);
    return next;
}

export function insertAtEndOfCategory<L extends CategoryEditorLine>(
    lines: readonly L[],
    categoryName: string,
    line: L,
): L[] {
    const indices = getCategoryLineIndices(lines, categoryName);
    const insertAt = indices.length > 0 ? indices[indices.length - 1] + 1 : lines.length;
    return insertLineAt(lines, insertAt, line);
}

/**
 * Insert a direct (non-sub-category) item into a category, preserving
 * creation order: direct items stay above sub-categories.
 */
export function insertDirectItemInCategory<L extends CategoryEditorLine>(
    lines: readonly L[],
    categoryName: string,
    line: L,
): L[] {
    const indices = getCategoryLineIndices(lines, categoryName);
    if (indices.length === 0) {
        return [...lines, line];
    }

    let lastDirectIdx = -1;
    let firstSubIdx = -1;

    for (const index of indices) {
        const current = lines[index];
        if (current.subCategory?.trim()) {
            if (firstSubIdx === -1) {
                firstSubIdx = index;
            }
        } else if (!current.kind || current.kind === "item" || current.kind === "category_marker") {
            lastDirectIdx = index;
        }
    }

    const insertAt =
        firstSubIdx !== -1
            ? firstSubIdx
            : lastDirectIdx !== -1
              ? lastDirectIdx + 1
              : indices[indices.length - 1] + 1;

    return insertLineAt(lines, insertAt, line);
}

/** Append a sub-category marker at the end of its category. */
export function insertSubCategoryInCategory<L extends CategoryEditorLine>(
    lines: readonly L[],
    categoryName: string,
    line: L,
): L[] {
    return insertAtEndOfCategory(lines, categoryName, line);
}

/** Insert an item into a sub-category, right after its last line. */
export function insertItemInSubCategory<L extends CategoryEditorLine>(
    lines: readonly L[],
    categoryName: string,
    subCategoryName: string,
    line: L,
): L[] {
    const indices = getCategoryLineIndices(lines, categoryName);
    if (indices.length === 0) {
        return [...lines, line];
    }

    let lastSubLineIdx = -1;
    for (const index of indices) {
        const current = lines[index];
        if ((current.subCategory?.trim() || "") === subCategoryName) {
            lastSubLineIdx = index;
        }
    }

    const insertAt = lastSubLineIdx !== -1 ? lastSubLineIdx + 1 : indices[indices.length - 1] + 1;

    return insertLineAt(lines, insertAt, line);
}

/** Remove every line belonging to a category. */
export function deleteCategoryLines<L extends CategoryEditorLine>(
    lines: readonly L[],
    categoryName: string,
): L[] {
    return lines.filter(l => getLineCategoryName(l) !== categoryName);
}

/** Rename a category on all of its lines. */
export function renameCategoryLines<L extends CategoryEditorLine>(
    lines: readonly L[],
    oldName: string,
    newName: string,
): L[] {
    return lines.map(l =>
        getLineCategoryName(l) === oldName ? ({ ...l, category: newName } as L) : l,
    );
}

/** Remove every line of a sub-category within a category. */
export function deleteSubCategoryLines<L extends CategoryEditorLine>(
    lines: readonly L[],
    categoryName: string,
    subCategoryName: string,
): L[] {
    return lines.filter(
        l => !(getLineCategoryName(l) === categoryName && l.subCategory === subCategoryName),
    );
}

/** Rename a sub-category on all matching lines. */
export function renameSubCategoryLines<L extends CategoryEditorLine>(
    lines: readonly L[],
    categoryName: string,
    oldName: string,
    newName: string,
): L[] {
    return lines.map(l =>
        getLineCategoryName(l) === categoryName && l.subCategory === oldName
            ? ({ ...l, subCategory: newName } as L)
            : l,
    );
}

/** Remove a single item line by id. */
export function deleteItemLines<L extends CategoryEditorLine>(
    lines: readonly L[],
    itemId: string,
): L[] {
    return lines.filter(l => l.id !== itemId);
}

/** Apply an item field patch onto a single line. */
export function patchLineItem<L extends CategoryEditorLine>(
    lines: readonly L[],
    itemId: string,
    patch: CategoryEditorItemPatch<L>,
): L[] {
    return lines.map(l => (l.id === itemId ? ({ ...l, ...patch } as L) : l));
}