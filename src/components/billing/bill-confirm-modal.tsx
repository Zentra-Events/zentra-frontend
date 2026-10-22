"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
    Building2,
    CalendarDays,
    CircleAlert,
    FileText,
    Info,
    Receipt,
    Truck,
    Wallet,
} from "lucide-react";

import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BillItemsTable, type BillItemRow } from "./bill-items-table";
import { BillTotalsCard, type BillTotalRow } from "./bill-totals-card";
import { useNestedModalEscape } from "./bill-modal-escape";

/* ------------------------------------------------------------------ */
/*  Layout helpers (mirrors the create-enquiry modal)                  */
/* ------------------------------------------------------------------ */

function RequiredMark() {
    return (
        <span className="text-error" aria-hidden="true">
            *
        </span>
    );
}

function OptionalBadge() {
    return (
        <span className="inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full bg-muted px-2 text-[11px] font-medium leading-none text-muted-foreground">
            Optional
        </span>
    );
}

function SectionHeader({
    id,
    icon,
    eyebrow,
    title,
    description,
    badge,
}: {
    id: string;
    icon: ReactNode;
    eyebrow: string;
    title: string;
    description: string;
    badge?: ReactNode;
}) {
    return (
        <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                {icon}
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {eyebrow}
                </p>
                <h3 id={id} className="mt-0.5 text-sm font-semibold text-foreground">
                    {title}
                </h3>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
            </div>
            {badge ? <span className="shrink-0">{badge}</span> : null}
        </div>
    );
}

function StepBadge({ children }: { children: ReactNode }) {
    return (
        <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {children}
        </span>
    );
}

function ErrorBanner({ message, title }: { message: string; title: string }) {
    return (
        <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-error/30 bg-error-light px-4 py-3 text-sm text-error"
        >
            <CircleAlert size={18} aria-hidden="true" />
            <div className="min-w-0">
                <p className="font-semibold">{title}</p>
                <p className="mt-0.5 break-words opacity-90">{message}</p>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Client bill                                                        */
/* ------------------------------------------------------------------ */

/** Editable fields of a client bill. */
export interface ClientBillFormValues {
    billNo: string;
    billDate: string;
    event: string;
    eventDate: string;
    clientPONumber: string;
    phonecompany: string;
    estimateNo: string;
    enquiryCordinate: string;
}

interface ClientBillConfirmModalProps {
    open: boolean;
    onClose: () => void;
    /** Called with the confirmed values; return `false` to keep the modal open. */
    onConfirm: (values: ClientBillFormValues) => Promise<boolean> | boolean;
    defaultValues: ClientBillFormValues;
    /** Read-only line items of the bill. */
    items: BillItemRow[];
    /** Read-only breakdown of the bill. */
    totals: BillTotalRow[];
    submitting?: boolean;
    /** `create` raises a new bill, `edit` updates the existing one. */
    mode?: "create" | "edit";
}

/**
 * Confirmation modal of a client bill.
 *
 * The basic bill details (reference, dates and identifiers) can be corrected
 * before the bill is created. The line items and their prices are not
 * editable here - they come from the approved estimate and are managed in the
 * purchase order section.
 */
export function ClientBillConfirmModal({
    open,
    onClose,
    onConfirm,
    defaultValues,
    items,
    totals,
    submitting = false,
    mode = "create",
}: ClientBillConfirmModalProps) {
    const isEdit = mode === "edit";
    const [values, setValues] = useState<ClientBillFormValues>(defaultValues);
    const [errors, setErrors] = useState<Partial<Record<keyof ClientBillFormValues, string>>>({});
    const [submitError, setSubmitError] = useState<string | null>(null);

    // The latest values are kept in a ref so the form is re-seeded when the
    // modal is opened without being reset by an unrelated re-render.
    const defaultValuesRef = useRef(defaultValues);
    defaultValuesRef.current = defaultValues;

    useEffect(() => {
        if (open) {
            setValues(defaultValuesRef.current);
            setErrors({});
            setSubmitError(null);
        }
    }, [open]);

    // The modal is nested in the manage billing modal, so Escape only closes
    // this modal and not the parent one.
    useNestedModalEscape(open, onClose);

    const update = (field: keyof ClientBillFormValues, value: string) => {
        setValues(prev => ({ ...prev, [field]: value }));
        setErrors(prev => ({ ...prev, [field]: undefined }));
    };

    const handleSubmit = async () => {
        const nextErrors: Partial<Record<keyof ClientBillFormValues, string>> = {};
        if (!values.billNo.trim()) nextErrors.billNo = "Bill number is required";
        if (!values.billDate.trim()) nextErrors.billDate = "Bill date is required";

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }

        setSubmitError(null);
        const ok = await onConfirm({
            ...values,
            billNo: values.billNo.trim(),
            billDate: values.billDate.trim(),
            event: values.event.trim(),
            eventDate: values.eventDate.trim(),
            clientPONumber: values.clientPONumber.trim(),
            phonecompany: values.phonecompany.trim(),
            estimateNo: values.estimateNo.trim(),
            enquiryCordinate: values.enquiryCordinate.trim(),
        });

        if (ok === false) {
            setSubmitError(
                isEdit
                    ? "The bill could not be updated. Please review the details and try again."
                    : "The bill could not be created. Please review the details and try again.",
            );
            return;
        }

        onClose();
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={isEdit ? "Edit client bill" : "Confirm client bill"}
            description={
                isEdit
                    ? "Update the bill details and save the changes."
                    : "Review and edit the bill details before creating the bill."
            }
            size="xxl"
            showCloseIcon
            closeOnEscape={false}
            icon={
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
                    <Receipt size={20} aria-hidden="true" />
                </span>
            }
        >
            <ModalBody className="space-y-5">
                {submitError && (
                    <ErrorBanner
                        title={isEdit ? "Unable to update the bill" : "Unable to create the bill"}
                        message={submitError}
                    />
                )}

                <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                    {/* Editable bill details */}
                    <div className="space-y-5">
                        <section
                            aria-labelledby="client-bill-details-heading"
                            className="flex flex-col rounded-xl border border-border bg-background p-4 sm:p-5"
                        >
                            <SectionHeader
                                id="client-bill-details-heading"
                                icon={<FileText size={18} aria-hidden="true" />}
                                eyebrow="Step 1"
                                title="Bill Details"
                                description="The reference and the dates printed on the bill."
                                badge={<StepBadge>Required</StepBadge>}
                            />
                            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Input
                                    id="client-bill-no"
                                    label={
                                        <span className="inline-flex items-center gap-1">
                                            Bill Number <RequiredMark />
                                        </span>
                                    }
                                    value={values.billNo}
                                    onChange={e => update("billNo", e.target.value)}
                                    error={errors.billNo}
                                    placeholder="CB/EVENT-1/10-2026"
                                />
                                <Input
                                    id="client-bill-date"
                                    label={
                                        <span className="inline-flex items-center gap-1">
                                            Bill Date <RequiredMark />
                                        </span>
                                    }
                                    type="date"
                                    value={values.billDate}
                                    onChange={e => update("billDate", e.target.value)}
                                    error={errors.billDate}
                                />
                                <Input
                                    id="client-bill-po-number"
                                    label={
                                        <span className="inline-flex items-center gap-1.5">
                                            Client PO Number <OptionalBadge />
                                        </span>
                                    }
                                    value={values.clientPONumber}
                                    onChange={e => update("clientPONumber", e.target.value)}
                                    placeholder="PO reference of the client"
                                />
                                <Input
                                    id="client-bill-enquiry"
                                    label={
                                        <span className="inline-flex items-center gap-1.5">
                                            Enquiry Reference <OptionalBadge />
                                        </span>
                                    }
                                    value={values.enquiryCordinate}
                                    onChange={e => update("enquiryCordinate", e.target.value)}
                                    placeholder="Enquiry the event belongs to"
                                />
                            </div>
                        </section>

                        <section
                            aria-labelledby="client-bill-parties-heading"
                            className="flex flex-col rounded-xl border border-border bg-background p-4 sm:p-5"
                        >
                            <SectionHeader
                                id="client-bill-parties-heading"
                                icon={<Building2 size={18} aria-hidden="true" />}
                                eyebrow="Step 2"
                                title="Event & Client"
                                description="Who the bill is raised against and when the event happens."
                            />
                            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Input
                                    id="client-bill-event"
                                    label="Event"
                                    value={values.event}
                                    onChange={e => update("event", e.target.value)}
                                    placeholder="Event title"
                                />
                                <Input
                                    id="client-bill-event-date"
                                    label="Event Date"
                                    type="date"
                                    value={values.eventDate}
                                    onChange={e => update("eventDate", e.target.value)}
                                />
                                <Input
                                    id="client-bill-phone"
                                    label="Client Contact Number"
                                    value={values.phonecompany}
                                    onChange={e => update("phonecompany", e.target.value)}
                                    placeholder="Contact number of the client"
                                />
                                <Input
                                    id="client-bill-estimate"
                                    label="Estimate Reference"
                                    value={values.estimateNo}
                                    onChange={e => update("estimateNo", e.target.value)}
                                    placeholder="Approved estimate version"
                                />
                            </div>
                        </section>
                    </div>

                    {/* Read-only breakdown */}
                    <div className="space-y-5">
                        <section className="rounded-xl border border-border bg-background p-4 sm:p-5">
                            <SectionHeader
                                id="client-bill-summary-heading"
                                icon={<Wallet size={18} aria-hidden="true" />}
                                eyebrow="Step 3"
                                title="Bill Summary"
                                description="Derived from the approved estimate. Item prices are managed in the purchase order."
                            />
                            <BillTotalsCard
                                className="mt-4"
                                title="Amounts"
                                rows={totals}
                                footer={
                                    <span>
                                        The amounts are read-only here. Update the estimate or the
                                        purchase order to change them.
                                    </span>
                                }
                            />
                        </section>
                    </div>
                </div>
            </ModalBody>

            <ModalFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-muted-foreground">
                    Fields marked <span className="font-semibold text-error">*</span> are required.
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onClose}
                        disabled={submitting}
                        className="w-full sm:w-auto"
                    >
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        isLoading={submitting}
                        disabled={submitting}
                        onClick={handleSubmit}
                        className="w-full sm:w-auto"
                    >
                        {submitting
                            ? isEdit
                                ? "Saving changes..."
                                : "Creating bill..."
                            : isEdit
                              ? "Save changes"
                              : "Create bill"}
                    </Button>
                </div>
            </ModalFooter>
        </Modal>
    );
}

/* ------------------------------------------------------------------ */
/*  Vendor bill                                                        */
/* ------------------------------------------------------------------ */

/** Editable fields of a vendor bill. */
export interface VendorBillFormValues {
    invoiceNumber: string;
    billCreateDate: string;
    eventDate: string;
    name: string;
    phone: string;
    address: string;
    gst: string;
    gstCertificate: string;
    accountHolderName: string;
}

interface VendorBillConfirmModalProps {
    open: boolean;
    onClose: () => void;
    /** Called with the confirmed values; return `false` to keep the modal open. */
    onConfirm: (values: VendorBillFormValues) => Promise<boolean> | boolean;
    defaultValues: VendorBillFormValues;
    submitting?: boolean;
    /** `create` raises a new bill, `edit` updates the existing one. */
    mode?: "create" | "edit";
}

/**
 * Confirmation modal of a vendor bill.
 *
 * Only the basic bill details can be edited. The purchase order items and
 * their prices are managed in the purchase order section.
 */
export function VendorBillConfirmModal({
    open,
    onClose,
    onConfirm,
    defaultValues,
    submitting = false,
    mode = "create",
}: VendorBillConfirmModalProps) {
    const isEdit = mode === "edit";
    const [values, setValues] = useState<VendorBillFormValues>(defaultValues);
    const [errors, setErrors] = useState<Partial<Record<keyof VendorBillFormValues, string>>>({});
    const [submitError, setSubmitError] = useState<string | null>(null);

    // The latest values are kept in a ref so the form is re-seeded when the
    // modal is opened without being reset by an unrelated re-render.
    const defaultValuesRef = useRef(defaultValues);
    defaultValuesRef.current = defaultValues;

    useEffect(() => {
        if (open) {
            setValues(defaultValuesRef.current);
            setErrors({});
            setSubmitError(null);
        }
    }, [open]);

    // The modal is nested in the manage billing modal, so Escape only closes
    // this modal and not the parent one.
    useNestedModalEscape(open, onClose);

    const update = (field: keyof VendorBillFormValues, value: string) => {
        setValues(prev => ({ ...prev, [field]: value }));
        setErrors(prev => ({ ...prev, [field]: undefined }));
    };

    const handleSubmit = async () => {
        const nextErrors: Partial<Record<keyof VendorBillFormValues, string>> = {};
        if (!values.invoiceNumber.trim()) {
            nextErrors.invoiceNumber = "Invoice number is required";
        }
        if (!values.billCreateDate.trim()) nextErrors.billCreateDate = "Bill date is required";

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }

        setSubmitError(null);
        const ok = await onConfirm({
            ...values,
            invoiceNumber: values.invoiceNumber.trim(),
            billCreateDate: values.billCreateDate.trim(),
            eventDate: values.eventDate.trim(),
            name: values.name.trim(),
            phone: values.phone.trim(),
            address: values.address.trim(),
            gst: values.gst.trim(),
            gstCertificate: values.gstCertificate.trim(),
            accountHolderName: values.accountHolderName.trim(),
        });

        if (ok === false) {
            setSubmitError(
                isEdit
                    ? "The bill could not be updated. Please review the details and try again."
                    : "The bill could not be created. Please review the details and try again.",
            );
            return;
        }

        onClose();
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={isEdit ? "Edit vendor bill" : "Confirm vendor bill"}
            description={
                isEdit
                    ? "Update the bill details and save the changes."
                    : "Review and edit the bill details before creating the bill."
            }
            size="lg"
            showCloseIcon
            closeOnEscape={false}
            icon={
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
                    <Truck size={20} aria-hidden="true" />
                </span>
            }
        >
            <ModalBody className="space-y-5">
                {submitError && (
                    <ErrorBanner
                        title={isEdit ? "Unable to update the bill" : "Unable to create the bill"}
                        message={submitError}
                    />
                )}

                <div className="grid gap-5">
                    <div className="space-y-5">
                        <section
                            aria-labelledby="vendor-bill-details-heading"
                            className="flex flex-col rounded-xl border border-border bg-background p-4 sm:p-5"
                        >
                            <SectionHeader
                                id="vendor-bill-details-heading"
                                icon={<FileText size={18} aria-hidden="true" />}
                                eyebrow="Step 1"
                                title="Bill Details"
                                description="The reference and the dates printed on the bill."
                                badge={<StepBadge>Required</StepBadge>}
                            />
                            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Input
                                    id="vendor-bill-invoice-number"
                                    label={
                                        <span className="inline-flex items-center gap-1">
                                            Invoice Number <RequiredMark />
                                        </span>
                                    }
                                    value={values.invoiceNumber}
                                    onChange={e => update("invoiceNumber", e.target.value)}
                                    error={errors.invoiceNumber}
                                    placeholder="VB/EVENT-1/VENDOR-1/10-2026"
                                />
                                <Input
                                    id="vendor-bill-date"
                                    label={
                                        <span className="inline-flex items-center gap-1">
                                            Bill Date <RequiredMark />
                                        </span>
                                    }
                                    type="date"
                                    value={values.billCreateDate}
                                    onChange={e => update("billCreateDate", e.target.value)}
                                    error={errors.billCreateDate}
                                />
                                <Input
                                    id="vendor-bill-event-date"
                                    label="Event Date"
                                    type="date"
                                    value={values.eventDate}
                                    onChange={e => update("eventDate", e.target.value)}
                                />
                                <Input
                                    id="vendor-bill-account-holder"
                                    label="Account Holder Name"
                                    value={values.accountHolderName}
                                    onChange={e => update("accountHolderName", e.target.value)}
                                    placeholder="Name on the vendor bank account"
                                />
                            </div>
                        </section>

                        <section
                            aria-labelledby="vendor-bill-vendor-heading"
                            className="flex flex-col rounded-xl border border-border bg-background p-4 sm:p-5"
                        >
                            <SectionHeader
                                id="vendor-bill-vendor-heading"
                                icon={<Building2 size={18} aria-hidden="true" />}
                                eyebrow="Step 2"
                                title="Vendor Details"
                                description="Who the bill is raised against and their tax details."
                            />
                            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Input
                                    id="vendor-bill-name"
                                    label="Vendor Name"
                                    value={values.name}
                                    onChange={e => update("name", e.target.value)}
                                    placeholder="Vendor name"
                                />
                                <Input
                                    id="vendor-bill-phone"
                                    label="Contact Number"
                                    value={values.phone}
                                    onChange={e => update("phone", e.target.value)}
                                    placeholder="Contact number of the vendor"
                                />
                                <div className="md:col-span-2">
                                    <Input
                                        id="vendor-bill-address"
                                        label="Billing Address"
                                        value={values.address}
                                        onChange={e => update("address", e.target.value)}
                                        placeholder="Billing address of the vendor"
                                    />
                                </div>
                                <Input
                                    id="vendor-bill-gst"
                                    label="GSTIN"
                                    value={values.gst}
                                    onChange={e => update("gst", e.target.value)}
                                    placeholder="GST identification number"
                                />
                                <Input
                                    id="vendor-bill-gst-certificate"
                                    label={
                                        <span className="inline-flex items-center gap-1.5">
                                            GST Certificate <OptionalBadge />
                                        </span>
                                    }
                                    value={values.gstCertificate}
                                    onChange={e => update("gstCertificate", e.target.value)}
                                    placeholder="Reference of the GST certificate"
                                />
                            </div>
                        </section>
                    </div>
                </div>
            </ModalBody>

            <ModalFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-muted-foreground">
                    Fields marked <span className="font-semibold text-error">*</span> are required.
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onClose}
                        disabled={submitting}
                        className="w-full sm:w-auto"
                    >
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        isLoading={submitting}
                        disabled={submitting}
                        onClick={handleSubmit}
                        className="w-full sm:w-auto"
                    >
                        {submitting
                            ? isEdit
                                ? "Saving changes..."
                                : "Creating bill..."
                            : isEdit
                              ? "Save changes"
                              : "Create bill"}
                    </Button>
                </div>
            </ModalFooter>
        </Modal>
    );
}
