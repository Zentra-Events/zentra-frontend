/**
 * Public barrel for the reusable Category → Sub Category → Item editor core.
 *
 * This layer is UI-agnostic: it provides types, constants, pure utilities,
 * and the state hook. The React UI lives in `@/components/category-editor`.
 */

export * from "./types";
export * from "./constants";

export {
    groupLines,
    flattenGroupedLines,
    createEmptyLine,
    createCategoryMarker,
    createSubCategoryMarker,
    isPersistableLine,
    getCategoryNames,
    getSubCategoryNames,
    getUniqueCategoryName,
    getUniqueSubCategoryName,
} from "./utils/grouping";

export {
    DEFAULT_GENERAL_CATEGORY,
    getLineCategoryName,
    insertLineAt,
    insertAtEndOfCategory,
    insertDirectItemInCategory,
    insertSubCategoryInCategory,
    insertItemInSubCategory,
    deleteCategoryLines,
    renameCategoryLines,
    deleteSubCategoryLines,
    renameSubCategoryLines,
    deleteItemLines,
    patchLineItem,
} from "./utils/line-operations";

export {
    readItemField,
    itemTextValue,
    itemNumberValue,
    itemUnitValue,
    calculateItemTotal,
    formatItemTotal,
    sumItemTotals,
} from "./utils/field";

export {
    type EditableItemField,
    buildEditableFieldOrder,
    focusElement,
    focusNextItemField,
    focusPreviousItemField,
} from "./utils/focus";

export {
    type CategoryEditorCreators,
    type CategoryEditorNaming,
    type UseCategoryEditorOptions,
    type CategoryEditorController,
    type PendingEditorFocus,
    useCategoryEditor,
} from "./hooks/useCategoryEditor";