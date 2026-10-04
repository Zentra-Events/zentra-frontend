"use client";

import { FolderOpenIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { InlineEdit } from "@/components/ui";
import { ChevronDownIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { ChecklistItemNode } from "./checklist-item-node";
import type { ChecklistItem } from "./types";
import type { SubCategoryGroup } from "@/lib/utils/grouping";

export interface SubCategoryNodeProps {
    sub: SubCategoryGroup<ChecklistItem>;
    expanded: boolean;
    selectedUid: string | null;
    onSelectUid: (uid: string) => void;
    onDeleteItem: (uid: string) => void;
    onConvertItem: (uid: string) => void;
    onToggle: () => void;
    onAddItem: () => void;
    onRename: (newName: string) => void;
    onDelete: () => void;
    /** Set of item uids that currently fail validation (highlighted). */
    invalidUids?: Set<string>;
    disabled?: boolean;
    focusTarget?: string | null;
    onFocused?: () => void;
}

/**
 * Renders one Sub Category header followed by its child items. Mirrors the
 * approved design: chevron + folder icon + inline-renamable name, a quick add
 * (item) and an ellipsis (`MenuList`) for add / rename / delete.
 */
export function SubCategoryNode({
    sub,
    expanded,
    selectedUid,
    onSelectUid,
    onDeleteItem,
    onConvertItem,
    onToggle,
    onAddItem,
    onRename,
    onDelete,
    invalidUids,
    disabled = false,
    focusTarget,
    onFocused,
}: SubCategoryNodeProps) {
        // Pass focusSignal to InlineEdit so it enters edit mode and focuses
    // only when this sub category is the designated focus target.
    const inlineEditFocusSignal = focusTarget === `sub:${sub.name}` ? 1 : 0;

    return (
        <div className="mt-0.5">
            <div
                className={cn(
                    "group flex cursor-default items-center rounded-md py-1.5 pr-2 transition-colors",
                    "hover:bg-muted",
                )}
            >
                <button
                    type="button"
                    onClick={onToggle}
                    aria-label="Expand/collapse sub category"
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
                <FolderOpenIcon size={16} className="shrink-0 text-muted-foreground mr-1.5" />
                <InlineEdit
                    value={sub.name}
                    onSave={onRename}
                    placeholder="Sub category name"
                    disabled={disabled}
                    className="min-w-0 text-sm font-medium text-foreground"
                    data-field="sub-category-name"
                    focusSignal={inlineEditFocusSignal}
                    onEditingChange={editing => {
                        if (editing) {
                            onFocused?.();
                        }
                    }}
                />

                <div
                    onClick={e => e.stopPropagation()}
                    className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                >
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={onAddItem}
                        className="cursor-pointer flex h-6 w-6 items-center mt-0.5 justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Add item"
                    >
                        <PlusIcon size={15} />
                    </button>
                    <button
                        type="button"
                        disabled={disabled}
                        className="cursor-pointer flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Item actions"
                        onClick={onDelete}
                    >
                        <TrashIcon size={15} className="text-destructive" />
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="ml-5 space-y-0.5 border-l border-border/60 pl-3 pb-1">
                    {sub.items.map(item => (
                        <ChecklistItemNode
                            key={item._uid ?? `${sub.name}-${item.item}`}
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
                </div>
            )}
        </div>
    );
}
