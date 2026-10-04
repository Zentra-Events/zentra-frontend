"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils/cn";

export interface SwitchProps {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
    id?: string;
    "aria-label"?: string;
}

/**
 * Reusable toggle switch (wraps @radix-ui/react-switch) styled with the app
 * theme. Kept as its own primitive so other forms can reuse it.
 */
export function Switch({
    checked = false,
    onCheckedChange,
    disabled = false,
    className,
    id,
    "aria-label": ariaLabel,
}: SwitchProps) {
    return (
        <SwitchPrimitive.Root
            id={id}
            checked={checked}
            onCheckedChange={checked => onCheckedChange?.(checked)}
            disabled={disabled}
            aria-label={ariaLabel}
            className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-50",
                checked
                    ? "border-primary bg-primary"
                    : "border-border bg-muted",
                className,
            )}
        >
            <SwitchPrimitive.Thumb className="pointer-events-none block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-4" />
        </SwitchPrimitive.Root>
    );
}