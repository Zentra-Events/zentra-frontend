import { useMemo } from "react";
import type { EventResponse } from "@/types/event";
import { formatExportCurrency } from "@/lib/utils";
import { calculateEventProfitAndLoss } from "@/lib/utils/billing";
import { purchaseOrderPreviewStyles } from "@/constants/event";

/* ------------------------------------------------------------------ */
/*  Profit Summary                                                    */
/*                                                                    */
/*  Internal P&L view for the event management team (admin / super    */
/*  admin only). All figures come from `calculateEventProfitAndLoss`  */
/*  in @/lib/utils/billing.ts.                                        */
/*                                                                    */
/*  INPUTS                                                             */
/*    totalEstimatedCost   — approved estimate amount (prop)          */
/*    eventData.gst        — client GST % (e.g. 18 = 18%)             */
/*    eventData.tds        — client TDS, a FLAT applied amount (NOT a %) */
/*    eventData.serviceCharge — client service charge %               */
/*    eventData.discounts  — client discount (flat amount)            */
/*    eventData.vendorSummary — vendor-wise rollup (totalAmount,      */
/*                gst, tds, adjustedAmt, advanceAmount, balance)      */
/*                                                                    */
/*  HELPER                                                             */
/*    calculatePercentageAmount(amount, pct) = amount × pct / 100     */
/*    toFiniteNumber(v, fb)                  — coerces NaN/Inf/null   */
/*                                              to fb (default 0)     */
/*                                                                    */
/*  INTERMEDIATE VALUES (client side)                                  */
/*    estimatedAmount      = totalEstimatedCost                       */
/*    serviceChargeAmount  = estimatedAmount × serviceCharge / 100    */
/*    taxableAmount        = estimatedAmount + serviceCharge - discount */
/*    gstAmount            = taxableAmount × gstPercent / 100         */
/*    tdsAmount            = eventData.tds  (flat, not percentage)    */
/*    totalClientBilled    = taxableAmount + gstAmount - tdsAmount    */
/*    clientBilledWthoutGST = totalClientBilled - gstAmount           */
/*                                        (= taxableAmount - tds)     */
/*                                                                    */
/*  VENDOR-SIDE ROLLUP (from eventData.vendorSummary)                  */
/*    totalVendorGst  = Σ vendor.totalAmount × vendor.gst   / 100     */
/*    totalVendorTds  = Σ vendor.totalAmount × vendor.tds   / 100     */
/*    totalVendorNet  = Σ (vendor.totalAmount + vendorGst             */
/*                                   - vendorTds)                     */
/*                                                                    */
/*  FINAL FIGURES                                                      */
/*    Profit  = clientBilledWithoutGST + totalVendorGst               */
/*              - (totalVendorTds + totalVendorNet)                   */
/*    Net Hand = clientBilledWithoutGST - (totalVendorTds + totalVendorNet) */
/*                                                                    */
/*  ROW ORDER                                                          */
/*   1 Total (Original + GST)     = taxableAmount + gstAmount         */
/*   2 TDS Deducted               = -tdsAmount (shown negative)       */
/*   3 Total Client Billed Amount = totalClientBilledAmount           */
/*   4 Total Vendor GST           = totalVendorGst                    */
/*   5 Total Vendor TDS           = -totalVendorTds (shown negative)  */
/*   6 Net Vendor Total           = totalVendorNet                    */
/*   7 Client Billed Amount w/o GST = clientBilledWithoutGst          */
/*   8 Profit                     = Profit (red if < 0)               */
/*   9 Net Hand                   = Net Hand                          */
/* ------------------------------------------------------------------ */

export function ProfitSummary({
    eventData,
    totalEstimatedCost,
}: {
    eventData: EventResponse;
    totalEstimatedCost: number;
}) {
    const {
        taxableAmount,
        gstAmount,
        tdsAmount,
        totalClientBilledAmount,
        clientBilledWithoutGst,
        totalVendorGst,
        totalVendorTds,
        totalVendorNet,
        profit,
        netHand,
    } = useMemo(() => {
        // eventData.gst is a percentage (e.g. 18 for 18%). eventData.tds is a
        // flat applied TDS amount (not a percentage) on the client billing
        // side; it is passed as `clientTdsAmount` so vendor-side percentage
        // logic inside `calculateEventProfitAndLoss` is unaffected.
        return calculateEventProfitAndLoss({
            totalEstimatedCost: totalEstimatedCost ?? 0,
            gstPercent: eventData.gst ?? 0,
            tdsPercent: 0,
            clientTdsAmount: eventData.tds ?? 0,
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
                            Total (Original + GST)
                        </td>
                        <td className="border border-black px-3 py-1.5 text-right" colSpan={4}>
                            {formatExportCurrency(taxableAmount + gstAmount)}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black px-3 py-1.5" colSpan={4}>
                            TDS Deducted (Applied TDS Amount)
                        </td>
                        <td className="border border-black px-3 py-1.5 text-right" colSpan={4}>
                            -{formatExportCurrency(tdsAmount)}
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
                    <tr>
                        <td className="border border-black px-3 py-1.5" colSpan={4}>
                            Total Vendor GST
                        </td>
                        <td className="border border-black px-3 py-1.5 text-right" colSpan={4}>
                            {formatExportCurrency(totalVendorGst)}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black px-3 py-1.5" colSpan={4}>
                            Total Vendor TDS
                        </td>
                        <td className="border border-black px-3 py-1.5 text-right" colSpan={4}>
                            -{formatExportCurrency(totalVendorTds)}
                        </td>
                    </tr>
                    <tr>
                        <td className="border border-black px-3 py-1.5" colSpan={4}>
                            Net Vendor Total
                        </td>
                        <td className="border border-black px-3 py-1.5 text-right" colSpan={4}>
                            {formatExportCurrency(totalVendorNet)}
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
