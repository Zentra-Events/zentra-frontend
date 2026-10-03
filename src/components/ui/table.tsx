import React from "react";
import { Tooltip } from "./tooltip";
import { truncate } from "@/lib/utils";
import { cn } from "@/lib/utils/cn";

export interface Column<T> {
    key: string;
    /**
     * Header content. Accepts a plain string, or any node so columns can
     * render a small affordance (e.g. a pencil icon) to signal that their
     * cells are inline-editable.
     */
    header: string | React.ReactNode;
    align?: "left" | "center" | "right";
    render?: (item: T, index: number) => React.ReactNode;
    className?: string;
    headerClassName?: string;
    maxWidth?: string;
    cellClassName?: string;
}

export interface TableProps<T> {
    data: T[];
    columns: Column<T>[];
    getKey?: (item: T, index: number) => string | number;
    className?: string;
    showRowNumbers?: boolean;
    emptyMessage?: string;
    footer?: React.ReactNode;
}

export function Table<T>({
    data,
    columns,
    getKey,
    className,
    showRowNumbers = false,
    emptyMessage = "No data available.",
    footer,
}: TableProps<T>) {
    if (data.length === 0) {
        return (
            <div className="rounded-md border border-border p-8 text-center text-muted-foreground">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className={cn("overflow-x-auto", className)}>
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        {showRowNumbers && (
                            <th className="py-3 px-3 font-medium text-xs text-muted-foreground">
                                No
                            </th>
                        )}
                        {columns.map(column => (
                            <th
                                key={column.key}
                                className={cn(
                                    "py-3 px-3 font-medium",
                                    column.align === "right"
                                        ? "text-right"
                                        : column.align === "center"
                                          ? "text-center"
                                          : "text-left",
                                    column.headerClassName,
                                )}
                            >
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((item, index) => (
                        <tr
                            key={getKey ? getKey(item, index) : index}
                            className="border-b border-border last:border-0"
                        >
                            {showRowNumbers && (
                                <td className="py-3 px-3 align-middle text-xs text-muted-foreground">
                                    {index + 1}
                                </td>
                            )}
                            {columns.map(column => {
                                const content = column.render
                                    ? column.render(item, index)
                                    : ((item as Record<string, unknown>)[
                                          column.key
                                      ] as React.ReactNode);

                                const textContent = String(content ?? "");
                                const shouldTruncate = column.maxWidth && textContent.length > 30;

                                return (
                                    <td
                                        key={column.key}
                                        className={cn(
                                            "py-3 px-3 align-middle",
                                            column.align === "right"
                                                ? "text-right"
                                                : column.align === "center"
                                                  ? "text-center"
                                                  : "text-left",
                                            column.cellClassName,
                                        )}
                                        style={
                                            column.maxWidth
                                                ? { maxWidth: column.maxWidth }
                                                : undefined
                                        }
                                    >
                                        {shouldTruncate ? (
                                            <Tooltip content={textContent}>
                                                <span className="block truncate">
                                                    {truncate(textContent, 30)}
                                                </span>
                                            </Tooltip>
                                        ) : (
                                            content
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
                {footer && <tfoot>{footer}</tfoot>}
            </table>
        </div>
    );
}
