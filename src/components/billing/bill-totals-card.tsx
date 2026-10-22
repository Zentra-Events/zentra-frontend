import type { ReactNode } from "react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils/cn";

export interface BillTotalRow {
    label: string;
    value: number;
    /** Render the value as a deduction (leading minus sign). */
    deduction?: boolean;
    /** Emphasis of the row. */
    emphasis?: "total" | "muted";
    /** Optional secondary text rendered under the label. */
    hint?: string;
}

interface BillTotalsCardProps {
    title?: string;
    icon?: ReactNode;
    rows: BillTotalRow[];
    footer?: ReactNode;
    className?: string;
}

/**
 * Financial breakdown of a bill.
 *
 * Every amount is rendered with the shared currency formatter so the billing
 * screens and the rest of the application stay consistent.
 */
export function BillTotalsCard({
    title,
    icon,
    rows,
    footer,
    className,
}: BillTotalsCardProps) {
    return (
        <section
            className={cn(
                "rounded-lg border border-border bg-surface overflow-hidden",
                className,
            )}
        >
            {title && (
                <header className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
                    {icon && <span className="text-muted-foreground">{icon}</span>}
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                        {title}
                    </h4>
                </header>
            )}

            <dl className="divide-y divide-border">
                {rows.map((row, index) => {
                    const isTotal = row.emphasis === "total";
                    return (
                        <div
                            key={`${row.label}-${index}`}
                            className={cn(
                                "flex items-start justify-between gap-4 px-4 py-2.5",
                                isTotal && "bg-primary/[0.04]",
                            )}
                        >
                            <div className="min-w-0">
                                <dt
                                    className={cn(
                                        "text-xs",
                                        isTotal
                                            ? "font-semibold text-foreground"
                                            : "text-muted-foreground",
                                    )}
                                >
                                    {row.label}
                                </dt>
                                {row.hint && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        {row.hint}
                                    </p>
                                )}
                            </div>
                            <dd
                                className={cn(
                                    "shrink-0 text-sm tabular-nums whitespace-nowrap",
                                    isTotal
                                        ? "font-bold text-foreground"
                                        : "font-medium text-foreground",
                                    row.emphasis === "muted" && "text-muted-foreground",
                                )}
                            >
                                {row.deduction ? "−" : ""}
                                {formatCurrency(row.value)}
                            </dd>
                        </div>
                    );
                })}
            </dl>

            {footer && (
                <div className="border-t border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
                    {footer}
                </div>
            )}
        </section>
    );
}
