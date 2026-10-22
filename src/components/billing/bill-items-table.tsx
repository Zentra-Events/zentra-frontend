import { Table, type Column } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

export interface BillItemRow {
    name: string;
    details?: string;
    quantity: number;
    unit?: string;
    rate: number;
    amount: number;
    vendor?: string;
}

interface BillItemsTableProps {
    items: BillItemRow[];
    /** Show the vendor column (used by the purchase order side). */
    showVendor?: boolean;
    emptyMessage?: string;
    className?: string;
}

/**
 * Table of billable line items.
 *
 * Shared by the client bill, the vendor bill and the bill preview so the
 * three screens always show the same columns and the same formatting.
 */
export function BillItemsTable({
    items,
    showVendor = false,
    emptyMessage = "No billable items for this bill.",
    className,
}: BillItemsTableProps) {
    const columns: Column<BillItemRow>[] = [
        {
            key: "name",
            header: "Item",
            render: item => (
                <div className="min-w-0">
                    <p className="font-medium text-foreground">{item.name}</p>
                    {item.details && item.details !== "—" && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-[26rem]">
                            {item.details}
                        </p>
                    )}
                </div>
            ),
        },
        ...(showVendor
            ? ([
                  {
                      key: "vendor",
                      header: "Vendor",
                      render: (item: BillItemRow) => item.vendor || "—",
                  },
              ] as Column<BillItemRow>[])
            : []),
        {
            key: "quantity",
            header: "Qty",
            align: "right",
            render: item => `${item.quantity ?? 0} ${item.unit || "nos"}`,
        },
        {
            key: "rate",
            header: "Rate",
            align: "right",
            render: item => formatCurrency(item.rate),
        },
        {
            key: "amount",
            header: "Amount",
            align: "right",
            render: item => (
                <span className="font-semibold text-foreground">
                    {formatCurrency(item.amount)}
                </span>
            ),
        },
    ];

    return (
        <Table
            data={items}
            columns={columns}
            getKey={(item, index) => `${item.name}-${index}`}
            emptyMessage={emptyMessage}
            className={className}
        />
    );
}
