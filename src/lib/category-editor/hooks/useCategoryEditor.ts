import { useCallback, useMemo, useState } from "react";
import { DEFAULT_LABELS } from "../constants";
import type {
    CategoryEditorFocusKind,
    CategoryEditorGroup,
    CategoryEditorGroupFocusState,
    CategoryEditorItemPatch,
    CategoryEditorLine,
} from "../types";
import {
    createCategoryMarker,
    createEmptyLine,
    createSubCategoryMarker,
    getUniqueCategoryName as createUniqueCategoryName,
    getUniqueSubCategoryName as createUniqueSubCategoryName,
    groupLines,
} from "../utils/grouping";
import {
    DEFAULT_GENERAL_CATEGORY,
    deleteCategoryLines,
    deleteItemLines,
    deleteSubCategoryLines,
    insertDirectItemInCategory,
    insertItemInSubCategory,
    insertSubCategoryInCategory,
    patchLineItem,
    renameCategoryLines,
    renameSubCategoryLines,
} from "../utils/line-operations";

/** Factories used to create new lines; override to extend the line shape. */
export interface CategoryEditorCreators<L extends CategoryEditorLine> {
    createCategoryLine: (name: string) => L;
    createSubCategoryLine: (category: string, name: string) => L;
    createItemLine: (category: string, subCategory: string) => L;
}

/** Naming strategies for automatically created categories/sub-categories. */
export interface CategoryEditorNaming<L extends CategoryEditorLine> {
    uniqueCategoryName: (lines: L[]) => string;
    uniqueSubCategoryName: (lines: L[], category: string) => string;
}

export interface UseCategoryEditorOptions<L extends CategoryEditorLine> {
    creators?: Partial<CategoryEditorCreators<L>>;
    naming?: Partial<CategoryEditorNaming<L>>;
}

/** A queued focus request that is resolved after the next render. */
export interface PendingEditorFocus {
    kind: CategoryEditorFocusKind;
    categoryId: string;
    categoryName?: string;
    subCategoryId?: string;
    itemId?: string;
    signal: number;
}

export interface CategoryEditorController<L extends CategoryEditorLine> {
    groups: CategoryEditorGroup<L>[];
    addCategory: () => void;
    deleteCategory: (categoryName: string) => void;
    renameCategory: (oldName: string, newName: string) => void;
    addSubCategory: (categoryName: string) => void;
    deleteSubCategory: (categoryName: string, subCategoryName: string) => void;
    renameSubCategory: (
        categoryName: string,
        oldName: string,
        newName: string,
    ) => void;
    addItemToCategory: (categoryName: string) => void;
    addItemToSubCategory: (categoryName: string, subCategoryName: string) => void;
    addItemWithoutCategory: () => void;
    updateItem: (itemId: string, patch: CategoryEditorItemPatch<L>) => void;
    deleteItem: (itemId: string) => void;
    getFocusState: (group: CategoryEditorGroup<L>) => CategoryEditorGroupFocusState;
    focusHandled: () => void;
}

/**
 * State + operations for the Category → Sub Category → Item editor.
 * Pages just pass flat lines + an onChange callback; all structural
 * mutations, ordering rules and focus scheduling live here.
 */
export function useCategoryEditor<L extends CategoryEditorLine>(
    lines: L[],
    onLinesChange: (lines: L[]) => void,
    options: UseCategoryEditorOptions<L> = {},
): CategoryEditorController<L> {
    const groups = useMemo(() => groupLines(lines), [lines]);
    const [pendingFocus, setPendingFocus] = useState<PendingEditorFocus | null>(null);

    const creators = useMemo<CategoryEditorCreators<L>>(
        () => ({
            createCategoryLine: name => createCategoryMarker(name) as L,
            createSubCategoryLine: (category, name) =>
                createSubCategoryMarker(category, name) as L,
            createItemLine: (category, subCategory) =>
                createEmptyLine(category, subCategory) as L,
            ...options.creators,
        }),
        [options.creators],
    );

    const naming = useMemo<CategoryEditorNaming<L>>(
        () => ({
            uniqueCategoryName: currentLines =>
                createUniqueCategoryName(currentLines, DEFAULT_LABELS.newCategoryName),
            uniqueSubCategoryName: (currentLines, category) =>
                createUniqueSubCategoryName(
                    currentLines,
                    category,
                    DEFAULT_LABELS.newSubCategoryName,
                ),
            ...options.naming,
        }),
        [options.naming],
    );

    const commit = useCallback(
        (nextLines: L[]) => {
            onLinesChange(nextLines);
        },
        [onLinesChange],
    );

    const queueFocus = useCallback((next: PendingEditorFocus) => {
        setPendingFocus(next);
    }, []);

    const focusHandled = useCallback(() => {
        setPendingFocus(prev => (prev ? { ...prev, signal: 0 } : prev));
    }, []);

    const findCategoryId = useCallback(
        (categoryName: string): string => {
            const group = groups.find(g => g.name === categoryName);
            return group ? group.id : "";
        },
        [groups],
    );

    const findSubCategoryId = useCallback(
        (categoryName: string, subCategoryName: string): string => {
            const group = groups.find(g => g.name === categoryName);
            if (!group) return "";
            const sub = group.subCategories.find(s => s.name === subCategoryName);
            return sub ? sub.id : "";
        },
        [groups],
    );

    /* ---- Category operations ---- */

    const addCategory = useCallback(() => {
        const name = naming.uniqueCategoryName(lines);
        const marker = creators.createCategoryLine(name);
        commit([...lines, marker]);
        // Queue focus for the new category name input (after render).
        // The category id is derived by groupLines from the first line,
        // so the pending focus matches the new card by name.
        queueFocus({
            kind: "category",
            categoryId: marker.id,
            categoryName: name,
            signal: Date.now(),
        });
    }, [lines, commit, queueFocus, creators, naming]);

    const deleteCategory = useCallback(
        (categoryName: string) => {
            commit(deleteCategoryLines(lines, categoryName));
        },
        [lines, commit],
    );

    const renameCategory = useCallback(
        (oldName: string, newName: string) => {
            if (!newName || oldName === newName) return;
            commit(renameCategoryLines(lines, oldName, newName));
        },
        [lines, commit],
    );

    /* ---- Sub-category operations ---- */

    const addSubCategory = useCallback(
        (categoryName: string) => {
            const subName = naming.uniqueSubCategoryName(lines, categoryName);
            const marker = creators.createSubCategoryLine(categoryName, subName);
            commit(insertSubCategoryInCategory(lines, categoryName, marker));
            queueFocus({
                kind: "subcategory",
                categoryId: findCategoryId(categoryName),
                categoryName,
                subCategoryId: marker.id,
                signal: Date.now(),
            });
        },
        [lines, commit, queueFocus, findCategoryId, creators, naming],
    );

    const deleteSubCategory = useCallback(
        (categoryName: string, subCategoryName: string) => {
            commit(deleteSubCategoryLines(lines, categoryName, subCategoryName));
        },
        [lines, commit],
    );

    const renameSubCategory = useCallback(
        (categoryName: string, oldName: string, newName: string) => {
            if (!newName || oldName === newName) return;
            commit(renameSubCategoryLines(lines, categoryName, oldName, newName));
        },
        [lines, commit],
    );
/* ---- Item operations ---- */

    const addItemToCategory = useCallback(
        (categoryName: string) => {
            const newItem = creators.createItemLine(categoryName, "");
            // Resolve the grouped category id before committing; it stays
            // stable across re-renders so the focus lands on the right card.
            const categoryId = findCategoryId(categoryName);
            commit(insertDirectItemInCategory(lines, categoryName, newItem));
            if (categoryId) {
                queueFocus({
                    kind: "item",
                    categoryId,
                    categoryName,
                    itemId: newItem.id,
                    signal: Date.now(),
                });
            }
        },
        [lines, commit, findCategoryId, queueFocus, creators],
    );

    const addItemToSubCategory = useCallback(
        (categoryName: string, subCategoryName: string) => {
            const newItem = creators.createItemLine(categoryName, subCategoryName);
            const categoryId = findCategoryId(categoryName);
            const subCategoryId = findSubCategoryId(categoryName, subCategoryName);
            commit(insertItemInSubCategory(lines, categoryName, subCategoryName, newItem));
            if (categoryId) {
                queueFocus({
                    kind: "item",
                    categoryId,
                    categoryName,
                    subCategoryId: subCategoryId || undefined,
                    itemId: newItem.id,
                    signal: Date.now(),
                });
            }
        },
        [lines, commit, findCategoryId, findSubCategoryId, queueFocus, creators],
    );

    const addItemWithoutCategory = useCallback(() => {
        // Create an item with no explicit category so it is not grouped.
        // getLineCategoryName falls back to DEFAULT_GENERAL_CATEGORY ("General"),
        // so the line is bucketed under a top-level "General" group on render.
        const newItem = creators.createItemLine("", "");
        commit([...lines, newItem]);
        queueFocus({
            kind: "item",
            categoryId: "",
            categoryName: DEFAULT_GENERAL_CATEGORY,
            itemId: newItem.id,
            signal: Date.now(),
        });
    }, [lines, commit, queueFocus, creators]);

    const updateItem = useCallback(
        (itemId: string, patch: CategoryEditorItemPatch<L>) => {
            commit(patchLineItem(lines, itemId, patch));
        },
        [lines, commit],
    );

    const deleteItem = useCallback(
        (itemId: string) => {
            commit(deleteItemLines(lines, itemId));
        },
        [lines, commit],
    );
/* ---- Per-card focus state ---- */

    const getFocusState = useCallback(
        (group: CategoryEditorGroup<L>): CategoryEditorGroupFocusState => {
            const matches =
                pendingFocus != null &&
                (pendingFocus.categoryId === group.id || pendingFocus.categoryName === group.name);

            return {
                focusSignal:
                    pendingFocus?.kind === "category" && matches && pendingFocus.signal > 0
                        ? pendingFocus.signal
                        : 0,
                focusSubCategoryId:
                    pendingFocus?.kind === "subcategory" && matches
                        ? pendingFocus.subCategoryId || ""
                        : "",
                focusSubCategorySignal:
                    pendingFocus?.kind === "subcategory" && matches ? pendingFocus.signal : 0,
                itemToFocusId:
                    pendingFocus?.kind === "item" && matches ? pendingFocus.itemId || "" : "",
                itemFocusSignal:
                    pendingFocus?.kind === "item" && matches && pendingFocus.signal > 0
                        ? pendingFocus.signal
                        : 0,
            };
        },
        [pendingFocus],
    );

    return {
        groups,
        addCategory,
        deleteCategory,
        renameCategory,
        addSubCategory,
        deleteSubCategory,
        renameSubCategory,
        addItemToCategory,
        addItemToSubCategory,
        addItemWithoutCategory,
        updateItem,
        deleteItem,
        getFocusState,
        focusHandled,
    };
}