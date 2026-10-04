"use client";

import { useEffect, useRef } from "react";
import { Split, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { TrashIcon } from "@/components/ui/icons";
import type { ChecklistItem } from "./types";
import { focusAndScrollIntoView } from "@/lib/category-editor/utils/focus";

export interface ChecklistItemNodeProps {
    item: ChecklistItem;
    selected: boolean;
    /** True when the item has validation errors (highlighted in the hierarchy). */
    invalid?: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onConvert: () => void;
    disabled?: boolean;
    focusTarget?: string | null;
    onFocused?: () => void;
}

const dotClass: Record<string, string> = {
    COMPLETED: "bg-success",
    IN_PROGRESS: "bg-info",
    PENDING: "bg-warning",
};

/**
 * A single checklist item rendered in the left-hand hierarchy tree.
 *
 * Left-to-right: a status dot (colored by status), the item name and an
 * ellipsis menu (reusable `MenuList`) for actions. The selected item gets a
 * 4px primary left-border highlight, matching the approved design.
 */
export function ChecklistItemNode({
    item,
    selected,
    invalid = false,
    onSelect,
    onDelete,
    onConvert,
    disabled = false,
    focusTarget,
    onFocused,
}: ChecklistItemNodeProps) {
    const status = item.status || "PENDING";
    const isCompleted = status === "COMPLETED";
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll into view when this item is the focus target.
    // The item name input on the right editor side gets focus; here we
    // only need to scroll the hierarchy item into view if it's not visible.
    useEffect(() => {
        if (focusTarget !== item._uid) {
            return;
        }

        if (containerRef.current && containerRef.current.isConnected) {
            focusAndScrollIntoView(containerRef.current);
            onFocused?.();
        }
    }, [focusTarget, item._uid, onFocused]);

    return (
        <div
            ref={containerRef}
            className={cn(
                "group flex cursor-pointer items-center gap-2.5 rounded-md border border-transparent border-l-4 py-1.5 pr-2 pl-2 transition-colors",
                selected
                    ? "border-border/40 border-l-primary bg-primary-light/60"
                    : "hover:bg-muted",
                invalid && !selected && "border-l-error/70 bg-error/10 hover:bg-error/10",
                invalid && selected && "border-l-error/70",
            )}
            onClick={onSelect}
            title={item.item || "(Unnamed)"}
        >
            <span
                className={cn("h-2 w-2 shrink-0 rounded-full", dotClass[status] || "bg-muted")}
                title={status}
            />
            <span
                className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    isCompleted ? "text-muted-foreground line-through" : "text-foreground",
                    invalid && "text-destructive",
                )}
            >
                {item.item || <span className="italic text-muted-foreground">Unnamed item</span>}
            </span>

            {invalid && (
                <span
                    className="flex shrink-0 items-center text-destructive"
                    title="This item has validation errors"
                >
                    <TriangleAlert size={14} aria-hidden />
                </span>
            )}

            <div
                onClick={e => e.stopPropagation()}
                className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"
            >
                <button
                    type="button"
                    disabled={disabled}
                    className="cursor-pointer flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="Convert to Sub Category"
                    onClick={onConvert}
                >
                    <Split size={15} />
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
    );
}
