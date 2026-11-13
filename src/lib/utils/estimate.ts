import { calculatePercentageAmount } from ".";

export function calculateEstimateSummary({
    totalAmount,
    gst,
    gstType,
    serviceCharge,
    discounts,
}: {
    totalAmount: number;
    gst: number;
    gstType?: string;
    serviceCharge: number;
    discounts: number;
}) {
    const serviceChargeAmount = calculatePercentageAmount(totalAmount, serviceCharge);
    const totalWithServiceCharge = totalAmount + serviceChargeAmount;
    const totalAfterDiscounts = totalAmount ? totalWithServiceCharge - discounts : 0;
    // When GST type is "No GST" (NONE), do not apply any GST even if a
    // non-zero gst percent is present in state.
    const gstAmount = gstType === "NONE" ? 0 : calculatePercentageAmount(totalAfterDiscounts, gst);
    const totalWithGST = totalAfterDiscounts + gstAmount;

    return {
        totalWithServiceCharge,
        totalWithGST,
        serviceChargeAmount,
        gstAmount,
    };
}
