import { useMemo } from "react";
import type { EventResponse } from "@/types/event";
import { formatExportCurrency } from "@/lib/utils";
import { purchaseOrderPreviewStyles } from "@/constants/event";

/* ------------------------------------------------------------------ */
/*  Profit Summary                                                    */
/* ------------------------------------------------------------------ */

export function ProfitSummary({
    eventData,
    totalEstimatedCost,
}: {
    eventData: EventResponse;
    totalEstimatedCost: number;
}) {
    const {
        netRevenue,
        directVendorCost,
        operatingExpenses,
        grossProfit,
        netProfit,
        profitMargin,
    } = useMemo(() => {
        // Net revenue is taken directly from the event details response API. It is the
        // estimated amount (including GST) captured while creating the estimate, and it
        // already includes any additional estimates.
        const netRev = totalEstimatedCost;

        // Direct vendor / procurement cost = sum of each vendor's payable amount,
        // including the tax (GST) charged for that vendor.
        const vendorCost = (eventData.vendorSummary ?? []).reduce(
            (sum, v) => sum + (v.adjustedAmt ?? 0),
            0,
        );

        // Operating expenses / overheads incurred by the management team.
        const expensesList = eventData.expensesList as
            | Array<{ amount?: number; expenseDescription?: string }>
            | undefined;
        const actualExpenseTotal = Array.isArray(expensesList)
            ? expensesList
                  .filter(e => e.expenseDescription === "ACTUAL_EXPENSE")
                  .reduce((sum, e) => sum + (e.amount ?? 0), 0)
            : 0;
        const opEx =
            actualExpenseTotal > 0
                ? actualExpenseTotal
                : (eventData.invoiceSummary?.expensesTotal ?? 0);

        const gp = netRev - vendorCost;
        const np = gp - opEx;
        const pm = netRev > 0 ? (np / netRev) * 100 : 0;

        return {
            netRevenue: netRev,
            directVendorCost: vendorCost,
            operatingExpenses: opEx,
            grossProfit: gp,
            netProfit: np,
            profitMargin: pm,
        };
    }, [eventData]);

    return (
        <div>
            <table className="w-full border-collapse text-xs border border-black">
                <tbody>
                    <tr className={purchaseOrderPreviewStyles.subTotalBg}>
                        <td className="border border-black px-3 py-2 font-bold" colSpan={4}>
                            NET REVENUE (Client Billing)
                        </td>
                        <td
                            className="border border-black px-3 py-2 text-right font-bold"
                            colSpan={4}
                        >
                            {formatExportCurrency(netRevenue)}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black px-3 py-1.5" colSpan={4}>
                            Less: Direct Vendor / Procurement Cost
                        </td>
                        <td className="border border-black px-3 py-1.5 text-right" colSpan={4}>
                            −{formatExportCurrency(directVendorCost)}
                        </td>
                    </tr>
                    <tr className={purchaseOrderPreviewStyles.totalBg}>
                        <td className="border border-black px-3 py-2 font-bold" colSpan={4}>
                            Gross Profit
                        </td>
                        <td
                            className="border border-black px-3 py-2 text-right font-bold"
                            colSpan={4}
                        >
                            {formatExportCurrency(grossProfit)}
                        </td>
                    </tr>
                    {operatingExpenses > 0 && (
                        <tr className={purchaseOrderPreviewStyles.advanceBg}>
                            <td className="border border-black px-3 py-1.5" colSpan={4}>
                                Less: Operating Expenses / Overheads
                            </td>
                            <td className="border border-black px-3 py-1.5 text-right" colSpan={4}>
                                −{formatExportCurrency(operatingExpenses)}
                            </td>
                        </tr>
                    )}
                    <tr className={purchaseOrderPreviewStyles.balanceBg}>
                        <td
                            className={`border border-black px-3 py-2 font-bold text-sm ${
                                netProfit < 0 ? "text-destructive" : "text-green-800"
                            }`}
                            colSpan={4}
                        >
                            NET PROFIT
                        </td>
                        <td
                            className={`border border-black px-3 py-2 text-right font-bold text-sm ${
                                netProfit < 0 ? "text-destructive" : "text-green-800"
                            }`}
                            colSpan={4}
                        >
                            {formatExportCurrency(netProfit)}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black px-3 py-1.5 font-medium" colSpan={4}>
                            Profit Margin
                        </td>
                        <td
                            className="border border-black px-3 py-1.5 text-right font-medium"
                            colSpan={4}
                        >
                            {netRevenue > 0 ? `${profitMargin.toFixed(2)}%` : "—"}
                        </td>
                    </tr>
                </tbody>
            </table>
            <div className="mt-2 text-[10px] text-muted-foreground italic">
                Internal view — event management team P&L (net revenue includes GST and any
                additional estimates; vendor cost includes tax).
            </div>
        </div>
    );
}
