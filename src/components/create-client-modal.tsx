import type { ReactNode } from "react";
import { Formik, Form, type FormikHelpers } from "formik";

import { FormikFieldInput } from "@/components/ui/formik-field-input";
import { FormikFieldRadio } from "@/components/ui/formik-field-radio";
import { useRequestApi } from "@/hooks/useRequestApi";
import { Modal, ModalFooter, ModalBody } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { getClientValidationSchema } from "@/lib/validations/client";
import type { Client, ClientFormData } from "@/types/client";
import { clientFormInitialValues, clientTypeOptions } from "@/constants/client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { toast } from "sonner";
import { Building2, MapPin, UserRound } from "lucide-react";

interface CreateClientModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    editData?: Client | null;
    mode?: "create" | "edit";
}

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

export default function CreateClientModal({
    open,
    onClose,
    onSuccess,
    editData,
    mode = "create",
}: CreateClientModalProps) {
    const { request, loading, error } = useRequestApi();
    const isEdit = mode === "edit" || Boolean(editData?.id);

    // Backend may return `null` for optional fields (gst/pan/gstCertificate).
    // Formik inputs + Yup.string() expect strings, so normalize null/undefined to "".
    const initialValues: ClientFormData = editData
        ? {
              name: editData.name ?? "",
              email: editData.email ?? "",
              phone: editData.phone ?? "",
              address: editData.address ?? "",
              poc: editData.poc ?? "",
              gst: editData.gst ?? "",
              pan: editData.pan ?? "",
              gstCertificate: editData.gstCertificate ?? "",
              clientType: editData.clientType ?? "CORPORATE",
          }
        : clientFormInitialValues;

    const handleSubmit = async (
        values: ClientFormData,
        { setSubmitting }: FormikHelpers<ClientFormData>,
    ) => {
        try {
            // Single POST endpoint handles both create and update.
            // Backend distinguishes update when `id` is present in the payload.
            const body =
                isEdit && editData?.id ? { ...values, id: editData.id } : { ...values };

            const result = await request(API_ENDPOINTS.clients.list, {
                method: "POST",
                body,
            });

            if (result === null) {
                toast.error(
                    `Failed to ${isEdit ? "update" : "create"} client. Please try again. ${error ?? ""}`,
                );
                return;
            }

            if (onSuccess) onSuccess();
            toast.success(`Client ${isEdit ? "updated" : "created"} successfully!`);
            onClose();
        } catch {
            toast.error(`Failed to ${isEdit ? "update" : "create"} client. Please try again.`);
        } finally {
            setSubmitting(false);
        }
    };

    const validationSchema = getClientValidationSchema();

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={isEdit ? "Edit Client" : "Add Client"}
            size="xxl"
            showCloseIcon
            description={
                isEdit
                    ? "Update the client profile, contact and business details."
                    : "Create a new client profile with contact and business details."
            }
            icon={
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
                    <Building2 size={20} aria-hidden="true" />
                </span>
            }
        >
            <Formik
                initialValues={initialValues}
                enableReinitialize
                onSubmit={handleSubmit}
                validationSchema={validationSchema}
                validateOnMount={false}
            >
                {({ isSubmitting }) => (
                    <Form noValidate>
                        <ModalBody className="space-y-5">
                            <div className="grid items-start gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                                <section
                                    aria-labelledby="client-basic-details-heading"
                                    className="rounded-xl border border-border bg-background p-4 sm:p-5"
                                >
                                    <SectionHeader
                                        id="client-basic-details-heading"
                                        icon={<UserRound size={18} aria-hidden="true" />}
                                        eyebrow="Step 1"
                                        title="Basic details"
                                        description="Who is the client and how do we categorize them."
                                        badge={<StepBadge>Required</StepBadge>}
                                    />
                                    <div className="mt-4 space-y-4">
                                        <FormikFieldRadio
                                            name="clientType"
                                            label={
                                                <span className="inline-flex items-center gap-1">
                                                    Client type
                                                    <RequiredMark />
                                                </span>
                                            }
                                            options={clientTypeOptions}
                                        />
                                        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
                                            <FormikFieldInput name="name" label={<span className="inline-flex items-center gap-1">Name <RequiredMark /></span>} placeholder="Client name" />
                                            <FormikFieldInput name="poc" label={<span className="inline-flex items-center gap-1">Point of contact <RequiredMark /></span>} placeholder="POC name" />
                                        </div>
                                    </div>
                                </section>
                                <section aria-labelledby="client-contact-heading" className="rounded-xl border border-border bg-background p-4 sm:p-5">
                                    <SectionHeader id="client-contact-heading" icon={<MapPin size={18} aria-hidden="true" />} eyebrow="Step 2" title="Contact and address" description="Where to reach the client." badge={<StepBadge>Required</StepBadge>} />
                                    <div className="mt-4 space-y-4">
                                        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
                                            <FormikFieldInput name="email" label={<span className="inline-flex items-center gap-1">Email <RequiredMark /></span>} type="email" placeholder="Email" />
                                            <FormikFieldInput name="phone" label={<span className="inline-flex items-center gap-1">Phone number <RequiredMark /></span>} placeholder="Phone number" />
                                        </div>
                                        <FormikFieldInput name="address" label={<span className="inline-flex items-center gap-1">Address <RequiredMark /></span>} placeholder="Full address" />
                                    </div>
                                </section>
                            </div>
                            <section aria-labelledby="client-business-heading" className="rounded-xl border border-border bg-background p-4 sm:p-5">
                                <SectionHeader id="client-business-heading" icon={<Building2 size={18} aria-hidden="true" />} eyebrow="Step 3" title="Business and tax details" description="Add these only when billing with GST details." badge={<OptionalBadge />} />
                                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <FormikFieldInput name="gst" label={<span className="inline-flex items-center gap-1.5">GST number <OptionalBadge /></span>} placeholder="GST number" />
                                    <FormikFieldInput name="pan" label={<span className="inline-flex items-center gap-1.5">PAN number <OptionalBadge /></span>} placeholder="PAN number" />
                                    <div className="sm:col-span-2">
                                        <FormikFieldInput name="gstCertificate" label={<span className="inline-flex items-center gap-1.5">GST certificate <OptionalBadge /></span>} placeholder="GST certificate URL or number" />
                                    </div>
                                </div>
                            </section>
                        </ModalBody>



                        <ModalFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MapPin size={14} className="shrink-0" aria-hidden="true" />
                                <span>Fields marked <span className="font-semibold text-error">*</span> are required.</span>
                            </p>
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                                <Button variant="outline" onClick={onClose} type="button" disabled={isSubmitting || loading} className="w-full sm:w-auto">
                                    Cancel
                                </Button>
                                <Button type="submit" isLoading={isSubmitting || loading} disabled={isSubmitting || loading} className="w-full sm:w-auto">
                                    {isSubmitting || loading ? "Saving..." : isEdit ? "Save Changes" : "Add Client"}
                                </Button>
                            </div>
                        </ModalFooter>
                    </Form>
                )}
            </Formik>
        </Modal>
    );
}
