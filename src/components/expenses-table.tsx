"use client";

import { useCallback, useMemo } from "react";
import { Badge, Button, MenuList, Table, Tooltip } from "@/components/ui";
import { MoreVerticalIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import { FileText } from "lucide-react";
import { formatCurrency, truncate } from "@/lib/utils";
import { formatShortDate } from "@/lib/utils/date";
import type { Column } from "@/components/ui/table";
import type { Expense } from "@/types/expense";
import type { MenuItem } from "@/types";
import { EXPENSE_TYPE_LABELS, EXPENSE_STATUS_META } from "@/hooks/useExpenses";

/* ------------------------------------------------------------------ */
/*  Default column definitions (shared by both contexts)              */
/* ------------------------------------------------------------------ */

const DEFAULT_COLUMNS: Column<Expense>[] = [
    {
        key: "itemName",
        header: "Item Name",
        render: item => <span className="font-medium text-foreground">{item.itemName || "—"}</span>,
    },
    {
        key: "amount",
        header: "Amount",
        align: "right",
        render: item => {
            const amount = typeof item.amount === "string" ? Number(item.amount) : item.amount;
            return Number.isFinite(amount) ? formatCurrency(amount) : "—";
        },
    },
    {
        key: "expenseDescription",
        header: "Type",
        render: item => {
            const type =
                EXPENSE_TYPE_LABELS[item.expenseDescription ?? ""] ||
                item.expenseDescription ||
                "—";
            return <Badge variant="info">{type}</Badge>;
        },
    },
    {
        key: "comments",
        header: "Comments",
        render: item => (
            <Tooltip content={item.comments || ""}>
                <span>{truncate(item.comments ?? "", 10) || "—"}</span>
            </Tooltip>
        ),
        maxWidth: "240px",
    },
    {
        key: "poc",
        header: "Spent By",
        render: item => item.poc || "—",
    },
    {
        key: "expenseStatus",
        header: "Expense Status",
        render: item => {
            const status = String(item.expenseStatus ?? "");
            const meta = EXPENSE_STATUS_META[status];
            return (
                <Badge variant={meta?.variant ?? "default"}>{meta?.label || status || "—"}</Badge>
            );
        },
    },
    {
        key: "createdDate",
        header: "Created Date",
        render: item => (item.createdDate ? formatShortDate(item.createdDate) : "—"),
    },
];

/* ------------------------------------------------------------------ */
/*  ExpensesTable                                                     */
/* ------------------------------------------------------------------ */

interface ExpensesTableProps {
    data: Expense[];
    /** Optional extra columns to append (e.g. "Event" for the global page). */
    extraColumns?: Column<Expense>[];
    /** Callback when a user chooses Edit on a row. */
    onEdit?: (expense: Expense) => void;
    /** Callback when a user chooses Delete on a row. */
    onDelete?: (expense: Expense) => void;
    /** Callback when a user chooses View Receipt on a row. */
    onViewReceipt?: (expense: Expense) => void;
    /** Message shown when there are no rows. */
    emptyMessage?: string;
    className?: string;
}

export function ExpensesTable({
    data,
    extraColumns = [],
    onEdit,
    onDelete,
    onViewReceipt,
    emptyMessage = "No expenses found.",
    className,
}: ExpensesTableProps) {
    const receiptColumn: Column<Expense> = {
        key: "receipt",
        header: "Receipt",
        align: "center",
        maxWidth: "120px",
        render: item => {
            const hasReceipt = Boolean(item.receipt && item.receiptFileName);
            if (!hasReceipt) {
                return <span className="text-muted-foreground">—</span>;
            }
            return (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onViewReceipt?.(item)}
                    className="h-8 w-8 p-0 text-xs"
                >
                    <FileText size={12} />
                </Button>
            );
        },
    };

    const renderActions = useCallback(
        (item: Expense) => {
            if (!item.id) {
                return (
                    <Tooltip content="This expense cannot be edited or deleted because the API does not return an expense ID.">
                        <button
                            type="button"
                            tabIndex={-1}
                            aria-disabled="true"
                            aria-label="Edit and delete unavailable"
                            className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-lg text-muted-foreground/50"
                        >
                            <MoreVerticalIcon size={16} />
                        </button>
                    </Tooltip>
                );
            }

            const items: MenuItem[] = [
                {
                    key: "edit",
                    label: "Edit",
                    icon: <PencilIcon size={16} />,
                    onClick: () => onEdit?.(item),
                    scopes: ["w:expenses", "a:expenses"],
                },
                {
                    key: "delete",
                    label: "Delete",
                    icon: <TrashIcon size={16} />,
                    onClick: () => onDelete?.(item),
                    className: "text-destructive focus:text-destructive",
                    scopes: ["w:expenses", "a:expenses"],
                },
            ];

            if (Boolean(item.receipt && item.receiptFileName)) {
                items.push({
                    key: "view-receipt",
                    label: "View Receipt",
                    icon: <FileText size={16} />,
                    onClick: () => onViewReceipt?.(item),
                });
            }

            return (
                <div className="flex justify-end">
                    <MenuList
                        align="end"
                        items={items}
                        trigger={
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVerticalIcon size={16} />
                            </Button>
                        }
                    />
                </div>
            );
        },
        [onEdit, onDelete, onViewReceipt],
    );

    const columns: Column<Expense>[] = useMemo(() => {
        const actionsColumn: Column<Expense> = {
            key: "actions",
            header: "",
            align: "right",
            render: item => renderActions(item),
        };
        return [...extraColumns, ...DEFAULT_COLUMNS, receiptColumn, actionsColumn];
    }, [extraColumns, renderActions, receiptColumn]);

    return (
        <Table
            data={data}
            columns={columns}
            getKey={(item, index) => item.id ?? index}
            className={className}
            emptyMessage={emptyMessage}
        />
    );
}
