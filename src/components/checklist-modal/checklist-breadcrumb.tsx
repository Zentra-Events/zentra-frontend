"use client";

import { ChevronRightIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";
import type { ChecklistItem } from "./types";

export interface ChecklistBreadcrumbProps {
    /** The selected item (if any) whose hierarchy path is displayed. */
    selectedItem: ChecklistItem | null;
    /** Optional explicit path overrides the item derivation. */
    explicitPath?: string[];
    className?: string;
}

/**
 * Breadcrumb placed above the editor panel.
 *
 * Resolves the full Category → Sub Category → Item path from the currently
 * selected checklist item and updates automatically whenever the selection
 * changes.
 */
export function ChecklistBreadcrumb({
    selectedItem,
    explicitPath,
    className,
}: ChecklistBreadcrumbProps) {
    const path = explicitPath ?? resolvePath(selectedItem);

    if (path.length === 0) {
        return (
            <p className="text-xs text-muted-foreground">
                Select an item to view its hierarchy path.
            </p>
        );
    }

    return (
        <nav
            className={cn(
                "flex items-center gap-1.5 text-xs text-muted-foreground",
                className,
            )}
            aria-label="Checklist hierarchy"
        >
            {path.map((segment, idx) => (
                <span key={`${segment}-${idx}`} className="flex items-center gap-1.5">
                    {idx > 0 && <ChevronRightIcon size={12} />}
                    <span
                        className={cn(
                            idx === path.length - 1
                                ? "font-medium text-foreground"
                                : "text-muted-foreground",
                        )}
                    >
                        {segment}
                    </span>
                </span>
            ))}
        </nav>
    );
}

function resolvePath(item: ChecklistItem | null): string[] {
    if (!item) return [];
    const parts: string[] = [];
    if (item.category) parts.push(item.category);
    if (item.subCategory) parts.push(item.subCategory);
    if (item.item) parts.push(item.item);
    return parts;
}
