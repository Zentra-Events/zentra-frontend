"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Shared GST option / label constants                               */
/* ------------------------------------------------------------------ */

export const GST_TYPE_OPTIONS: { label: string; value: string }[] = [
    { label: "No GST", value: "NONE" },
    { label: "CGST + SGST", value: "CGST_SGST" },
    { label: "IGST", value: "IGST" },
];

export const GST_LABEL_BY_TYPE: Record<string, string> = {
    NONE: "GST",
    CGST_SGST: "CGST + SGST",
    IGST: "IGST",
};

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/**
 * Editable client billing details for the Client Details section.
 * Pre-populated from the approved/final estimate and kept independent of the
 * vendor financial calculation.
 */
export interface ClientFinancials {
    serviceCharge: number;
    gstType: string;
    gst: number;
    discount: number;
    billingAddress: string;
    tds: number;
    receivedAmount: number;
}

interface PurchaseOrderClientDetailsProps {
    clientName: string;
    eventName: string;
    eventDescription: string;
    clientFinancials: ClientFinancials;
    onFinancialChange: (field: keyof ClientFinancials, value: string) => void;
    /** Total approved / final estimate amount (item subtotal + additional costs). */
    estimatedAmount: number;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function PurchaseOrderClientDetails({
    clientName,
    eventName,
    eventDescription,
    clientFinancials,
    onFinancialChange,
    estimatedAmount,
}: PurchaseOrderClientDetailsProps) {
    return (
        <section className="rounded-2xl border border-border bg-surface-container-low/30 p-5">
            <div className="flex items-center justify-between border-l-4 border-primary pl-4 py-1 mb-4">
                <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
                        Client Details
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        Client, event & client billing information
                    </p>
                </div>
            </div>

            {/* Client / event summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                    id="client-name"
                    label="Client Name"
                    type="text"
                    value={clientName}
                    disabled
                    smallLabel
                />
                <Input
                    id="client-event-name"
                    label="Event Name"
                    type="text"
                    value={eventName}
                    disabled
                    smallLabel
                />
                <Input
                    id="client-event-description"
                    label="Event Description"
                    type="text"
                    value={eventDescription}
                    disabled
                    smallLabel
                />
            </div>
            {/* Estimates – approved / final estimate figures */}
            <div className="mt-5 pt-5 border-t border-border">
                <h4 className="text-sm font-bold uppercase tracking-widest text-primary mb-1">
                    Estimates
                </h4>
                <p className="text-xs text-muted-foreground mb-3">
                    Approved / final estimate figures for this engagement
                </p>
                <div className="flex items-center justify-between gap-4 rounded-xl bg-primary/[0.04] border border-primary/10 px-4 py-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                        Estimated Amount
                    </span>
                    <span className="text-lg font-extrabold text-foreground">
                        {formatCurrency(estimatedAmount)}
                    </span>
                </div>
            </div>
            {/* Client Billing Details – mirrors the Create Estimate billing fields */}
            <div className="mt-5 pt-5 border-t border-border">
                <h4 className="text-sm font-bold uppercase tracking-widest text-primary mb-3">
                    Client Billing Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <Input
                        id="client-service-charge"
                        label="Service Charge (%)"
                        type="number"
                        min="0"
                        step="0.01"
                        value={clientFinancials.serviceCharge ?? ""}
                        onChange={e => onFinancialChange("serviceCharge", e.target.value)}
                        smallLabel
                    />

                    <Select
                        id="client-gst-type"
                        label="Tax Type"
                        options={GST_TYPE_OPTIONS}
                        value={
                            GST_TYPE_OPTIONS.find(
                                o => o.value === (clientFinancials.gstType ?? "NONE"),
                            ) ?? GST_TYPE_OPTIONS[0]
                        }
                        onChange={option =>
                            onFinancialChange(
                                "gstType",
                                option && option.value ? option.value : "NONE",
                            )
                        }
                        smallLabel
                    />
                    <Input
                        id="client-gst"
                        label={`${GST_LABEL_BY_TYPE[clientFinancials.gstType] ?? "GST"} (%)`}
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={clientFinancials.gst ?? ""}
                        onChange={e => onFinancialChange("gst", e.target.value)}
                        smallLabel
                        disabled={clientFinancials.gstType === "NONE"}
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                    <Input
                        id="client-discount"
                        label="Discount Amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={clientFinancials.discount ?? ""}
                        onChange={e => onFinancialChange("discount", e.target.value)}
                        smallLabel
                    />
                    <Input
                        id="client-tds"
                        label="TDS (%)"
                        type="number"
                        // min="0"
                        max="100"
                        step="0.01"
                        value={clientFinancials.tds ?? ""}
                        onChange={e => onFinancialChange("tds", e.target.value)}
                        smallLabel
                    />
                    <Input
                        id="client-received-amount"
                        label="Received Amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={clientFinancials.receivedAmount ?? ""}
                        onChange={e => onFinancialChange("receivedAmount", e.target.value)}
                        smallLabel
                    />
                </div>
                <div className="mt-4">
                    <Input
                        id="client-billing-address"
                        label="Billing Address"
                        type="text"
                        value={clientFinancials.billingAddress}
                        onChange={e => onFinancialChange("billingAddress", e.target.value)}
                        placeholder="Enter billing address"
                        smallLabel
                    />
                </div>
            </div>
        </section>
    );
}
