"use client";

import { DEFAULT_CURRENCY_SYMBOL, DEFAULT_GENERAL_CATEGORY, DEFAULT_ITEM_COLUMNS, DEFAULT_LABELS, DEFAULT_UNIT_OPTIONS } from "@/lib/category-editor";
import type {
    CategoryEditorItemColumnSpec,
    CategoryEditorLine,
    CategoryEditorLineItem,
    CategoryEditorStrings,
} from "@/lib/category-editor";
import type { UseCategoryEditorOptions } from "@/lib/category-editor";
import { useCategoryEditor } from "@/lib/category-editor";
import { AddCategoryButton, AddItemButton } from "./add-actions";
import { CategoryGroupCard } from "./category-group-card";

export interface CategoryEditorProps<L extends CategoryEditorLine> {
    /** Flat lines in document (creation) order. */
    lines: L[];
    onLinesChange: (lines: L[]) => void;
    disabled?: boolean;
    /** Item ids that should be highlighted as invalid. */
    errorLineIds?: Set<string>;
    /** Item table columns; defaults to the standard Element/Qty/Rate set. */
    columns?: readonly CategoryEditorItemColumnSpec[];
    unitOptions?: readonly string[];
    currencySymbol?: string;
    totalFormatter?: (item: CategoryEditorLineItem<L>) => string;
    strings?: Partial<CategoryEditorStrings>;
    /** Business-logic overrides (line factories, naming strategies). */
    options?: UseCategoryEditorOptions<L>;
}

/**
 * Reusable Category → Sub Category → Item editor.
 *
 * Pages only need to supply `lines`, `onLinesChange` and (optionally) some
 * presentation/business-logic overrides. All structure manipulation, focus
 * scheduling and keyboard navigation is handled here.
 */
export function CategoryEditor<L extends CategoryEditorLine>({
    lines,
    onLinesChange,
    disabled = false,
    errorLineIds,
    columns = DEFAULT_ITEM_COLUMNS,
    unitOptions = DEFAULT_UNIT_OPTIONS,
    currencySymbol = DEFAULT_CURRENCY_SYMBOL,
    totalFormatter,
    strings: stringsProp,
    options,
}: CategoryEditorProps<L>) {
    const controller = useCategoryEditor(lines, onLinesChange, options);
    const strings: CategoryEditorStrings = { ...DEFAULT_LABELS, ...stringsProp };
    const hasGeneralGroup = controller.groups.some(
        group => group.name === DEFAULT_GENERAL_CATEGORY,
    );

    /* ---- empty state ---- */
    if (controller.groups.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-gray-500">{strings.emptyStateText}</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                    <AddCategoryButton
                        label={strings.addCategory}
                        disabled={disabled}
                        onClick={controller.addCategory}
                        className="gap-1.5 border-dashed"
                    />
                    <AddItemButton
                        label={strings.addUngroupedItem}
                        disabled={disabled}
                        onClick={controller.addItemWithoutCategory}
                        className="gap-1.5"
                    />
                </div>
            </div>
        );
    }

    /* ---- render ---- */
    return (
        <div className="space-y-3">
            {controller.groups.map(group => (
                <CategoryGroupCard
                    key={group.id}
                    group={group}
                    disabled={disabled}
                    columns={columns}
                    unitOptions={unitOptions}
                    currencySymbol={currencySymbol}
                    totalFormatter={totalFormatter}
                    errorLineIds={errorLineIds}
                    strings={strings}
                    onRename={newName => controller.renameCategory(group.name, newName)}
                    onDelete={() => controller.deleteCategory(group.name)}
                    onAddSubCategory={() => controller.addSubCategory(group.name)}
                    onAddItem={() => controller.addItemToCategory(group.name)}
                    onDeleteSubCategory={subName =>
                        controller.deleteSubCategory(group.name, subName)
                    }
                    onRenameSubCategory={(oldName, newName) =>
                        controller.renameSubCategory(group.name, oldName, newName)
                    }
                    onAddItemToSubCategory={subName =>
                        controller.addItemToSubCategory(group.name, subName)
                    }
                    onUpdateItem={(itemId, patch) => controller.updateItem(itemId, patch)}
                    onDeleteItem={controller.deleteItem}
                    focusState={controller.getFocusState(group)}
                    onFocusSignalHandled={controller.focusHandled}
                />
            ))}
            <div className="flex flex-wrap justify-center gap-2 pt-1">
                {!hasGeneralGroup && (
                    <AddItemButton
                        label={strings.addUngroupedItem}
                        disabled={disabled}
                        onClick={controller.addItemWithoutCategory}
                        className="gap-1.5 text-xs"
                    />
                )}
                <AddCategoryButton
                    label={strings.addCategory}
                    disabled={disabled}
                    onClick={controller.addCategory}
                    className="gap-1.5 border-dashed text-xs"
                />
            </div>
        </div>
    );
}