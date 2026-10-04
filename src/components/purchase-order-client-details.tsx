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

/**
 * Formats a numeric field value for display inside a controlled number input.
 *
 * The client financials state stores numbers and defaults them to `0`, so
 * binding that value directly (e.g. `value={x}`) renders a `0` the user has to
 * clear before typing. Rendering an empty string for `0` / null / undefined /
 * NaN keeps the field blank until the user actually enters a value.
 */
export function toNumericInputValue(value: number | null | undefined): string | number {
    if (value === null || value === undefined || Number.isNaN(value) || value === 0) {
        return "";
    }
    return value;
}

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

/**
 * A single filtered estimate version (status EVENT_CREATED or EVENT_MERGED)
 * shown in the Estimates section. Only its expense total is surfaced.
 */
export interface EstimateExpensesRow {
    id: string;
    versionTitle?: string;
    estimateStatus?: string;
    expensesTotal: number;
}

interface PurchaseOrderClientDetailsProps {
    clientName: string;
    eventName: string;
    eventDescription: string;
    clientFinancials: ClientFinancials;
    onFinancialChange: (field: keyof ClientFinancials, value: string) => void;
    /**
     * Filtered estimate versions (status EVENT_CREATED / EVENT_MERGED).
     * Each estimate's expensesTotal is displayed together with the sum of all.
     */
    estimates: EstimateExpensesRow[];
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
    estimates,
}: PurchaseOrderClientDetailsProps) {
    // Sum of every filtered estimate's expensesTotal.
    const totalExpenses = estimates.reduce(
        (sum, estimate) => sum + (estimate.expensesTotal ?? 0),
        0,
    );

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
            {/* Estimates – event created / merged estimate expense figures */}
            <div className="mt-5 pt-5 border-t border-border">
                <h4 className="text-sm font-bold uppercase tracking-widest text-primary mb-1">
                    Estimates
                </h4>
                <p className="text-xs text-muted-foreground mb-3">
                    Event created / merged estimate expenses for this engagement
                </p>
                {estimates.length === 0 ? (
                    <p className="text-xs italic text-muted-foreground">
                        No event created or merged estimates available.
                    </p>
                ) : (
                    <div className="rounded-xl bg-primary/[0.04] border border-primary/10 divide-y divide-primary/10">
                        {estimates.map(estimate => (
                            <div
                                key={estimate.id}
                                className="flex items-center justify-between gap-4 px-4 py-2.5"
                            >
                                <div className="flex flex-col text-left">
                                    <span className="text-xs font-semibold text-foreground">
                                        {estimate.versionTitle || "Estimate"}
                                    </span>
                                    {estimate.estimateStatus && (
                                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                            {estimate.estimateStatus.replace(/_/g, " ")}
                                        </span>
                                    )}
                                </div>
                                <span className="text-sm font-bold text-foreground">
                                    {formatCurrency(estimate.expensesTotal)}
                                </span>
                            </div>
                        ))}
                        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-primary/[0.06]">
                            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                                Total Expenses
                            </span>
                            <span className="text-lg font-extrabold text-foreground">
                                {formatCurrency(totalExpenses)}
                            </span>
                        </div>
                    </div>
                )}
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
                        value={toNumericInputValue(clientFinancials.serviceCharge)}
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
                        value={toNumericInputValue(clientFinancials.gst)}
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
                        value={toNumericInputValue(clientFinancials.discount)}
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
                        value={toNumericInputValue(clientFinancials.tds)}
                        onChange={e => onFinancialChange("tds", e.target.value)}
                        smallLabel
                    />
                    <Input
                        id="client-received-amount"
                        label="Received Amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={toNumericInputValue(clientFinancials.receivedAmount)}
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
