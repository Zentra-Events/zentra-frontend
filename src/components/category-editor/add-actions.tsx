"use client";

import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";

interface AddActionButtonProps {
    label?: string;
    disabled?: boolean;
    onClick?: () => void;
    className?: string;
}

/**
 * Ghost "Add Item" action used inside category / sub-category tables.
 * Preserves the legacy compact styling.
 */
export function AddItemButton({
    label = "Item",
    disabled = false,
    onClick,
    className = "",
}: AddActionButtonProps) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={onClick}
            className={cn("h-6 gap-1 text-xs text-gray-400", className)}
        >
            <PlusIcon size={11} />
            {label}
        </Button>
    );
}

/** Ghost "Add Sub Category" action in the category header. */
export function AddSubCategoryButton({
    label = "Sub Category",
    disabled = false,
    onClick,
    className = "",
}: AddActionButtonProps) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={onClick}
            className={className}
        >
            <PlusIcon size={12} />
            {label}
        </Button>
    );
}

/** Outlined "Add Category" action for the empty state and footer. */
export function AddCategoryButton({
    label = "Add Category",
    disabled = false,
    onClick,
    className = "",
}: AddActionButtonProps) {
    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onClick}
            className={cn("gap-1.5", className)}
        >
            <PlusIcon size={14} />
            {label}
        </Button>
    );
}