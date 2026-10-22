"use client";

import { useMemo } from "react";

import { Button, MenuList, Table, Tooltip } from "@/components/ui";
import { MoreVerticalIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import { formatCurrency, truncate } from "@/lib/utils";
import { formatShortDate } from "@/lib/utils/date";
import { resolveBillStatus } from "@/lib/utils/bill-status";
import { BillStatusBadge } from "@/components/billing/bill-status-badge";
import type { ClientBillSummary, VendorBillSummary } from "@/lib/utils/billing";
import type { Column } from "@/components/ui/table";
import type { BillStatus, ClientBill, VendorBill } from "@/types/bill";
import type { MenuItem } from "@/types";

/* ------------------------------------------------------------------ */
/*  Row models                                                         */
/* ------------------------------------------------------------------ */

/** A client bill with the event it belongs to and its amounts. */
export interface ClientBillRow {
    bill: ClientBill;
    /** Title of the event the bill was raised for. */
    eventTitle: string;
    /** Name of the client of the event. */
    clientName: string;
    summary: ClientBillSummary;
}

/** A vendor bill with the event it belongs to and its amounts. */
export interface VendorBillRow {
    bill: VendorBill;
    /** Title of the event the bill was raised for. */
    eventTitle: string;
    summary: VendorBillSummary;
}

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

/**
 * Status of a bill.
 *
 * The backend stores the status of a bill. Bills that were created before
 * the status existed do not carry one, so the status is derived from the
 * amounts for them: a bill without a balance is paid, a bill with a partial
 * payment is partially paid and a bill without any payment is unpaid.
 */
export function getBillStatus(
    status: BillStatus | string | null | undefined,
    outstandingAmount: number | null,
    paidAmount: number | null,
): BillStatus {
    return resolveBillStatus(status, outstandingAmount, paidAmount);
}

/** Formats an amount, or a dash when the amount is unknown. */
function formatAmount(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) return "—";
    return formatCurrency(amount);
}

/** Renders the actions of a bill row. */
function BillActions({
    bill,
    onEdit,
    onDelete,
}: {
    bill: { id?: string | null };
    onEdit?: () => void;
    onDelete?: () => void;
}) {
    if (!bill.id) {
        return (
            <Tooltip content="This bill cannot be edited or deleted because the API does not return a bill ID.">
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
            onClick: () => onEdit?.(),
            scopes: ["w:bills"],
        },
        {
            key: "delete",
            label: "Delete",
            icon: <TrashIcon size={16} />,
            onClick: () => onDelete?.(),
            className: "text-destructive focus:text-destructive",
            scopes: ["w:bills"],
        },
    ];

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
}

/* ------------------------------------------------------------------ */
/*  Client bills table                                                 */
/* ------------------------------------------------------------------ */

interface ClientBillsTableProps {
    data: ClientBillRow[];
    /** Callback when a user chooses Edit on a row. */
    onEdit?: (bill: ClientBill) => void;
    /** Callback when a user chooses Delete on a row. */
    onDelete?: (bill: ClientBill) => void;
    /** Callback when a user changes the status of a bill. */
    onStatusChange?: (bill: ClientBill, status: BillStatus) => void;
    /** Whether the status of a bill may be changed. */
    canEditStatus?: boolean;
    emptyMessage?: string;
    className?: string;
}

/**
 * The client bills of all events.
 */
export function ClientBillsTable({
    data,
    onEdit,
    onDelete,
    onStatusChange,
    canEditStatus = true,
    emptyMessage = "No client bills found.",
    className,
}: ClientBillsTableProps) {
    const columns: Column<ClientBillRow>[] = useMemo(
        () => [
            {
                key: "billNo",
                header: "Bill Number",
                render: row => {
                    const billNo = row.bill.billNo || "—";
                    const shouldTruncate = billNo.length > 20;
                    return (
                        <Tooltip content={billNo}>
                            <span className="font-medium text-foreground truncate">
                                {shouldTruncate ? truncate(billNo, 20) : billNo}
                            </span>
                        </Tooltip>
                    );
                },
                maxWidth: "200px",
            },
            {
                key: "clientName",
                header: "Client",
                render: row => row.clientName || "—",
                maxWidth: "180px",
            },
            {
                key: "event",
                header: "Event",
                render: row => row.eventTitle || "—",
                maxWidth: "200px",
            },
            {
                key: "billDate",
                header: "Bill Date",
                render: row => (row.bill.billDate ? formatShortDate(row.bill.billDate) : "—"),
            },
            {
                key: "billAmount",
                header: "Bill Amount",
                align: "right",
                render: row => formatAmount(row.summary.grossAmount),
            },
            {
                key: "receivedAmount",
                header: "Received Amount",
                align: "right",
                render: row => formatAmount(row.summary.receivedAmount),
            },
            {
                key: "outstandingAmount",
                header: "Outstanding Amount",
                align: "right",
                render: row => formatAmount(row.summary.outstandingAmount),
            },
            {
                key: "status",
                header: "Status",
                render: row => (
                    <BillStatusBadge
                        status={getBillStatus(
                            row.bill.status,
                            row.summary.outstandingAmount,
                            row.summary.receivedAmount,
                        )}
                        canEdit={canEditStatus}
                        onChange={
                            onStatusChange
                                ? status => onStatusChange(row.bill, status)
                                : undefined
                        }
                    />
                ),
            },
            {
                key: "actions",
                header: "",
                align: "right",
                render: row => (
                    <BillActions
                        bill={row.bill}
                        onEdit={() => onEdit?.(row.bill)}
                        onDelete={() => onDelete?.(row.bill)}
                    />
                ),
            },
        ],
        [onEdit, onDelete, onStatusChange, canEditStatus],
    );

    return (
        <Table
            data={data}
            columns={columns}
            getKey={(row, index) => row.bill.id ?? index}
            className={className}
            emptyMessage={emptyMessage}
        />
    );
}

/* ------------------------------------------------------------------ */
/*  Vendor bills table                                                 */
/* ------------------------------------------------------------------ */

interface VendorBillsTableProps {
    data: VendorBillRow[];
    /** Callback when a user chooses Edit on a row. */
    onEdit?: (bill: VendorBill) => void;
    /** Callback when a user chooses Delete on a row. */
    onDelete?: (bill: VendorBill) => void;
    /** Callback when a user changes the status of a bill. */
    onStatusChange?: (bill: VendorBill, status: BillStatus) => void;
    /** Whether the status of a bill may be changed. */
    canEditStatus?: boolean;
    emptyMessage?: string;
    className?: string;
}

/**
 * The vendor bills of all events.
 */
export function VendorBillsTable({
    data,
    onEdit,
    onDelete,
    onStatusChange,
    canEditStatus = true,
    emptyMessage = "No vendor bills found.",
    className,
}: VendorBillsTableProps) {
    const columns: Column<VendorBillRow>[] = useMemo(
        () => [
            {
                key: "invoiceNumber",
                header: "Bill Number",
                render: row => {
                    const invoiceNumber = row.bill.invoiceNumber || "—";
                    const shouldTruncate = invoiceNumber.length > 20;
                    return (
                        <Tooltip content={invoiceNumber}>
                            <span className="font-medium text-foreground truncate">
                                {shouldTruncate ? truncate(invoiceNumber, 20) : invoiceNumber}
                            </span>
                        </Tooltip>
                    );
                },
                maxWidth: "220px",
            },
            {
                key: "vendorName",
                header: "Vendor",
                render: row => row.bill.name || "—",
                maxWidth: "180px",
            },
            {
                key: "event",
                header: "Event",
                render: row => row.eventTitle || "—",
                maxWidth: "200px",
            },
            {
                key: "billDate",
                header: "Bill Date",
                render: row =>
                    row.bill.billCreateDate ? formatShortDate(row.bill.billCreateDate) : "—",
            },
            {
                key: "billAmount",
                header: "Bill Amount",
                align: "right",
                render: row => formatAmount(row.summary.totalAmount ?? row.summary.subtotalAmount),
            },
            {
                key: "paidAmount",
                header: "Paid Amount",
                align: "right",
                render: row => formatAmount(row.summary.paidAmount),
            },
            {
                key: "outstandingAmount",
                header: "Outstanding Amount",
                align: "right",
                render: row => formatAmount(row.summary.outstandingAmount),
            },
            {
                key: "status",
                header: "Status",
                render: row => (
                    <BillStatusBadge
                        status={getBillStatus(
                            row.bill.status,
                            row.summary.outstandingAmount,
                            row.summary.paidAmount,
                        )}
                        canEdit={canEditStatus}
                        onChange={
                            onStatusChange
                                ? status => onStatusChange(row.bill, status)
                                : undefined
                        }
                    />
                ),
            },
            {
                key: "actions",
                header: "",
                align: "right",
                render: row => (
                    <BillActions
                        bill={row.bill}
                        onEdit={() => onEdit?.(row.bill)}
                        onDelete={() => onDelete?.(row.bill)}
                    />
                ),
            },
        ],
        [onEdit, onDelete, onStatusChange, canEditStatus],
    );

    return (
        <Table
            data={data}
            columns={columns}
            getKey={(row, index) => row.bill.id ?? index}
            className={className}
            emptyMessage={emptyMessage}
        />
    );
}
