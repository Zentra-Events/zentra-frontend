"use client";

import React, { useMemo, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { InlineEdit, InlineNumber, InlineUnitSelect } from "@/components/ui";
import { TrashIcon } from "@/components/ui/icons";
import { DEFAULT_CURRENCY_SYMBOL, DEFAULT_ITEM_COLUMNS, DEFAULT_UNIT_OPTIONS } from "@/lib/category-editor";
import type {
    CategoryEditorItemColumnSpec,
    CategoryEditorItemPatch,
    CategoryEditorLine,
    CategoryEditorLineItem,
} from "@/lib/category-editor";
import {
    formatItemTotal,
    itemNumberValue,
    itemTextValue,
    itemUnitValue,
} from "@/lib/category-editor";
import {
    buildEditableFieldOrder,
    focusNextItemField,
    focusPreviousItemField,
} from "@/lib/category-editor";

export interface CategoryItemRowProps<L extends CategoryEditorLine> {
    item: CategoryEditorLineItem<L>;
    /** 1-based display index. */
    index: number;
    disabled?: boolean;
    columns?: readonly CategoryEditorItemColumnSpec[];
    unitOptions?: readonly string[];
    currencySymbol?: string;
    totalFormatter?: (item: CategoryEditorLineItem<L>) => string;
    hasError?: boolean;
    onChange: (patch: CategoryEditorItemPatch<L>) => void;
    onDelete: () => void;
    registerFocus?: (field: string, el: HTMLElement | null) => void;
}

/**
 * A single editable item row. Columns are rendered from `columns`, so the
 * same row works for any category editor without page-specific logic.
 */
export function CategoryItemRow<L extends CategoryEditorLine>({
    item,
    index,
    disabled = false,
    columns = DEFAULT_ITEM_COLUMNS,
    unitOptions = DEFAULT_UNIT_OPTIONS,
    currencySymbol = DEFAULT_CURRENCY_SYMBOL,
    totalFormatter,
    hasError = false,
    onChange,
    onDelete,
    registerFocus,
}: CategoryItemRowProps<L>) {
    const rowRef = useRef<HTMLTableRowElement>(null);

    const fieldOrder = useMemo(() => buildEditableFieldOrder(columns), [columns]);

    const totalColumn = columns.find(column => column.type === "total");
    const total = totalColumn
        ? totalFormatter
            ? totalFormatter(item)
            : formatItemTotal(item, columns, currencySymbol)
        : undefined;

    const handleKeyDown =
        (field: string) => (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Tab") {
                const row = rowRef.current;
                if (!row) return;

                const buttons = Array.from(
                    row.querySelectorAll<HTMLButtonElement>("button[data-field]"),
                );

                if (!e.shiftKey) {
                    // Moving forward through the item fields.
                    const moved = focusNextItemField(row, field, fieldOrder, buttons);
                    if (moved) {
                        e.preventDefault();
                    }
                    // If no next field, allow default tab behavior.
                } else {
                    // Shift+Tab: move to the previous field.
                    const moved = focusPreviousItemField(row, field, fieldOrder, buttons);
                    if (moved) {
                        e.preventDefault();
                    }
                    // If no previous field inside the row, allow default Shift+Tab.
                }
            } else if (e.key === "Enter" && !e.shiftKey) {
                // Enter saves the current field, then moves to the next one.
                const row = rowRef.current;
                if (!row) return;

                const buttons = Array.from(
                    row.querySelectorAll<HTMLButtonElement>("button[data-field]"),
                );
                const moved = focusNextItemField(row, field, fieldOrder, buttons);
                if (moved) {
                    e.preventDefault();
                }
            }
        };
    const renderColumn = (column: CategoryEditorItemColumnSpec) => {
        const cellClass =
            column.align === "left" ? "px-2 py-1.5" : "px-2 py-1.5 text-center";

        switch (column.type) {
            case "text":
                return (
                    <td key={column.field} className={cellClass}>
                        <InlineEdit
                            value={itemTextValue(item, column.field)}
                            onSave={val =>
                                onChange({ [column.field]: val } as CategoryEditorItemPatch<L>)
                            }
                            placeholder={column.placeholder}
                            disabled={disabled}
                            className={column.className ?? "text-xs"}
                            data-field={column.field}
                            refCb={el => registerFocus?.(column.field, el)}
                            onKeyDown={handleKeyDown(column.field)}
                        />
                    </td>
                );
            case "number": {
                const editor = (
                    <InlineNumber
                        value={itemNumberValue(item, column.field)}
                        onSave={val =>
                            onChange({ [column.field]: val } as CategoryEditorItemPatch<L>)
                        }
                        disabled={disabled}
                        min={column.min}
                        step={column.step}
                        className={column.className ?? "text-xs"}
                        data-field={column.field}
                        refCb={el => registerFocus?.(column.field, el)}
                        onKeyDown={handleKeyDown(column.field)}
                    />
                );
                return (
                    <td key={column.field} className={cellClass}>
                        {column.prefix ? (
                            <div className="flex items-center justify-center gap-1">
                                <span className="text-xs text-gray-400">{column.prefix}</span>
                                {editor}
                            </div>
                        ) : (
                            editor
                        )}
                    </td>
                );
            }
            case "unit":
                return (
                    <td key={column.field} className={cellClass}>
                        <InlineUnitSelect
                            value={itemUnitValue(item, column.field)}
                            onSave={val =>
                                onChange({ [column.field]: val } as CategoryEditorItemPatch<L>)
                            }
                            disabled={disabled}
                            options={unitOptions}
                            data-field={column.field}
                            refCb={el => registerFocus?.(column.field, el)}
                            onKeyDown={handleKeyDown(column.field)}
                        />
                    </td>
                );
            case "total":
                return (
                    <td
                        key={column.field}
                        className="whitespace-nowrap px-2 py-1.5 text-right text-xs font-semibold text-gray-800"
                    >
                        {total}
                    </td>
                );
        }
    };
return (
        <tr
            ref={(el: HTMLTableRowElement | null) => {
                rowRef.current = el;
                if (hasError && el?.isConnected) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    el.focus({ preventScroll: true });
                }
            }}
            className={cn(
                "group transition-colors hover:bg-gray-50/50",
                hasError && "bg-red-50 hover:bg-red-50",
            )}
            tabIndex={hasError ? 0 : -1}
        >
            <td className="px-6 py-1.5 text-center">
                <span className="text-xs font-medium text-gray-400">{index}.</span>
            </td>
            {columns.map(renderColumn)}
            <td className="px-2 py-1.5 text-center">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={onDelete}
                    className="h-7 w-7 p-0 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-600"
                    data-field="delete"
                >
                    <TrashIcon size={14} />
                </Button>
            </td>
        </tr>
    );
}