import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
    default: "bg-muted text-foreground",
    success: "bg-success-light text-success",
    warning: "bg-warning-light text-warning",
    danger: "bg-error-light text-error",
    info: "bg-info-light text-info",
};

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                variantStyles[variant],
                className,
            )}
            {...props}
        >
            {children}
        </span>
    );
}
