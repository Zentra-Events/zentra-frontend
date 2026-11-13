"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DatePickerField } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { Info, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { formatShortDate, parseApiDate } from "@/lib/utils/date";

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
    advanceAmt: number;
    amountRecievedFromClientDate: string | null;
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
    clientFinancials: ClientFinancials;
    onFinancialChange: (field: keyof ClientFinancials, value: string) => void;
    /**
     * Optional handler for Client Name edits. Client Name is not part of
     * `ClientFinancials`, so it is reported through a separate callback.
     */
    onClientNameChange?: (value: string) => void;
    /**
     * Filtered estimate versions (status EVENT_CREATED / EVENT_MERGED).
     * Each estimate's expensesTotal is displayed together with the sum of all.
     */
    estimates: EstimateExpensesRow[];
}

/* ------------------------------------------------------------------ */
/*  Presentational helpers                                            */
/* ------------------------------------------------------------------ */

/**
 * Read-only label/value pair used in the default (view) presentation.
 * Long values (e.g. billing addresses) wrap across lines instead of
 * overflowing the container.
 */
function InfoItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
            </span>
            <span className="text-sm text-foreground break-words">{value}</span>
        </div>
    );
}

/** Renders `—` for empty/undefined values so view mode never shows blank boxes. */
function placeholder(value: string | undefined): string {
    return value || "—";
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function PurchaseOrderClientDetails({
    clientName,
    clientFinancials,
    onFinancialChange,
    onClientNameChange,
    estimates,
}: PurchaseOrderClientDetailsProps) {
    // Sum of every filtered estimate's expensesTotal.
    const totalExpenses = estimates.reduce(
        (sum, estimate) => sum + (estimate.expensesTotal ?? 0),
        0,
    );

    const [isEditing, setIsEditing] = useState(false);
    // Snapshot taken when entering edit mode so Cancel can restore values.
    const [snapshot, setSnapshot] = useState<{
        clientName: string;
        financials: ClientFinancials;
    } | null>(null);

    const enterEditMode = () => {
        setSnapshot({ clientName, financials: clientFinancials });
        setIsEditing(true);
    };

    const discardChanges = () => {
        if (!snapshot) {
            setIsEditing(false);
            return;
        }
        onClientNameChange?.(snapshot.clientName);
        Object.entries(snapshot.financials).forEach(([field, value]) => {
            if (field === "amountRecievedFromClientDate") {
                onFinancialChange(field as keyof ClientFinancials, value ?? "");
                return;
            }
            onFinancialChange(field as keyof ClientFinancials, String(value));
        });
        setSnapshot(null);
        setIsEditing(false);
    };

    const saveChanges = () => {
        setSnapshot(null);
        setIsEditing(false);
    };

    const taxLabel = GST_LABEL_BY_TYPE[clientFinancials.gstType] ?? "GST";

    return (
        <section className="bg-surface-container-low/30">
            <div className="mb-4 flex items-center gap-2 p-3 rounded-lg border border-info/30 bg-info-light/40 text-info">
                <Info size={14} aria-hidden="true" />
                <div className="flex flex-col">
                    <span className="text-xs text-info leading-none">
                        Client and billing details are automatically copied from the approved
                        estimate. Please review the information and update it only if any details
                        differ from the confirmed requirements.
                    </span>
                </div>
            </div>
            <div className="flex items-center justify-between border-l-4 border-primary pl-4 py-1 mb-4">
                <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
                        Client Details
                    </h3>
                    <p className="text-xs text-muted-foreground">Client & billing information</p>
                </div>
                {isEditing ? (
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={discardChanges}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={saveChanges}>
                            Save
                        </Button>
                    </div>
                ) : (
                    <Button aria-label="Edit" variant="outline" size="sm" onClick={enterEditMode}>
                        <Pencil size={14} />
                    </Button>
                )}
            </div>

            {/* Client Details – Client Name & Billing Address */}
            {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    <Input
                        id="client-name"
                        label="Client Name"
                        type="text"
                        value={clientName}
                        onChange={e => onClientNameChange?.(e.target.value)}
                        smallLabel
                    />
                    <Input
                        id="client-billing-address"
                        label="Billing Address"
                        type="text"
                        value={clientFinancials.billingAddress}
                        onChange={e => onFinancialChange("billingAddress", e.target.value)}
                        placeholder="Enter billing address"
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
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <InfoItem label="Client Name" value={placeholder(clientName)} />
                    <InfoItem
                        label="Billing Address"
                        value={placeholder(clientFinancials.billingAddress)}
                    />
                </div>
            )}

            {/* Client Billing Information */}
            <div className="mt-5 pt-5 border-t border-border">
                {isEditing ? (
                    <>
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
                            <Input
                                id="client-gst"
                                label={`${taxLabel} (%)`}
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={toNumericInputValue(clientFinancials.gst)}
                                onChange={e => onFinancialChange("gst", e.target.value)}
                                smallLabel
                                disabled={clientFinancials.gstType === "NONE"}
                            />
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
                                label="Applied TDS Amount"
                                type="number"
                                min="0"
                                step="0.01"
                                value={toNumericInputValue(clientFinancials.tds)}
                                onChange={e => onFinancialChange("tds", e.target.value)}
                                smallLabel
                            />
                            <Input
                                id="client-advance"
                                label="Advance"
                                type="number"
                                min="0"
                                step="0.01"
                                value={toNumericInputValue(clientFinancials.advanceAmt)}
                                onChange={e => onFinancialChange("advanceAmt", e.target.value)}
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
                            <DatePickerField
                                id="client-amount-received-date"
                                label="Amount Received Date"
                                smallLabel
                                value={
                                    clientFinancials.amountRecievedFromClientDate
                                        ? parseApiDate(
                                              clientFinancials.amountRecievedFromClientDate,
                                          )
                                        : null
                                }
                                onChange={(_date, iso) =>
                                    onFinancialChange("amountRecievedFromClientDate", iso)
                                }
                                placeholderText="Select date"
                                showTimeSelect={false}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <h4 className="text-sm font-bold uppercase tracking-widest text-primary mb-3">
                            Client Billing Information
                        </h4>
                        <p className="text-xs text-muted-foreground mb-3">
                            Client billing and tax summary
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            <InfoItem
                                label="Service Charge"
                                value={`${clientFinancials.serviceCharge}%`}
                            />
                            <InfoItem label="Tax Type" value={taxLabel} />
                            <InfoItem
                                label={`${taxLabel} (%)`}
                                value={`${clientFinancials.gst}%`}
                            />
                            <InfoItem
                                label="Discount Amount"
                                value={formatCurrency(clientFinancials.discount)}
                            />
                            <InfoItem
                                label="Applied TDS Amount"
                                value={formatCurrency(clientFinancials.tds)}
                            />
                            <InfoItem
                                label="Advance"
                                value={formatCurrency(clientFinancials.advanceAmt)}
                            />
                            <InfoItem
                                label="Received Amount"
                                value={formatCurrency(clientFinancials.receivedAmount)}
                            />
                            <InfoItem
                                label="Amount Received Date"
                                value={
                                    clientFinancials.amountRecievedFromClientDate
                                        ? formatShortDate(
                                              clientFinancials.amountRecievedFromClientDate,
                                          )
                                        : "—"
                                }
                            />
                        </div>
                    </>
                )}
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
                                Total Estimated Expenses
                            </span>
                            <span className="text-lg font-extrabold text-foreground">
                                {formatCurrency(totalExpenses)}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
