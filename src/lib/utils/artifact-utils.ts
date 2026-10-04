/**
 * Artifacts-domain compatibility module for the hierarchical
 * Category → Sub Category → Item editor.
 *
 * All logic now lives in the shared, reusable `@/lib/category-editor` module.
 * This file stays as a thin facade so existing importers keep working
 * unchanged (the public API is fully preserved).
 */
import {
    calculateItemTotal,
    createCategoryMarker as createCategoryMarkerGeneric,
    createEmptyLine as createEmptyLineGeneric,
    createSubCategoryMarker as createSubCategoryMarkerGeneric,
    DEFAULT_UNIT_OPTIONS,
    flattenGroupedLines as flattenGroupedLinesGeneric,
    getCategoryNames as getCategoryNamesGeneric,
    getSubCategoryNames as getSubCategoryNamesGeneric,
    getUniqueCategoryName as getUniqueCategoryNameGeneric,
    getUniqueSubCategoryName as getUniqueSubCategoryNameGeneric,
    groupLines as groupLinesGeneric,
    isPersistableLine as isPersistableLineGeneric,
    sumItemTotals,
    type CategoryEditorGroup,
    type CategoryEditorLine,
    type CategoryEditorLineItem,
    type CategoryEditorLineKind,
    type CategoryEditorSubGroup,
} from "@/lib/category-editor";

export { generateId } from "./id";

/* ------------------------------------------------------------------ */
/*  Types (aliases of the shared generic types)                       */
/* ------------------------------------------------------------------ */

export type ArtifactLine = CategoryEditorLine;
export type ArtifactLineKind = CategoryEditorLineKind;
export type GroupedItem = CategoryEditorLineItem<ArtifactLine>;
export type GroupedSubCategory = CategoryEditorSubGroup<ArtifactLine>;
export type GroupedCategory = CategoryEditorGroup<ArtifactLine>;

/** Quantity units available in the artifact item editor. */
export const QUANTITY_UNITS = DEFAULT_UNIT_OPTIONS;
export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

/* ------------------------------------------------------------------ */
/*  Utilities (re-exported from the shared editor core)               */
/* ------------------------------------------------------------------ */

export {
    groupLinesGeneric as groupLinesByCategory,
    flattenGroupedLinesGeneric as flattenGroupedToLines,
    createEmptyLineGeneric as createEmptyLine,
    createCategoryMarkerGeneric as createCategoryMarker,
    createSubCategoryMarkerGeneric as createSubCategoryMarker,
    isPersistableLineGeneric as isPersistableArtifactLine,
    getUniqueCategoryNameGeneric as getUniqueCategoryName,
    getUniqueSubCategoryNameGeneric as getUniqueSubCategoryName,
    getCategoryNamesGeneric as getCategoryNames,
    getSubCategoryNamesGeneric as getSubCategoryNames,
};

export { calculateItemTotal as itemTotal, sumItemTotals as sumItemsTotal };
