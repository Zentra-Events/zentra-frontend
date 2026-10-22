import { useMemo } from "react";
import type { EventResponse } from "@/types/event";
import { formatExportCurrency } from "@/lib/utils";
import { calculateEventProfitAndLoss } from "@/lib/utils/billing";
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
        estimatedAmount,
        serviceChargeAmount,
        serviceChargePercent,
        discountAmount,
        gstAmount,
        gstPercent,
        tdsAmount,
        tdsPercent,
        totalClientBilledAmount,
        clientBilledWithoutGst,
        profit,
        netHand,
    } = useMemo(() => {
        // eventData.gst / eventData.tds are percentages (e.g. 18 for 18%),
        // consistent with vendor-level gst/tds and calculatePercentageAmount
        // usage across the codebase (amount * percentage / 100).
        //
        // The calculation itself lives in `@/lib/utils/billing` so that the
        // billing screens and this summary share a single implementation.
        return calculateEventProfitAndLoss({
            totalEstimatedCost: totalEstimatedCost ?? 0,
            gstPercent: eventData.gst ?? 0,
            tdsPercent: eventData.tds ?? 0,
            serviceChargePercent: eventData.serviceCharge ?? 0,
            discountAmount: eventData.discounts ?? 0,
            vendorSummaries: eventData.vendorSummary ?? [],
        });
    }, [eventData, totalEstimatedCost]);

    return (
        <div>
            <table className="w-full border-collapse text-xs border border-black">
                <tbody>
                    <tr>
                        <td className="border border-black px-3 py-1.5" colSpan={4}>
                            Estimated amount
                        </td>
                        <td className="border border-black px-3 py-1.5 text-right" colSpan={4}>
                            {formatExportCurrency(estimatedAmount)}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black px-3 py-1.5" colSpan={4}>
                            Service Charge ({serviceChargePercent}%)
                        </td>
                        <td className="border border-black px-3 py-1.5 text-right" colSpan={4}>
                            {formatExportCurrency(serviceChargeAmount)}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black px-3 py-1.5" colSpan={4}>
                            Discount
                        </td>
                        <td className="border border-black px-3 py-1.5 text-right" colSpan={4}>
                            −{formatExportCurrency(discountAmount)}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black px-3 py-1.5" colSpan={4}>
                            GST ({gstPercent}%)
                        </td>
                        <td className="border border-black px-3 py-1.5 text-right" colSpan={4}>
                            {formatExportCurrency(gstAmount)}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black px-3 py-1.5" colSpan={4}>
                            TDS Deducted ({tdsPercent}%)
                        </td>
                        <td className="border border-black px-3 py-1.5 text-right" colSpan={4}>
                            {formatExportCurrency(tdsAmount)}
                        </td>
                    </tr>
                    <tr className={purchaseOrderPreviewStyles.subTotalBg}>
                        <td className="border border-black px-3 py-2 font-bold" colSpan={4}>
                            Total Client Billed Amount
                        </td>
                        <td
                            className="border border-black px-3 py-2 text-right font-bold"
                            colSpan={4}
                        >
                            {formatExportCurrency(totalClientBilledAmount)}
                        </td>
                    </tr>
                    <tr className={purchaseOrderPreviewStyles.totalBg}>
                        <td className="border border-black px-3 py-2 font-bold" colSpan={4}>
                            Client Billed Amount without GST
                        </td>
                        <td
                            className="border border-black px-3 py-2 text-right font-bold"
                            colSpan={4}
                        >
                            {formatExportCurrency(clientBilledWithoutGst)}
                        </td>
                    </tr>
                    <tr className={purchaseOrderPreviewStyles.balanceBg}>
                        <td
                            className={`border border-black px-3 py-2 font-bold text-sm ${
                                profit < 0 ? "text-destructive" : "text-green-800"
                            }`}
                            colSpan={4}
                        >
                            Profit
                        </td>
                        <td
                            className={`border border-black px-3 py-2 text-right font-bold text-sm ${
                                profit < 0 ? "text-destructive" : "text-green-800"
                            }`}
                            colSpan={4}
                        >
                            {formatExportCurrency(profit)}
                        </td>
                    </tr>
                    <tr className={purchaseOrderPreviewStyles.advanceBg}>
                        <td className="border border-black px-3 py-2 font-bold" colSpan={4}>
                            Net Hand
                        </td>
                        <td
                            className="border border-black px-3 py-2 text-right font-bold"
                            colSpan={4}
                        >
                            {formatExportCurrency(netHand)}
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
