/**
 * Shared types for the reusable Category → Sub Category → Item editor.
 *
 * The editor is generic over `L extends CategoryEditorLine`, so pages can
 * reuse it with their own line type as long as it carries the structural
 * fields the editor needs (id / category / subCategory / kind plus the
 * standard item fields). Extra page-specific fields are preserved through
 * grouping, flattening, inserts and patches.
 */

export type CategoryEditorLineKind = "item" | "category_marker" | "subcategory_marker";

/** A flat, ordered line usable by the category editor. */
export interface CategoryEditorLine {
    id: string;
    category: string;
    subCategory: string;
    kind?: CategoryEditorLineKind;
    item: string;
    specification: string;
    days: number;
    sqft: number;
    rate: number;
    vendor: string;
    unit?: string;
}

/** An item with its row-scoped fields (no category/subCategory/kind context). */
export type CategoryEditorLineItem<L extends CategoryEditorLine> = {
    id: string;
} & Omit<L, "id" | "category" | "subCategory" | "kind">;

/** Field-level patch applied to a flat line (used by inline editors). */
export type CategoryEditorItemPatch<L extends CategoryEditorLine> = Partial<
    CategoryEditorLineItem<L>
>;

export interface CategoryEditorSubGroup<L extends CategoryEditorLine> {
    id: string;
    name: string;
    items: CategoryEditorLineItem<L>[];
    romanIndex: string;
}

export interface CategoryEditorGroup<L extends CategoryEditorLine> {
    id: string;
    name: string;
    directItems: CategoryEditorLineItem<L>[];
    subCategories: CategoryEditorSubGroup<L>[];
}

/* ------------------------------------------------------------------ */
/*  Item column configuration                                          */
/* ------------------------------------------------------------------ */

export type CategoryEditorFieldType = "text" | "number" | "unit" | "total";

/**
 * Describes one editable/computed column of the item table. Columns drive
 * the table header, cell rendering, and in-row keyboard navigation order.
 */
export interface CategoryEditorItemColumnSpec {
    /** Item field name; also used as the `data-field` for keyboard nav. */
    field: string;
    /** Table header label. */
    label: string;
    type: CategoryEditorFieldType;
    align?: "left" | "center" | "right";
    placeholder?: string;
    min?: number;
    step?: number;
    /** Static prefix rendered next to the field (e.g. a currency symbol). */
    prefix?: string;
    /** Extra className applied to the inline editor (preserves look & feel). */
    className?: string;
    /** Marks numeric fields that contribute to the computed row total. */
    contributesToTotal?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Focus coordination                                                 */
/* ------------------------------------------------------------------ */

export type CategoryEditorFocusKind = "category" | "subcategory" | "item";

/** Focus signal sent down to a single category card. */
export interface CategoryEditorGroupFocusState {
    focusSignal: number;
    focusSubCategoryId: string;
    focusSubCategorySignal: number;
    itemToFocusId: string;
    itemFocusSignal: number;
}