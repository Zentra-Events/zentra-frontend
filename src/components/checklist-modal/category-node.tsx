"use client";

import { FolderIcon, FolderOpenIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { InlineEdit } from "@/components/ui";
import { MenuList } from "@/components/ui/menu-list";
import { ChevronDownIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import type { MenuItem } from "@/types";
import { ChecklistItemNode } from "./checklist-item-node";
import { SubCategoryNode } from "./sub-category-node";
import type { ChecklistItem } from "./types";
import type { CategoryGroup } from "@/lib/utils/grouping";

export interface CategoryNodeProps {
    group: CategoryGroup<ChecklistItem>;
    expanded: boolean;
    expandedSubCategories: Set<string>;
    selectedUid: string | null;
    onToggle: () => void;
    onSelectUid: (uid: string) => void;
    onDeleteItem: (uid: string) => void;
    onConvertItem: (uid: string) => void;
    onAddItem: () => void;
    onAddSubCategory: () => void;
    onRename: (newName: string) => void;
    onDelete: () => void;
    onToggleSubCategory: (subName: string) => void;
    onAddItemToSubCategory: (subName: string) => void;
    onRenameSubCategory: (subName: string, newName: string) => void;
    onDeleteSubCategory: (subName: string) => void;
    /** Set of item uids that currently fail validation (highlighted). */
    invalidUids?: Set<string>;
    disabled?: boolean;
    focusTarget?: string | null;
    onFocused?: () => void;
}

/**
 * Renders one Category. Mirrors the approved design: chevron + folder icon +
 * inline-renamable name, a completion progress bar (`done/total`), a quick add
 * (sub category) and an ellipsis (`MenuList`) for add-item / delete.
 */
export function CategoryNode({
    group,
    expanded,
    expandedSubCategories,
    selectedUid,
    onToggle,
    onSelectUid,
    onDeleteItem,
    onConvertItem,
    onAddItem,
    onAddSubCategory,
    onRename,
    onDelete,
    onToggleSubCategory,
    onAddItemToSubCategory,
    onRenameSubCategory,
    onDeleteSubCategory,
    invalidUids,
    disabled = false,
    focusTarget,
    onFocused,
}: CategoryNodeProps) {
        // Pass focusSignal to InlineEdit so it enters edit mode and focuses
    // only when this category is the designated focus target.
    const inlineEditFocusSignal = focusTarget === group.name ? 1 : 0;

    const menuItems: MenuItem[] = [
        {
            key: "add-item",
            label: "Add Item",
            icon: <PlusIcon size={15} />,
            disabled,
            onClick: onAddItem,
        },
        {
            key: "add-sub-category",
            label: "Add Sub Category",
            icon: <PlusIcon size={15} />,
            disabled,
            onClick: onAddSubCategory,
        },
        // {
        //     key: "delete",
        //     label: "Delete Category",
        //     icon: <TrashIcon size={15} />,
        //     disabled,
        //     onClick: onDelete,
        //     className: "text-destructive",
        // },
    ];

    return (
        <div className="space-y-0.5">
            <div className="group flex cursor-pointer items-center rounded-md py-1.5 pr-2 transition-colors hover:bg-muted">
                <button
                    type="button"
                    onClick={onToggle}
                    aria-label="Expand/collapse category"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <ChevronDownIcon
                        size={16}
                        className={cn(
                            "transition-transform duration-200 cursor-pointer",
                            expanded ? "rotate-180" : "",
                        )}
                    />
                </button>
                {expanded ? (
                    <FolderOpenIcon size={16} className="shrink-0 mr-1.5 text-muted-foreground" />
                ) : (
                    <FolderIcon size={16} className="shrink-0 mr-1.5 text-muted-foreground" />
                )}
                <InlineEdit
                    value={group.name}
                    onSave={onRename}
                    placeholder="Category name"
                    disabled={disabled}
                    className="min-w-0 font-semibold text-foreground"
                    data-field="category-name"
                    focusSignal={inlineEditFocusSignal}
                    onEditingChange={editing => {
                        if (editing) {
                            onFocused?.();
                        }
                    }}
                />

                <div className="ml-auto flex shrink-0 items-center gap-2">
                    <div
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                        <MenuList
                            items={menuItems}
                            align="end"
                            trigger={
                                <button
                                    type="button"
                                    className="cursor-pointer mt-0.5 flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    title="Category actions"
                                >
                                    <PlusIcon size={15} />
                                </button>
                            }
                        />
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={onDelete}
                            className="flex h-6 w-6 items-center mb-0.5 justify-center rounded cursor-pointer"
                            title="Delete Category"
                        >
                            <TrashIcon size={15} className="text-destructive" />
                        </button>
                    </div>
                </div>
            </div>

            {expanded && (
                <div className="ml-5 space-y-0.5 border-l border-border/60 pl-3">
                    {group.directItems.map(item => (
                        <ChecklistItemNode
                            key={item._uid ?? `cat-${group.name}-${item.item}`}
                            item={item}
                            selected={selectedUid === item._uid}
                            invalid={invalidUids?.has(item._uid ?? "") ?? false}
                            onSelect={() => onSelectUid(item._uid ?? "")}
                            onDelete={() => onDeleteItem(item._uid ?? "")}
                            onConvert={() => onConvertItem(item._uid ?? "")}
                            disabled={disabled}
                            focusTarget={focusTarget}
                            onFocused={onFocused}
                        />
                    ))}

                    {group.subCategories.map(sub => (
                        <SubCategoryNode
                            key={`${group.name}::${sub.name}`}
                            sub={sub}
                            expanded={
                                expanded || expandedSubCategories.has(`${group.name}::${sub.name}`)
                            }
                            selectedUid={selectedUid}
                            onSelectUid={onSelectUid}
                            onDeleteItem={onDeleteItem}
                            onConvertItem={onConvertItem}
                            onToggle={() => onToggleSubCategory(sub.name)}
                            onAddItem={() => onAddItemToSubCategory(sub.name)}
                            onRename={(newName: string) => onRenameSubCategory(sub.name, newName)}
                            onDelete={() => onDeleteSubCategory(sub.name)}
                            invalidUids={invalidUids}
                            disabled={disabled}
                            focusTarget={focusTarget}
                            onFocused={onFocused}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
