"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { InlineEdit } from "@/components/ui";
import { TrashIcon } from "@/components/ui/icons";
import { DEFAULT_CURRENCY_SYMBOL, DEFAULT_ITEM_COLUMNS, DEFAULT_LABELS, DEFAULT_UNIT_OPTIONS } from "@/lib/category-editor";
import type {
    CategoryEditorItemColumnSpec,
    CategoryEditorItemPatch,
    CategoryEditorLine,
    CategoryEditorLineItem,
    CategoryEditorStrings,
    CategoryEditorSubGroup,
} from "@/lib/category-editor";
import { CategoryItemRow } from "./item-row";
import { AddItemButton } from "./add-actions";

export interface SubCategoryRowProps<L extends CategoryEditorLine> {
    sub: CategoryEditorSubGroup<L>;
    disabled?: boolean;
    columns?: readonly CategoryEditorItemColumnSpec[];
    unitOptions?: readonly string[];
    currencySymbol?: string;
    totalFormatter?: (item: CategoryEditorLineItem<L>) => string;
    errorLineIds?: Set<string>;
    strings?: Partial<CategoryEditorStrings>;
    /** Receives the sub-category name input element (used for auto-focus). */
    nameInputRef?: (el: HTMLElement | null) => void;
    onRename: (newName: string) => void;
    onDelete: () => void;
    onAddItem: () => void;
    onUpdateItem: (itemId: string, patch: CategoryEditorItemPatch<L>) => void;
    onDeleteItem: (itemId: string) => void;
    registerItemFocus?: (
        itemId: string,
    ) => (field: string, el: HTMLElement | null) => void;
}

/**
 * Renders a sub-category header row, its items and its "Add Item" action.
 * Composed inside the category table, but reusable on its own.
 */
export function SubCategoryRow<L extends CategoryEditorLine>({
    sub,
    disabled = false,
    columns = DEFAULT_ITEM_COLUMNS,
    unitOptions = DEFAULT_UNIT_OPTIONS,
    currencySymbol = DEFAULT_CURRENCY_SYMBOL,
    totalFormatter,
    errorLineIds,
    strings = {},
    nameInputRef,
    onRename,
    onDelete,
    onAddItem,
    onUpdateItem,
    onDeleteItem,
    registerItemFocus,
}: SubCategoryRowProps<L>) {
    const copy: CategoryEditorStrings = { ...DEFAULT_LABELS, ...strings };
    const colSpan = columns.length + 2;

    return (
        <React.Fragment>
            <tr className="border-b border-gray-100 bg-gray-50/30">
                <td colSpan={colSpan} className="px-4 py-1.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase text-gray-400">
                                {sub.romanIndex}.
                            </span>
                            <InlineEdit
                                value={sub.name}
                                onSave={onRename}
                                placeholder={copy.subCategoryNamePlaceholder}
                                disabled={disabled}
                                className="text-sm text-gray-700"
                                data-field="sub-category-name"
                                refCb={nameInputRef}
                            />
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={disabled}
                            onClick={onDelete}
                            className="h-7 w-7 p-0 text-gray-500 hover:text-red-600"
                            title="Delete sub category"
                        >
                            <TrashIcon size={13} />
                        </Button>
                    </div>
                </td>
            </tr>
            {sub.items.map((item, itemIdx) => (
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
                    registerFocus={registerItemFocus?.(item.id)}
                />
            ))}
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
        </React.Fragment>
    );
}