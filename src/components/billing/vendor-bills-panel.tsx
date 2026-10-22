"use client";

import { useMemo, useState } from "react";
import { Eye, Pencil, Receipt, Trash2, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { BillItemsTable, type BillItemRow } from "./bill-items-table";
import { VendorBillConfirmModal, type VendorBillFormValues } from "./bill-confirm-modal";
import { DeleteBillConfirmationModal } from "./delete-bill-confirmation-modal";
import { BillPreviewModal } from "./bill-preview-modal";
import { BillStatusBadge } from "./bill-status-badge";
import { BillTotalsCard, type BillTotalRow } from "./bill-totals-card";
import { buildVendorBillNumber } from "@/lib/api/bill";
import {
    billSummaryRow,
    toFilenameFragment,
    type BillDocumentConfig,
} from "@/lib/billing-export/bill-document";
import { formatShortDate, toDatePart } from "@/lib/utils/date";
import { resolveBillStatus } from "@/lib/utils/bill-status";
import {
    buildVendorBillGroups,
    getBillableLineAmount,
    type VendorBillGroup,
} from "@/lib/utils/billing";
import type { BillStatus, VendorBill } from "@/types/bill";
import type { EventResponse } from "@/types/event";
import type { Vendor } from "@/types/vendor";

interface VendorBillsPanelProps {
    event: EventResponse;
    vendors: Vendor[];
    vendorBills: VendorBill[];
    loading: boolean;
    generating: boolean;
    /** `true` while a bill is being deleted. */
    deleting: boolean;
    /** `true` while a bill is being updated. */
    updating: boolean;
    /** `true` while the status of a bill is being updated. */
    updatingStatus?: boolean;
    onGenerate: (body: Partial<VendorBill>) => Promise<boolean>;
    /** Updates an already generated vendor bill. */
    onEdit: (bill: VendorBill, body: Partial<VendorBill>) => Promise<boolean>;
    /** Deletes an already generated vendor bill. */
    onDelete: (bill: VendorBill) => Promise<boolean>;
    /** Updates the status of an already generated vendor bill. */
    onStatusChange?: (bill: VendorBill, status: BillStatus) => void | Promise<boolean>;
    /** Whether the user may raise a bill. */
    canGenerate: boolean;
}

/**
 * Vendor billing section of the manage billing modal.
 *
 * The purchase order of an event is stored as the event's line items plus a
 * per vendor rollup (`event.vendorSummary`). Amounts are taken from the
 * purchase order quantities and rates, never from the estimate, because the
 * two can differ.
 */
export function VendorBillsPanel({
    event,
    vendors,
    vendorBills,
    loading,
    generating,
    deleting,
    updating,
    updatingStatus = false,
    onGenerate,
    onEdit,
    onDelete,
    onStatusChange,
    canGenerate,
}: VendorBillsPanelProps) {
    const [selectedVendorKey, setSelectedVendorKey] = useState<string | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    // `true` when the confirmation modal edits the existing bill instead of
    // creating a new one.
    const [editing, setEditing] = useState(false);

    const eventID = event.eventID ?? event.id ?? "";

    const groups = useMemo<VendorBillGroup[]>(
        () => buildVendorBillGroups(event.items, event.vendorSummary, vendors),
        [event.items, event.vendorSummary, vendors],
    );

    // The selection is resolved against the current groups, so a vendor that
    // disappears (e.g. after a refresh) can never leave stale data on screen.
    const selectedGroup = useMemo(() => {
        if (groups.length === 0) return null;
        const match = groups.find(group => group.vendorKey === selectedVendorKey);
        return match ?? groups[0];
    }, [groups, selectedVendorKey]);

    const vendor = useMemo(
        () => vendors.find(entry => entry.id === selectedGroup?.vendorKey) ?? null,
        [selectedGroup?.vendorKey, vendors],
    );

    const items = useMemo<BillItemRow[]>(
        () =>
            (selectedGroup?.items ?? []).map(line => ({
                name: line.item || "—",
                details: line.description || "",
                quantity: line.quantity ?? 0,
                unit: line.unit?.trim() || "nos",
                rate: line.pricePerItem ?? 0,
                amount: getBillableLineAmount(line),
            })),
        [selectedGroup],
    );

    const existingBill = useMemo(() => {
        if (!selectedGroup || !eventID) return null;
        const reference = buildVendorBillNumber(eventID, selectedGroup.vendorKey);
        const byReference = vendorBills.find(bill => (bill.invoiceNumber ?? "") === reference);
        if (byReference) return byReference;

        // The reference can be edited afterwards, so the vendor name is used
        // as a fallback to find the bill of the selected vendor.
        return vendorBills.find(bill => (bill.name ?? "") === selectedGroup.vendorName) ?? null;
    }, [eventID, selectedGroup, vendorBills]);

    const billNo =
        existingBill?.invoiceNumber ??
        (eventID && selectedGroup ? buildVendorBillNumber(eventID, selectedGroup.vendorKey) : "");
    const billDate = existingBill?.billCreateDate ?? new Date().toISOString();

    const totals = selectedGroup?.totals;

    const totalsRows = useMemo<BillTotalRow[]>(
        () =>
            totals
                ? [
                      {
                          label: "Purchase order subtotal",
                          value: totals.subtotal,
                          hint: `${items.length} line ${items.length === 1 ? "item" : "items"}`,
                      },
                      { label: `GST (${totals.gstPercent}%)`, value: totals.gstAmount },
                      {
                          label: `TDS (${totals.tdsPercent}%)`,
                          value: totals.tdsAmount,
                          deduction: totals.tdsAmount > 0,
                      },
                      {
                          label: "Net amount payable",
                          value: totals.totalAmount,
                          emphasis: "total",
                      },
                      { label: "Advance paid", value: totals.paidAmount },
                      {
                          label: "Outstanding balance",
                          value: totals.outstandingAmount,
                          emphasis: "total",
                      },
                  ]
                : [],
        [items.length, totals],
    );

    /** The values shown in the confirmation modal before the bill is created. */
    const formValues = useMemo<VendorBillFormValues>(() => {
        // In edit mode the modal is seeded with the values of the bill that is
        // already stored, so nothing is silently overwritten.
        if (editing && existingBill) {
            return {
                invoiceNumber: existingBill.invoiceNumber ?? billNo,
                billCreateDate:
                    toDatePart(existingBill.billCreateDate) ||
                    new Date().toISOString().slice(0, 10),
                eventDate: toDatePart(existingBill.eventDate) || toDatePart(event.eventStartDate),
                name: existingBill.name ?? selectedGroup?.vendorName ?? "",
                phone: existingBill.phone ?? vendor?.phone ?? "",
                address: existingBill.address ?? vendor?.billingAddress ?? "",
                gst: existingBill.gst ?? (vendor?.gst != null ? String(vendor.gst) : ""),
                gstCertificate: existingBill.gstCertificate ?? vendor?.gstCertificate ?? "",
                accountHolderName:
                    existingBill.accountHolderName ?? selectedGroup?.vendorName ?? "",
            };
        }

        return {
            invoiceNumber: billNo,
            billCreateDate:
                toDatePart(existingBill?.billCreateDate) || new Date().toISOString().slice(0, 10),
            eventDate: toDatePart(event.eventStartDate),
            name: selectedGroup?.vendorName ?? "",
            phone: vendor?.phone ?? "",
            address: vendor?.billingAddress ?? "",
            gst: vendor?.gst != null ? String(vendor.gst) : "",
            gstCertificate: vendor?.gstCertificate ?? "",
            accountHolderName: selectedGroup?.vendorName ?? "",
        };
    }, [billNo, editing, event.eventStartDate, existingBill, selectedGroup, vendor]);

    const documentConfig = useMemo<BillDocumentConfig>(
        () => ({
            title: `Vendor Bill — ${selectedGroup?.vendorName ?? "Vendor"}`,
            subtitle: event.title ?? "",
            billNumber: billNo,
            billDate: formatShortDate(billDate) || billDate,
            meta: [
                { label: "Vendor", value: selectedGroup?.vendorName ?? "—" },
                { label: "Billing Address", value: vendor?.billingAddress ?? "—" },
                { label: "GSTIN", value: vendor?.gst ? String(vendor.gst) : "—" },
                { label: "Phone", value: vendor?.phone ?? "—" },
                { label: "Event", value: event.title ?? "—" },
                { label: "Event ID", value: eventID || "—" },
                {
                    label: "Event Date",
                    value: formatShortDate(event.eventStartDate) || "—",
                },
                { label: "Venue", value: event.venue ?? event.location ?? "—" },
            ],
            items: items.map(item => ({
                name: item.name,
                details: item.details ?? "",
                quantity: item.quantity,
                unit: item.unit ?? "nos",
                rate: item.rate,
                amount: item.amount,
            })),
            summary: totals
                ? [
                      billSummaryRow("Purchase order subtotal", totals.subtotal, "subtotal"),
                      billSummaryRow(`GST (${totals.gstPercent}%)`, totals.gstAmount, "tax"),
                      billSummaryRow(`TDS (${totals.tdsPercent}%)`, totals.tdsAmount, "deduction"),
                      billSummaryRow("Net amount payable", totals.totalAmount, "total"),
                      billSummaryRow("Advance paid", totals.paidAmount, "paid"),
                      billSummaryRow("Outstanding", totals.outstandingAmount, "outstanding"),
                  ]
                : [],
            totalAmount: totals?.totalAmount ?? 0,
            filenameBase: `VendorBill_${toFilenameFragment(
                selectedGroup?.vendorName ?? "vendor",
            )}_${toFilenameFragment(billNo)}`,
        }),
        [billDate, billNo, event, eventID, items, selectedGroup, totals, vendor],
    );

    /**
     * Creates the bill with the values confirmed in the modal.
     *
     * The line items and their prices always come from the purchase order,
     * they are not editable in the modal.
     */
    const handleConfirm = async (values: VendorBillFormValues) => {
        if (!selectedGroup) return false;

        // On an edit the stored line items are kept, so only the bill details
        // are changed.
        const billItems =
            editing && existingBill?.items?.length
                ? existingBill.items
                : items.map(item => ({
                      item: item.name,
                      description: item.details ?? "",
                      quantity: Math.round(item.quantity ?? 0),
                      pricePerItem: item.rate,
                      unit: item.unit ?? "nos",
                      finalAmt: item.amount,
                      days: 1,
                      vendor: selectedGroup.vendorName,
                  }));

        const body: Partial<VendorBill> = {
            name: values.name,
            phone: values.phone,
            address: values.address,
            gst: values.gst,
            gstCertificate: values.gstCertificate,
            accountHolderName: values.accountHolderName,
            invoiceNumber: values.invoiceNumber,
            billCreateDate: values.billCreateDate || null,
            eventDate: values.eventDate || null,
            items: billItems,
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

    if (groups.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-8 text-center">
                <Truck size={22} className="text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">
                    No purchase order found for this event
                </p>
                <p className="max-w-md text-xs text-muted-foreground">
                    Vendor bills are raised from the purchase orders of the event. Create a purchase
                    order first, then come back to raise the vendor bills.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="lg:col-span-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Vendor
                    </label>
                    <Select
                        id="billing-vendor-select"
                        className="mt-1"
                        options={groups.map(group => ({
                            label: group.vendorName,
                            value: group.vendorKey,
                        }))}
                        value={
                            selectedGroup
                                ? {
                                      label: selectedGroup.vendorName,
                                      value: selectedGroup.vendorKey,
                                  }
                                : null
                        }
                        onChange={option => {
                            if (option?.value) setSelectedVendorKey(option.value);
                        }}
                        placeholder="Select a vendor"
                    />
                    <p className="mt-2 text-[11px] text-muted-foreground">
                        {groups.length} {groups.length === 1 ? "vendor" : "vendors"} with a purchase
                        order on this event.
                    </p>
                </div>

                <div className="lg:col-span-2">
                    <BillTotalsCard
                        title="Vendor bill breakdown"
                        icon={<Receipt size={14} />}
                        rows={totalsRows}
                    />
                </div>
            </div>

            <section className="rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                            Vendor bill
                        </h4>
                        {existingBill ? (
                            <Badge variant="success">Generated</Badge>
                        ) : (
                            <Badge variant="warning">Not generated</Badge>
                        )}
                        {existingBill && (
                            <BillStatusBadge
                                status={resolveBillStatus(
                                    existingBill.status,
                                    totals?.outstandingAmount ?? null,
                                    totals?.paidAmount ?? null,
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
                        {existingBill?.invoiceNumber && (
                            <span className="text-xs text-muted-foreground">
                                {existingBill.invoiceNumber}
                            </span>
                        )}
                        {existingBill?.billCreateDate && (
                            <span className="text-xs text-muted-foreground">
                                · {formatShortDate(existingBill.billCreateDate)}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            size="sm"
                            icon={<Receipt size={14} />}
                            isLoading={generating}
                            disabled={
                                generating || updating || existingBill !== null || !canGenerate
                            }
                            onClick={() => {
                                setEditing(false);
                                setConfirmOpen(true);
                            }}
                        >
                            {existingBill ? "Bill already generated" : "Generate vendor bill"}
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
                            <Tooltip content="Delete the generated vendor bill">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-error hover:text-error"
                                    aria-label="Delete vendor bill"
                                    disabled={deleting || updating || !canGenerate}
                                    onClick={() => setDeleteOpen(true)}
                                >
                                    <Trash2 size={14} />
                                </Button>
                            </Tooltip>
                        )}
                    </div>
                </div>

                {!canGenerate && (
                    <p className="mt-3 text-[11px] text-muted-foreground">
                        You do not have permission to raise vendor bills.
                    </p>
                )}
            </section>

            <section>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                    Purchase order items
                </h4>
                <BillItemsTable
                    items={items}
                    emptyMessage="This vendor has no purchase order items for this event."
                />
            </section>

            <BillPreviewModal
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                config={documentConfig}
                title="Vendor bill preview"
                description={`${selectedGroup?.vendorName ?? "Vendor"} · ${event.title ?? ""}`}
                items={items}
            />

            <VendorBillConfirmModal
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleConfirm}
                defaultValues={formValues}
                submitting={generating || updating}
                mode={editing ? "edit" : "create"}
            />

            <DeleteBillConfirmationModal
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={handleDelete}
                title="Delete vendor bill?"
                description={
                    existingBill?.invoiceNumber
                        ? `The vendor bill ${existingBill.invoiceNumber} will be permanently deleted. This action cannot be undone.`
                        : "The vendor bill will be permanently deleted. This action cannot be undone."
                }
                isLoading={deleting}
            />
        </div>
    );
}
