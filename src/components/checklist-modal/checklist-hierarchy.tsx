"use client";

import { Search, Plus, Expand, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryNode } from "./category-node";
import type { ChecklistItem } from "./types";
import type { CategoryGroup } from "@/lib/utils/grouping";

export interface ChecklistHierarchyActions {
    onToggleCategory: (name: string) => void;
    onToggleSubCategory: (cat: string, sub: string) => void;
    onSelectUid: (uid: string) => void;
    onDeleteItem: (uid: string) => void;
    onConvertItem: (uid: string) => void;
    onAddItem: (category: string, subCategory?: string) => void;
    onAddSubCategory: (category: string) => void;
    onAddCategory: () => void;
    onRenameCategory: (oldName: string, newName: string) => void;
    onDeleteCategory: (name: string) => void;
    onRenameSubCategory: (cat: string, oldName: string, newName: string) => void;
    onDeleteSubCategory: (cat: string, name: string) => void;
    onExpandAll: () => void;
    onCollapseAll: () => void;
}

export interface ChecklistHierarchyProps {
    groups: CategoryGroup<ChecklistItem>[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
    expandedCategories: Set<string>;
    /** Keys are `${category}::${subCategory}`. */
    expandedSubCategories: Set<string>;
    selectedUid: string | null;
    disabled?: boolean;
    /** Set of item uids that currently fail validation (highlighted). */
    invalidUids?: Set<string>;
    actions: ChecklistHierarchyActions;
    /** Signal to focus a newly created element (category name, sub category name, or item uid). */
    focusTarget?: string | null;
    /** Callback when the target has been focused. */
    onFocused?: () => void;
}

/**
 * Left-hand hierarchical checklist panel.
 *
 * Search box stays at the top of the hierarchy list, followed by a compact
 * "Hierarchy" toolbar (Expand All / Collapse All) and the Category →
 * Sub Category → Item tree. Expansion state is supplied by the parent so it
 * survives edits and is preserved across selection changes.
 */
export function ChecklistHierarchy({
    groups,
    searchQuery,
    onSearchChange,
    expandedCategories,
    expandedSubCategories,
    selectedUid,
    disabled = false,
    invalidUids,
    actions,
    focusTarget,
    onFocused,
}: ChecklistHierarchyProps) {
    const showEmpty = groups.length === 0;

    return (
        <div className="flex h-full flex-col">
            {/* Search (kept at top of the hierarchy list) */}
            <div className="border-b border-border pb-3 pr-3 flex items-center gap-2">
                <div className="relative w-full">
                    <Search
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                        placeholder="Search categories, sub categories, items"
                        value={searchQuery}
                        onChange={e => onSearchChange(e.target.value)}
                        className="h-9 bg-surface pl-9 text-xs"
                        smallLabel
                    />
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={actions.onExpandAll}
                        title="Expand All"
                        className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <Expand size={15} />
                    </button>
                    <button
                        type="button"
                        onClick={actions.onCollapseAll}
                        title="Collapse All"
                        className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <Minimize2 size={15} />
                    </button>
                </div>
            </div>

            {/* Tree */}
            <div className="flex-1 space-y-1 overflow-y-auto pr-2">
                {showEmpty ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                        <p className="text-sm text-muted-foreground">
                            {searchQuery ? "No matches found." : "No items found in estimate."}
                        </p>
                        {!searchQuery && (
                            <Button onClick={actions.onAddCategory} variant="primary" size="sm">
                                Add First Category
                            </Button>
                        )}
                    </div>
                ) : (
                    groups.map(group => (
                        <CategoryNode
                            key={group.name}
                            group={group}
                            expanded={expandedCategories.has(group.name)}
                            expandedSubCategories={expandedSubCategories}
                            selectedUid={selectedUid}
                            onToggle={() => actions.onToggleCategory(group.name)}
                            onSelectUid={actions.onSelectUid}
                            onDeleteItem={actions.onDeleteItem}
                            onConvertItem={actions.onConvertItem}
                            onAddItem={() => actions.onAddItem(group.name)}
                            onAddSubCategory={() => actions.onAddSubCategory(group.name)}
                            onRename={newName => actions.onRenameCategory(group.name, newName)}
                            onDelete={() => actions.onDeleteCategory(group.name)}
                            onToggleSubCategory={subName =>
                                actions.onToggleSubCategory(group.name, subName)
                            }
                            onAddItemToSubCategory={subName =>
                                actions.onAddItem(group.name, subName)
                            }
                            onRenameSubCategory={(subName, newName) =>
                                actions.onRenameSubCategory(group.name, subName, newName)
                            }
                            onDeleteSubCategory={subName =>
                                actions.onDeleteSubCategory(group.name, subName)
                            }
                            invalidUids={invalidUids}
                            disabled={disabled}
                            focusTarget={focusTarget}
                            onFocused={onFocused}
                        />
                    ))
                )}
            </div>

            {/* Add Category */}
            <div className="border-t border-border pr-3 pt-3">
                <Button
                    onClick={actions.onAddCategory}
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 border-dashed text-xs"
                    disabled={disabled}
                >
                    <Plus size={14} /> Add Category
                </Button>
            </div>
        </div>
    );
}
