"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface TabItem {
    key: string;
    label: string;
    icon?: ReactNode;
    /** Optional count rendered next to the label. */
    count?: number;
    disabled?: boolean;
}

interface TabsProps {
    items: TabItem[];
    /** The key of the active tab. */
    value: string;
    onChange: (key: string) => void;
    className?: string;
}

/**
 * Horizontal tab strip.
 *
 * The application had no tab primitive, so this one follows the style of the
 * hand-rolled tab bar used on the estimates list (underline on the active
 * tab, muted labels otherwise).
 */
export function Tabs({ items, value, onChange, className }: TabsProps) {
    return (
        <nav className={cn("flex gap-6 border-b border-border", className)} role="tablist">
            {items.map(item => {
                const isActive = item.key === value;
                return (
                    <button
                        key={item.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        disabled={item.disabled}
                        onClick={() => !item.disabled && onChange(item.key)}
                        className={cn(
                            "flex items-center gap-2 pb-2 text-sm font-medium transition-colors",
                            isActive
                                ? "border-b-3 border-primary text-foreground"
                                : "text-muted-foreground hover:text-foreground",
                            item.disabled && "opacity-50 cursor-not-allowed",
                        )}
                    >
                        {item.icon}
                        {item.label}
                        {typeof item.count === "number" && (
                            <span
                                className={cn(
                                    "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                                    isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                                )}
                            >
                                {item.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </nav>
    );
}
