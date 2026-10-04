"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { InlineEdit } from "@/components/ui";
import { TrashIcon } from "@/components/ui/icons";
import { DEFAULT_CURRENCY_SYMBOL, DEFAULT_ITEM_COLUMNS, DEFAULT_LABELS, DEFAULT_UNIT_OPTIONS } from "@/lib/category-editor";
import type {
    CategoryEditorGroup,
    CategoryEditorGroupFocusState,
    CategoryEditorItemColumnSpec,
    CategoryEditorItemPatch,
    CategoryEditorLine,
    CategoryEditorLineItem,
    CategoryEditorStrings,
} from "@/lib/category-editor";
import { CategoryItemRow } from "./item-row";
import { SubCategoryRow } from "./sub-category-row";
import { AddItemButton, AddSubCategoryButton } from "./add-actions";

export interface CategoryGroupCardProps<L extends CategoryEditorLine> {
    group: CategoryEditorGroup<L>;
    disabled?: boolean;
    columns?: readonly CategoryEditorItemColumnSpec[];
    unitOptions?: readonly string[];
    currencySymbol?: string;
    totalFormatter?: (item: CategoryEditorLineItem<L>) => string;
    errorLineIds?: Set<string>;
    strings?: Partial<CategoryEditorStrings>;
    onRename: (newName: string) => void;
    onDelete: () => void;
    onAddSubCategory: () => void;
    onAddItem: () => void;
    onDeleteSubCategory: (subName: string) => void;
    onRenameSubCategory: (oldName: string, newName: string) => void;
    onAddItemToSubCategory: (subName: string) => void;
    onUpdateItem: (itemId: string, patch: CategoryEditorItemPatch<L>) => void;
    onDeleteItem: (itemId: string) => void;
    focusState: CategoryEditorGroupFocusState;
    onFocusSignalHandled: () => void;
}

/**
 * Renders one category: header (rename / sub-category / delete), the item
 * table, and per-sub-category sections. All data flows through props.
 */
export function CategoryGroupCard<L extends CategoryEditorLine>({
    group,
    disabled = false,
    columns = DEFAULT_ITEM_COLUMNS,
    unitOptions = DEFAULT_UNIT_OPTIONS,
    currencySymbol = DEFAULT_CURRENCY_SYMBOL,
    totalFormatter,
    errorLineIds,
    strings = {},
    onRename,
    onDelete,
    onAddSubCategory,
    onAddItem,
    onDeleteSubCategory,
    onRenameSubCategory,
    onAddItemToSubCategory,
    onUpdateItem,
    onDeleteItem,
    focusState,
    onFocusSignalHandled,
}: CategoryGroupCardProps<L>) {
    const copy: CategoryEditorStrings = { ...DEFAULT_LABELS, ...strings };
    const categoryHeaderRef = useRef<HTMLDivElement>(null);
    const subCategoryInputsRef = useRef<Map<string, HTMLElement | null>>(new Map());

    /* ---- Auto-focus Category Name after adding a category ---- */
    useEffect(() => {
        if (focusState.focusSignal > 0) {
            requestAnimationFrame(() => {
                const catEdit = categoryHeaderRef.current?.querySelector<HTMLElement>(
                    '[data-field="category-name"]',
                );
                if (catEdit) {
                    catEdit.click();
                }
                onFocusSignalHandled();
            });
        }
    }, [focusState.focusSignal, onFocusSignalHandled]);

    /* ---- Auto-focus Sub Category Name after adding a sub-category ---- */
    useEffect(() => {
        if (focusState.focusSubCategoryId && focusState.focusSubCategorySignal > 0) {
            requestAnimationFrame(() => {
                const input = subCategoryInputsRef.current.get(focusState.focusSubCategoryId);
                if (input) {
                    input.click();
                }
                onFocusSignalHandled();
            });
        }
    }, [focusState.focusSubCategoryId, focusState.focusSubCategorySignal, onFocusSignalHandled]);

    /* ---- Keyboard navigation / auto-focus for items ---- */
    const itemFocusRef = useRef<Map<string, Map<string, HTMLElement | null>>>(new Map());

    const registerItemFocus = useCallback(
        (itemId: string) => (field: string, el: HTMLElement | null) => {
            if (!el) return;
            if (!itemFocusRef.current.has(itemId)) {
                itemFocusRef.current.set(itemId, new Map());
            }
            itemFocusRef.current.get(itemId)!.set(field, el);
        },
        [],
    );

    // The primary field to focus after adding an item = first text column.
    const focusItemFieldName = useMemo(() => {
        const firstText = columns.find(c => c.type === "text");
        return firstText ? firstText.field : "item";
    }, [columns]);

    /* ---- Auto-focus Item Name after adding an item ---- */
    useEffect(() => {
        if (focusState.itemToFocusId && focusState.itemFocusSignal > 0) {
            requestAnimationFrame(() => {
                const itemFields = itemFocusRef.current.get(focusState.itemToFocusId);
                const itemField = itemFields?.get(focusItemFieldName);
                if (itemField) {
                    itemField.click();
                }
                onFocusSignalHandled();
            });
        }
    }, [
        focusState.itemToFocusId,
        focusState.itemFocusSignal,
        focusItemFieldName,
        onFocusSignalHandled,
    ]);

    const colSpan = columns.length + 2;
    const showTable = group.subCategories.length > 0 || group.directItems.length > 0;

    return (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
            {/* ---- Category Header ---- */}
            <div
                ref={categoryHeaderRef}
                className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-4 py-2.5"
            >
                <div className="flex items-center gap-2">
                    <InlineEdit
                        value={group.name}
                        onSave={onRename}
                        placeholder={copy.categoryNamePlaceholder}
                        disabled={disabled}
                        className="font-medium text-gray-900"
                        data-field="category-name"
                    />
                </div>
                <div className="flex items-center gap-1">
                    <AddSubCategoryButton
                        label={copy.addSubCategory}
                        disabled={disabled}
                        onClick={onAddSubCategory}
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        onClick={onDelete}
                        className="h-7 w-7 p-0 text-gray-500 hover:text-red-600"
                        title="Delete category"
                    >
                        <TrashIcon size={14} />
                    </Button>
                </div>
            </div>

            {/* ---- Table with single header for all items ---- */}
            {showTable && (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-200 bg-gray-50">
                                <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">
                                    #
                                </th>
                                {columns.map(column => (
                                    <th
                                        key={column.field}
                                        className={cn(
                                            "px-2 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600",
                                            column.align === "left"
                                                ? "text-left"
                                                : column.align === "right"
                                                  ? "text-right"
                                                  : "text-center",
                                        )}
                                    >
                                        {column.label}
                                    </th>
                                ))}
                                <th className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-600" />
                            </tr>
                        </thead>
                        <tbody>
                            {/* ---- Direct items under category ---- */}
                            {group.directItems.map((item, itemIdx) => (
                                <CategoryItemRow
                                    key={item.id}
                                    item={item}
                                    index={itemIdx + 1}
                                    disabled={disabled}
                                    columns={columns}
                                    unitOptions={unitOptions}
                                    currencySymbol={currencySymbol}
                                    totalFormatter={totalFormatter}
                                    hasError={errorLineIds ? errorLineIds.has(item.id) : false}
                                    onChange={patch => onUpdateItem(item.id, patch)}
                                    onDelete={() => onDeleteItem(item.id)}
                                    registerFocus={registerItemFocus(item.id)}
                                />
                            ))}

                            {/* ---- Category-level Add Item (when sub categories exist) ---- */}
                            {group.subCategories.length > 0 && (
                                <tr>
                                    <td colSpan={colSpan} className="px-6 py-1">
                                        <div className="flex flex-col gap-1 px-6 py-2">
                                            <AddItemButton
                                                label={copy.addItem}
                                                disabled={disabled}
                                                onClick={onAddItem}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            )}
{/* ---- Sub Categories ---- */}
                            {group.subCategories.map(sub => (
                                <SubCategoryRow
                                    key={sub.id}
                                    sub={sub}
                                    disabled={disabled}
                                    columns={columns}
                                    unitOptions={unitOptions}
                                    currencySymbol={currencySymbol}
                                    totalFormatter={totalFormatter}
                                    errorLineIds={errorLineIds}
                                    strings={copy}
                                    nameInputRef={el => subCategoryInputsRef.current.set(sub.id, el)}
                                    onRename={newName => onRenameSubCategory(sub.name, newName)}
                                    onDelete={() => onDeleteSubCategory(sub.name)}
                                    onAddItem={() => onAddItemToSubCategory(sub.name)}
                                    onUpdateItem={onUpdateItem}
                                    onDeleteItem={onDeleteItem}
                                    registerItemFocus={registerItemFocus}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add item button */}
            <div className="flex flex-col gap-1 px-6 py-2">
                {group.subCategories.length === 0 && (
                    <AddItemButton
                        label={copy.addItem}
                        disabled={disabled}
                        onClick={onAddItem}
                    />
                )}
            </div>
        </div>
    );
}