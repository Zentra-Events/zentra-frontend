import { useMemo } from "react";
import type { EventResponse } from "@/types/event";
import { calculatePercentageAmount, formatExportCurrency } from "@/lib/utils";
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
        const safeTotalEstimatedCost = Number(totalEstimatedCost ?? 0) || 0;

        // eventData.gst / eventData.tds are percentages (e.g. 18 for 18%),
        // consistent with vendor-level gst/tds and calculatePercentageAmount
        // usage across the codebase (amount * percentage / 100).
        const eventGst = Number(eventData.gst ?? 0) || 0;
        const eventTds = Number(eventData.tds ?? 0) || 0;
        const eventServiceCharge = Number(eventData.serviceCharge ?? 0) || 0;
        const eventDiscount = Number(eventData.discounts ?? 0) || 0;

        // 1. Estimated amount = totalEstimatedCost
        const estimatedAmount = safeTotalEstimatedCost;

        // 2. Service Charge = totalEstimatedCost * eventData.serviceCharge (%)
        const serviceChargeAmount = calculatePercentageAmount(
            safeTotalEstimatedCost,
            eventServiceCharge,
        );

        // 3. Discount = eventData.discounts (flat Rs amount)
        const discountAmount = eventDiscount;

        // Taxable amount = totalEstimatedCost + ServiceCharge - Discount
        const taxableAmount = safeTotalEstimatedCost + serviceChargeAmount - discountAmount;

        // 4. GST = taxableAmount * eventData.gst
        const gstAmount = calculatePercentageAmount(taxableAmount, eventGst);

        // 5. TDS Deducted = taxableAmount * eventData.tds
        const tdsAmount = calculatePercentageAmount(taxableAmount, eventTds);

        // 6. Total Client Billed Amount = taxableAmount + GST - TDS
        const totalClientBilledAmount = taxableAmount + gstAmount - tdsAmount;

        // 7. Client Billed Amount without GST = Total Client Billed Amount - GST
        const clientBilledWithoutGst = totalClientBilledAmount - gstAmount;

        // Vendor totals derived from the existing vendor-wise data source
        // (eventData.vendorSummary) using existing vendor-level fields.
        const vendorList = eventData.vendorSummary ?? [];

        const safeNum = (v: unknown): number => {
            const n = Number(v ?? 0);
            return Number.isFinite(n) ? n : 0;
        };

        // Total vendor GST amount = sum of GST applicable to all vendors.
        const totalVendorGst = vendorList.reduce((sum, v) => {
            const base = safeNum(v.totalAmount);
            return sum + calculatePercentageAmount(base, safeNum(v.gst));
        }, 0);

        // Total vendor TDS = sum of TDS deducted from all vendors.
        const totalVendorTds = vendorList.reduce((sum, v) => {
            const base = safeNum(v.totalAmount);
            return sum + calculatePercentageAmount(base, safeNum(v.tds));
        }, 0);

        // Total vendor amount including GST and deducting each vendor tds
        // = sum of each vendor's (vendor amount + vendor GST - vendor TDS).
        const totalVendorNet = vendorList.reduce((sum, v) => {
            const base = safeNum(v.totalAmount);
            const vGst = calculatePercentageAmount(base, safeNum(v.gst));
            const vTds = calculatePercentageAmount(base, safeNum(v.tds));
            return sum + base + vGst - vTds;
        }, 0);

        // 6. Profit = (Client Billed without GST + total vendor GST)
        //    - (Total vendor TDS + Total vendor net)
        const profit =
            clientBilledWithoutGst + totalVendorGst - (totalVendorTds + totalVendorNet);

        // 7. Net Hand = Client Billed without GST - (Total vendor TDS + Total vendor net)
        const netHand = clientBilledWithoutGst - (totalVendorTds + totalVendorNet);

        return {
            estimatedAmount,
            serviceChargeAmount,
            serviceChargePercent: eventServiceCharge,
            discountAmount,
            gstAmount,
            gstPercent: eventGst,
            tdsAmount,
            tdsPercent: eventTds,
            totalClientBilledAmount,
            clientBilledWithoutGst,
            profit,
            netHand,
        };
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
