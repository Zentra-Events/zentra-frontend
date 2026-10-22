"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Eye, FileText, Pencil, Receipt, Trash2, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { Tooltip } from "@/components/ui/tooltip";
import { BillItemsTable, type BillItemRow } from "./bill-items-table";
import { ClientBillConfirmModal, type ClientBillFormValues } from "./bill-confirm-modal";
import { DeleteBillConfirmationModal } from "./delete-bill-confirmation-modal";
import { BillPreviewModal } from "./bill-preview-modal";
import { BillStatusBadge } from "./bill-status-badge";
import { BillTotalsCard, type BillTotalRow } from "./bill-totals-card";
import { buildClientBillNumber } from "@/lib/api/bill";
import { billSummaryRow, toFilenameFragment } from "@/lib/billing-export/bill-document";
import type { BillDocumentConfig } from "@/lib/billing-export/bill-document";
import { formatShortDate, toDatePart, toLocalDateTime } from "@/lib/utils/date";
import { resolveBillStatus } from "@/lib/utils/bill-status";
import {
    calculateClientBillTotals,
    calculateEventProfitAndLoss,
    flattenEstimateItems,
    getEstimateItemAmount,
    getEstimateItemDetails,
    getEstimateItemName,
    getEstimateItemRate,
    getEstimateItemUnit,
    selectBillableEstimates,
    sumBillableEstimateAmount,
} from "@/lib/utils/billing";
import type { BillStatus, ClientBill } from "@/types/bill";
import type { Client } from "@/types/client";
import type { EstimateDto } from "@/types/estimate";
import type { EventResponse } from "@/types/event";

interface ClientBillsPanelProps {
    event: EventResponse;
    client: Client | null;
    /** Every estimate version of the event. */
    estimates: EstimateDto[];
    clientBills: ClientBill[];
    loading: boolean;
    generating: boolean;
    /** `true` while a bill is being deleted. */
    deleting: boolean;
    /** `true` while a bill is being updated. */
    updating: boolean;
    /** `true` while the status of a bill is being updated. */
    updatingStatus?: boolean;
    onGenerate: (body: Partial<ClientBill>) => Promise<boolean>;
    /** Updates an already generated client bill. */
    onEdit: (bill: ClientBill, body: Partial<ClientBill>) => Promise<boolean>;
    /** Deletes an already generated client bill. */
    onDelete: (bill: ClientBill) => Promise<boolean>;
    /** Updates the status of an already generated client bill. */
    onStatusChange?: (bill: ClientBill, status: BillStatus) => void | Promise<boolean>;
    /** Opens the billing details editor of the event. */
    onEditBillingDetails: () => void;
    /** Whether the user may raise a bill. */
    canGenerate: boolean;
}

/**
 * Client billing section of the manage billing modal.
 *
 * The billable amount comes from the estimate versions that are part of the
 * event (the estimate the event was created from plus every additional
 * estimate merged into it). The tax, service charge, discount and received
 * amount come from the event's billing details.
 */
export function ClientBillsPanel({
    event,
    client,
    estimates,
    clientBills,
    loading,
    generating,
    deleting,
    updating,
    updatingStatus = false,
    onGenerate,
    onEdit,
    onDelete,
    onStatusChange,
    onEditBillingDetails,
    canGenerate,
}: ClientBillsPanelProps) {
    const [previewOpen, setPreviewOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    // `true` when the confirmation modal edits the existing bill instead of
    // creating a new one.
    const [editing, setEditing] = useState(false);

    const eventID = event.eventID ?? event.id ?? "";

    const billableEstimates = useMemo(() => selectBillableEstimates(estimates), [estimates]);

    const baseAmount = useMemo(
        () => sumBillableEstimateAmount(billableEstimates),
        [billableEstimates],
    );

    const totals = useMemo(
        () =>
            calculateClientBillTotals({
                baseAmount,
                serviceChargePercent: event.serviceCharge ?? 0,
                discountAmount: event.discounts ?? 0,
                gstPercent: event.gst ?? 0,
                tdsPercent: event.tds ?? 0,
                receivedAmount: event.advanceAmt ?? 0,
            }),
        [baseAmount, event.serviceCharge, event.discounts, event.gst, event.tds, event.advanceAmt],
    );

    // Profit / net hand use the shared event P&L rule so the figures match the
    // profit summary shown on the purchase order preview.
    const profitAndLoss = useMemo(
        () =>
            calculateEventProfitAndLoss({
                totalEstimatedCost: baseAmount,
                gstPercent: event.gst ?? 0,
                tdsPercent: event.tds ?? 0,
                serviceChargePercent: event.serviceCharge ?? 0,
                discountAmount: event.discounts ?? 0,
                vendorSummaries: event.vendorSummary ?? [],
            }),
        [
            baseAmount,
            event.gst,
            event.tds,
            event.serviceCharge,
            event.discounts,
            event.vendorSummary,
        ],
    );

    const items = useMemo<BillItemRow[]>(() => {
        return billableEstimates.flatMap(estimate =>
            flattenEstimateItems(estimate).map(line => ({
                name: getEstimateItemName(line),
                details: getEstimateItemDetails(line),
                quantity: line.quantity ?? 0,
                unit: getEstimateItemUnit(line),
                rate: getEstimateItemRate(line),
                amount: getEstimateItemAmount(line),
            })),
        );
    }, [billableEstimates]);

    // The bill of the event is the one whose reference carries the event id;
    // the first bill is used as a fallback for bills raised before the
    // reference carried the event.
    const existingBill = useMemo(() => {
        if (clientBills.length === 0) return null;
        const prefix = `CB/${eventID}/`;
        return clientBills.find(bill => (bill.billNo ?? "").startsWith(prefix)) ?? clientBills[0];
    }, [clientBills, eventID]);
    const billNo = existingBill?.billNo ?? (eventID ? buildClientBillNumber(eventID) : "");
    const billDate = existingBill?.billDate ?? new Date().toISOString();

    const totalsRows = useMemo<BillTotalRow[]>(
        () => [
            {
                label: "Approved estimated amount (before tax)",
                value: totals.baseAmount,
                hint:
                    billableEstimates.length > 0
                        ? "Sum of the approved and merged estimate subtotals"
                        : undefined,
            },
            {
                label: `Service charge (${totals.serviceChargePercent}%)`,
                value: totals.serviceChargeAmount,
            },
            {
                label: "Discount",
                value: totals.discountAmount,
                deduction: totals.discountAmount > 0,
            },
            { label: "Taxable amount", value: totals.taxableAmount },
            {
                label: `GST (${totals.gstPercent}%)`,
                value: totals.gstAmount,
            },
            {
                label: `TDS (${totals.tdsPercent}%)`,
                value: totals.tdsAmount,
                deduction: totals.tdsAmount > 0,
            },
            {
                label: "Total client bill amount",
                value: totals.totalAmount,
                emphasis: "total",
                hint: "Taxable amount + GST − TDS",
            },
            {
                label: "Amount received",
                value: totals.receivedAmount,
                hint: "Advance received from the client",
            },
            {
                label: "Outstanding balance",
                value: totals.outstandingAmount,
                emphasis: "total",
                hint: "Total bill amount − amount received",
            },
        ],
        [billableEstimates.length, totals],
    );

    /** The values shown in the confirmation modal before the bill is created. */
    const formValues = useMemo<ClientBillFormValues>(() => {
        // In edit mode the modal is seeded with the values of the bill that is
        // already stored, so nothing is silently overwritten.
        if (editing && existingBill) {
            return {
                billNo: existingBill.billNo ?? billNo,
                billDate:
                    toDatePart(existingBill.billDate) || new Date().toISOString().slice(0, 10),
                event: existingBill.event ?? event.title ?? "",
                eventDate: toDatePart(existingBill.eventDate) || toDatePart(event.eventStartDate),
                clientPONumber: existingBill.clientPONumber ?? "",
                phonecompany: existingBill.phonecompany ?? client?.phone ?? "",
                estimateNo:
                    existingBill.estimateNo ??
                    billableEstimates
                        .map(estimate => estimate.versionTitle ?? estimate.id ?? "")
                        .filter(Boolean)
                        .join(", ") ??
                    event.estimateId ??
                    "",
                enquiryCordinate: existingBill.enquiryCordinate ?? event.enquiryId ?? "",
            };
        }

        return {
            billNo,
            billDate: toDatePart(billDate) || new Date().toISOString().slice(0, 10),
            event: event.title ?? "",
            eventDate: toDatePart(event.eventStartDate),
            clientPONumber: "",
            phonecompany: client?.phone ?? "",
            estimateNo:
                billableEstimates
                    .map(estimate => estimate.versionTitle ?? estimate.id ?? "")
                    .filter(Boolean)
                    .join(", ") ||
                event.estimateId ||
                "",
            enquiryCordinate: event.enquiryId ?? "",
        };
    }, [billableEstimates, billDate, billNo, client?.phone, editing, event, existingBill]);

    const documentConfig = useMemo<BillDocumentConfig>(
        () => ({
            title: `Client Bill — ${event.title ?? "Event"}`,
            subtitle: client?.name ?? event.client ?? "",
            billNumber: billNo,
            billDate: formatShortDate(billDate) || billDate,
            meta: [
                { label: "Client", value: client?.name ?? event.client ?? "—" },
                {
                    label: "Billing Address",
                    value: event.billingAddress ?? client?.address ?? "—",
                },
                { label: "GSTIN", value: client?.gst ?? "—" },
                { label: "PAN", value: event.pan ?? client?.pan ?? "—" },
                { label: "Event", value: event.title ?? "—" },
                { label: "Event ID", value: eventID || "—" },
                {
                    label: "Event Date",
                    value: formatShortDate(event.eventStartDate) || "—",
                },
                { label: "Venue", value: event.venue ?? event.location ?? "—" },
                {
                    label: "Estimate",
                    value:
                        billableEstimates
                            .map(estimate => estimate.versionTitle ?? estimate.id ?? "")
                            .filter(Boolean)
                            .join(", ") || "—",
                },
            ],
            items: items.map(item => ({
                name: item.name,
                details: item.details ?? "",
                quantity: item.quantity,
                unit: item.unit ?? "nos",
                rate: item.rate,
                amount: item.amount,
            })),
            summary: [
                billSummaryRow("Approved estimated amount", totals.baseAmount, "subtotal"),
                billSummaryRow(
                    `Service charge (${totals.serviceChargePercent}%)`,
                    totals.serviceChargeAmount,
                    "subtotal",
                ),
                billSummaryRow("Discount", totals.discountAmount, "deduction"),
                billSummaryRow("Taxable amount", totals.taxableAmount, "subtotal"),
                billSummaryRow(`GST (${totals.gstPercent}%)`, totals.gstAmount, "tax"),
                billSummaryRow(`TDS (${totals.tdsPercent}%)`, totals.tdsAmount, "deduction"),
                billSummaryRow("Total bill amount", totals.totalAmount, "total"),
                billSummaryRow("Amount received", totals.receivedAmount, "paid"),
                billSummaryRow("Outstanding", totals.outstandingAmount, "outstanding"),
            ],
            totalAmount: totals.totalAmount,
            filenameBase: `ClientBill_${toFilenameFragment(event.title ?? "event")}_${toFilenameFragment(
                billNo,
            )}`,
        }),
        [billableEstimates, billDate, billNo, client, event, eventID, items, totals],
    );

    /**
     * Creates the bill with the values confirmed in the modal.
     *
     * Only the basic bill details come from the modal; the amounts are the
     * ones calculated from the approved estimate.
     */
    const handleConfirm = async (values: ClientBillFormValues) => {
        const body: Partial<ClientBill> = {
            estimateNo: values.estimateNo,
            enquiryCordinate: values.enquiryCordinate,
            phonecompany: values.phonecompany,
            event: values.event,
            eventDate: toLocalDateTime(values.eventDate),
            clientPONumber: values.clientPONumber,
            billNo: values.billNo,
            billDate: toLocalDateTime(values.billDate) ?? new Date().toISOString(),
            billAmt: totals.taxableAmount,
            gst: totals.gstAmount,
            totalAmt: totals.grossAmount,
            clientTDSDeduction: totals.tdsAmount,
            advanceAmtReceived: totals.receivedAmount,
            poAmt: totals.baseAmount,
            tdsPayable: profitAndLoss.totalVendorTds,
            reverseCredit: 0,
            profit: profitAndLoss.profit,
            netHand: profitAndLoss.netHand,
            // The status is managed on its own, it is kept as it is. A new
            // bill starts as unpaid.
            status: existingBill?.status ?? "UNPAID",
        };

        if (editing && existingBill) {
            return onEdit(existingBill, body);
        }

        return onGenerate(body);
    };

    const handleDelete = async () => {
        if (!existingBill) return;
        const deleted = await onDelete(existingBill);
        if (deleted) setDeleteOpen(false);
    };

    if (loading) {
        return (
            <div className="flex h-56 items-center justify-center">
                <Loading />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Client & event information */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="rounded-lg border border-border bg-surface p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                            <Receipt size={14} className="text-muted-foreground" />
                            Client details
                        </h4>
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={<Pencil size={13} />}
                            onClick={onEditBillingDetails}
                        >
                            Edit billing details
                        </Button>
                    </div>
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                        <div>
                            <dt className="text-muted-foreground">Client</dt>
                            <dd className="font-medium text-foreground">
                                {client?.name ?? event.client ?? "—"}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">GSTIN</dt>
                            <dd className="font-medium text-foreground">{client?.gst ?? "—"}</dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">PAN</dt>
                            <dd className="font-medium text-foreground">
                                {event.pan ?? client?.pan ?? "—"}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">Contact</dt>
                            <dd className="font-medium text-foreground">
                                {client?.poc || "—"}
                                {client?.phone ? ` · ${client.phone}` : ""}
                            </dd>
                        </div>
                        <div className="sm:col-span-2">
                            <dt className="text-muted-foreground">Billing address</dt>
                            <dd className="font-medium text-foreground">
                                {event.billingAddress ?? client?.address ?? "—"}
                            </dd>
                        </div>
                    </dl>
                </section>

                <section className="rounded-lg border border-border bg-surface p-4">
                    <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                        <FileText size={14} className="text-muted-foreground" />
                        Event &amp; approved estimate
                    </h4>
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                        <div>
                            <dt className="text-muted-foreground">Event</dt>
                            <dd className="font-medium text-foreground">{event.title ?? "—"}</dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">Event ID</dt>
                            <dd className="font-medium text-foreground">{eventID || "—"}</dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">Event date</dt>
                            <dd className="font-medium text-foreground">
                                {formatShortDate(event.eventStartDate) || "—"}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">Venue</dt>
                            <dd className="font-medium text-foreground">
                                {event.venue ?? event.location ?? "—"}
                            </dd>
                        </div>
                        <div className="sm:col-span-2">
                            <dt className="text-muted-foreground">Billable estimate versions</dt>
                            <dd className="font-medium text-foreground">
                                {billableEstimates.length === 0
                                    ? "No approved or merged estimate for this event"
                                    : billableEstimates
                                          .map(
                                              estimate =>
                                                  `${estimate.versionTitle ?? estimate.id ?? "Estimate"} (${
                                                      estimate.estimateStatus ?? "—"
                                                  })`,
                                          )
                                          .join(", ")}
                            </dd>
                        </div>
                    </dl>
                </section>
            </div>

            {billableEstimates.length === 0 && (
                <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-light/40 p-3 text-xs text-foreground">
                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-warning" />
                    <p>
                        This event has no estimate with the status
                        <span className="font-semibold"> EVENT_CREATED </span>or
                        <span className="font-semibold"> EVENT_MERGED</span>, so there is no
                        approved amount to bill. Approve or merge an estimate first.
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <BillTotalsCard
                    title="Bill breakdown"
                    icon={<Wallet size={14} />}
                    rows={totalsRows}
                    footer={
                        <span>
                            The bill is raised against the event&apos;s billing details. Editing
                            them changes the billable amount.
                        </span>
                    }
                />

                <section className="rounded-lg border border-border bg-surface p-4">
                    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground">
                        Client bill
                    </h4>

                    <div className="flex flex-wrap items-center gap-2">
                        {existingBill ? (
                            <Badge variant="success">Generated</Badge>
                        ) : (
                            <Badge variant="warning">Not generated</Badge>
                        )}
                        {existingBill && (
                            <BillStatusBadge
                                status={resolveBillStatus(
                                    existingBill.status,
                                    totals.outstandingAmount,
                                    totals.receivedAmount,
                                )}
                                canEdit={canGenerate}
                                disabled={updatingStatus || updating}
                                onChange={
                                    onStatusChange
                                        ? status => onStatusChange(existingBill, status)
                                        : undefined
                                }
                            />
                        )}
                        {existingBill?.billNo && (
                            <span className="text-xs text-muted-foreground">
                                {existingBill.billNo}
                            </span>
                        )}
                        {existingBill?.billDate && (
                            <span className="text-xs text-muted-foreground">
                                · {formatShortDate(existingBill.billDate)}
                            </span>
                        )}
                    </div>

                    <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                        <div>
                            <dt className="text-muted-foreground">Bill amount</dt>
                            <dd className="font-semibold text-foreground">
                                {existingBill
                                    ? `₹${(existingBill.totalAmt ?? 0).toLocaleString("en-IN")}`
                                    : "—"}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-muted-foreground">TDS deducted</dt>
                            <dd className="font-semibold text-foreground">
                                {existingBill
                                    ? `₹${(existingBill.clientTDSDeduction ?? 0).toLocaleString("en-IN")}`
                                    : "—"}
                            </dd>
                        </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button
                            size="sm"
                            icon={<Receipt size={14} />}
                            isLoading={generating}
                            disabled={
                                generating ||
                                updating ||
                                existingBill !== null ||
                                baseAmount <= 0 ||
                                !canGenerate
                            }
                            onClick={() => {
                                setEditing(false);
                                setConfirmOpen(true);
                            }}
                        >
                            {existingBill ? "Bill already generated" : "Generate client bill"}
                        </Button>
                        {existingBill && (
                            <Button
                                variant="outline"
                                size="sm"
                                icon={<Pencil size={14} />}
                                isLoading={updating}
                                disabled={updating || generating || !canGenerate}
                                onClick={() => {
                                    setEditing(true);
                                    setConfirmOpen(true);
                                }}
                            >
                                Edit
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            icon={<Eye size={14} />}
                            onClick={() => setPreviewOpen(true)}
                        >
                            Preview
                        </Button>
                        {existingBill && (
                            <Tooltip content="Delete the generated client bill">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-error hover:text-error"
                                    aria-label="Delete client bill"
                                    disabled={deleting || updating || !canGenerate}
                                    onClick={() => setDeleteOpen(true)}
                                >
                                    <Trash2 size={14} />
                                </Button>
                            </Tooltip>
                        )}
                    </div>

                    {!canGenerate && (
                        <p className="mt-3 text-[11px] text-muted-foreground">
                            You do not have permission to raise client bills.
                        </p>
                    )}
                </section>
            </div>

            <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                    Approved estimate line items
                </h4>
                <BillItemsTable
                    items={items}
                    emptyMessage="No approved estimate line items for this event."
                />
            </section>

            <BillPreviewModal
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                config={documentConfig}
                title="Client bill preview"
                description={`${event.title ?? "Event"} · ${client?.name ?? event.client ?? ""}`}
                items={items}
            />

            <ClientBillConfirmModal
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleConfirm}
                defaultValues={formValues}
                items={items}
                totals={totalsRows}
                submitting={generating || updating}
                mode={editing ? "edit" : "create"}
            />

            <DeleteBillConfirmationModal
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={handleDelete}
                title="Delete client bill?"
                description={
                    existingBill?.billNo
                        ? `The client bill ${existingBill.billNo} will be permanently deleted. This action cannot be undone.`
                        : "The client bill will be permanently deleted. This action cannot be undone."
                }
                isLoading={deleting}
            />
        </div>
    );
}
