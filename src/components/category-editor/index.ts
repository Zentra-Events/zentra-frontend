/**
 * Public barrel for the reusable Category → Sub Category → Item editor UI.
 *
 * The generic editor and its building blocks are all exported here so pages
 * can either drop in `<CategoryEditor>` directly, or compose the smaller
 * pieces (CategoryGroupCard / SubCategoryRow / CategoryItemRow / actions)
 * with their own layout.
 */

export { CategoryEditor } from "./category-editor";
export type { CategoryEditorProps } from "./category-editor";

export { AddCategoryButton, AddItemButton, AddSubCategoryButton } from "./add-actions";

export { CategoryItemRow } from "./item-row";
export type { CategoryItemRowProps } from "./item-row";

export { SubCategoryRow } from "./sub-category-row";
export type { SubCategoryRowProps } from "./sub-category-row";

export { CategoryGroupCard } from "./category-group-card";
export type { CategoryGroupCardProps } from "./category-group-card";