"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Formik, Form, FormikHelpers, FormikProps } from "formik";
import * as Yup from "yup";

import { API_ENDPOINTS } from "../lib/api/endpoint";
import { Button } from "@/components/ui/button";
import { FormikFieldInput } from "@/components/ui/formik-field-input";
import { FormikFieldTextArea } from "@/components/ui/formik-field-textarea";
import { FormikFieldRadio } from "@/components/ui/formik-field-radio";
import { FormikFieldDatePicker } from "@/components/ui/formik-field-date-picker";
import { UserSelectDropdown } from "@/components/user-select-dropdown";
import { cn } from "@/lib/utils/cn";
import { parseApiDate } from "@/lib/utils/date";
import { EnquiryFormData, CreateEnquiryModalProps } from "@/types/enquiry";
import { useClients } from "@/hooks/useClients";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api/api-client";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import {
    Briefcase,
    Building2,
    CalendarDays,
    CircleAlert,
    ClipboardList,
    Loader2,
    MapPin,
    Minus,
    Phone,
    Plus,
    UserRound,
    Users,
} from "lucide-react";

// Dynamically import FormikFieldCreatableSelect to avoid SSR issues with react-select
const FormikFieldCreatableSelect = dynamic(
    () =>
        import("@/components/ui/formik-field-creatable-select").then(mod => ({
            default: mod.FormikFieldCreatableSelect,
        })),
    { ssr: false },
);

const validationSchema = Yup.object({
    client: Yup.string().test("client-or-name", "Please select a client", function (value) {
        const { clientName } = this.parent as { clientName?: string };
        return Boolean(value) || Boolean(clientName);
    }),
    eventType: Yup.string()
        .oneOf(["PERSONAL", "CORPORATE", "OTHER"], "Please select an event type")
        .required("Event type is required"),
    fromDate: Yup.string()
        .transform(value => (value ? value : null))
        .nullable()
        .notRequired(),
    toDate: Yup.string()
        .transform(value => (value ? value : null))
        .nullable()
        .notRequired()
        .test("after-start", "End must be after start", function (value) {
            const { fromDate } = this.parent as { fromDate?: string | null };
            if (!value || !fromDate) return true;
            return new Date(value) >= new Date(fromDate);
        }),
    location: Yup.string().required("Location is required"),
    venue: Yup.string().required("Venue is required"),
    title: Yup.string().required("Event title is required").min(3, "Add at least 3 characters"),
    highlvelRequirement: Yup.string().required("High level requirements are required"),
    // .min(10, "Please provide more detailed requirements (at least 10 characters)"),
    clientPoC: Yup.string().optional(),
    enquiryPoCNumber: Yup.string().required("Contact number is required"),
    alternateClientPoC: Yup.string().optional(),
    alternateEnquiryPocNumber: Yup.string().optional(),
    // .matches(/^\d{10}$/, "Phone number must be exactly 10 digits"),
    eventPoC: Yup.string().optional(),
    enquiryPoC: Yup.string().optional(),
    eventPoCNumber: Yup.string().optional(),
    // .matches(/^\d{10}$/, {
    //     message: "Phone number must be exactly 10 digits",
    //     excludeEmptyString: true,
    // }),
    assignedTo: Yup.string().optional(),
});

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

export default function CreateEnquiryModal({
    isOpen,
    onClose,
    onSubmit,
    editData,
    mode = "create",
    onSaveSuccess,
}: CreateEnquiryModalProps) {
    const { clients, loading: clientsLoading } = useClients();

    // Formik ref so we can set fields from outside when clients finish loading
    const formikRef = useRef<FormikProps<EnquiryFormData> | null>(null);
    const [saveProcessing, setSaveProcessing] = useState(false);
    const [showAlternateContact, setShowAlternateContact] = useState(
        Boolean(editData?.alternateClientPoC || editData?.alternateEnquiryPocNumber),
    );

    // Normalize dates coming from the API into a full ISO string (with timezone).
    // The backend stores naive `LocalDateTime` values that represent UTC, e.g.
    // "2026-11-19T09:30:00". Parsing them directly with `new Date()` treats them as
    // *local* time and shifts the date picker by the browser's timezone offset, so
    // the entered time is not shown correctly when reopening the modal.
    // `parseApiDate` appends the UTC marker so the picker renders the original
    // instant, and keeping the timezone information preserves it on submit.
    const normalizeDateForForm = (dateStr: string) => {
        if (!dateStr) return "";
        try {
            const d = parseApiDate(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toISOString();
        } catch {
            return dateStr;
        }
    };

    // Keep the alternate-contact toggle in sync when switching between
    // create mode and editing an enquiry that already has alternate values.
    useEffect(() => {
        setShowAlternateContact(
            Boolean(editData?.alternateClientPoC || editData?.alternateEnquiryPocNumber),
        );
    }, [editData?.alternateClientPoC, editData?.alternateEnquiryPocNumber, isOpen]);

    const normalizeAssignedTo = (value?: string) => {
        const normalized = value?.trim() || "";
        return normalized === "Unassigned" ? "" : normalized;
    };

    const initialValues: EnquiryFormData = editData
        ? {
              ...editData,
              title: editData.title ?? "",
              fromDate: normalizeDateForForm(editData.fromDate || "") || "",
              toDate: normalizeDateForForm(editData.toDate || "") || "",
              eventType: editData.eventType || "CORPORATE",
              assignedTo: normalizeAssignedTo(editData.assignedTo),
              alternateClientPoC: editData.alternateClientPoC ?? "",
              alternateEnquiryPocNumber: editData.alternateEnquiryPocNumber ?? "",
          }
        : {
              highlvelRequirement: "",
              title: "",
              fromDate: "",
              toDate: "",
              location: "",
              venue: "",
              clientPoC: "",
              enquiryPoCNumber: "",
              alternateClientPoC: "",
              alternateEnquiryPocNumber: "",
              client: "",
              clientName: "",
              eventType: "CORPORATE",
              enquiryPoC: "",
              eventPoC: "",
              eventPoCNumber: "",
              assignedTo: "",
          };

    const isEdit = mode === "edit" || !!editData?.id;

    const handleSubmit = async (
        values: EnquiryFormData,
        { setSubmitting, setStatus, resetForm }: FormikHelpers<EnquiryFormData>,
    ) => {
        setSaveProcessing(true);

        try {
            setStatus(null);
            const toIsoWithZFromDate = (dateVal?: string | Date) => {
                if (!dateVal) return undefined;
                if (typeof dateVal === "string") {
                    if (dateVal.endsWith("Z")) return dateVal;
                    if (dateVal.length === 16) return `${dateVal}:00.000Z`;
                    return dateVal;
                }
                return new Date(dateVal).toISOString();
            };

            const existingClient = clients.find(c => c.id === values.client);
            let clientId = values.client;
            // Prefer the loaded client's name, otherwise fall back to the typed/known
            // name so an edit never blanks out an existing client name.
            let clientDisplayName = existingClient?.name ?? values.clientName ?? "";

            if (!clientId && values.clientName) {
                const res = await apiRequest(API_ENDPOINTS.clients.list, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: values.clientName }),
                });
                if (!res.ok) throw new Error("Failed to create client");
                const created = await res.json();
                clientId = created.id;
                clientDisplayName = typeof created.name === "string" ? created.name : "";
            }

            if (!clientId) {
                throw new Error("Client information is required before saving the enquiry");
            }

            const { fromDate, toDate, ...restValues } = values;
            const formattedFromDate = toIsoWithZFromDate(fromDate as unknown as string | Date);
            const formattedToDate = toIsoWithZFromDate(toDate as unknown as string | Date);

            const requestBody: Record<string, unknown> = {
                ...restValues,
                assignedTo: normalizeAssignedTo(values.assignedTo),
                client: clientDisplayName,
                clientID: clientId,
                enquiryDate: (isEdit ? values.enquiryDate : "") || new Date().toISOString(),
                eventName: values.title, // Send title as eventName to backend
            };

            if (formattedFromDate) requestBody.fromDate = formattedFromDate;
            if (formattedToDate) requestBody.toDate = formattedToDate;

            if (isEdit && editData?.id) {
                requestBody.id = editData.id;
            }

            const response = await apiRequest(API_ENDPOINTS.enquiries.list, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok)
                throw new Error(
                    `Failed to ${isEdit ? "update" : "create"} enquiry: ${response.statusText}`,
                );

            const contentType = response.headers.get("content-type") ?? "";
            let savedEnquiry: Record<string, unknown> | null = null;

            if (contentType.includes("application/json")) {
                try {
                    savedEnquiry = (await response.json()) as Record<string, unknown>;
                } catch {
                    throw new Error("Failed to parse enquiry response. Please try again.");
                }
            } else if (response.status !== 204) {
                throw new Error("Received unexpected response when saving the enquiry.");
            }

            await Promise.resolve(onSubmit());

            if (!isEdit) {
                resetForm({ values: { ...initialValues } });
            }

            // After successful save, close the edit/create modal
            onClose();

            // Then open the enquiry in view modal if callback provided
            if (savedEnquiry && onSaveSuccess) {
                onSaveSuccess(savedEnquiry as unknown as import("@/types/enquiry").Enquiry);
            }
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : `Failed to ${isEdit ? "update" : "create"} enquiry`;
            setStatus(message);
            toast.error(`Unable to ${isEdit ? "update" : "create"} enquiry`, {
                description: message,
            });
        } finally {
            setSubmitting(false);
            setSaveProcessing(false);
        }
    };

    // Resolve the client for edit mode once the clients list is available.
    // The enquiry stores the client NAME in its `client` field and the id in
    // `clientID`, so prefer the id, then fall back to matching by name, and finally
    // keep the name so the creatable select can still display it as a "new" entry.
    useEffect(() => {
        if (!isOpen || clientsLoading) return;
        const formik = formikRef.current;
        if (!formik) return;

        const desiredId = editData?.client || "";
        const desiredName = editData?.clientName || "";
        const currentClient = formik.values.client;

        const foundById = desiredId ? clients.find(c => c.id === desiredId) : undefined;
        if (foundById) {
            if (currentClient !== foundById.id) formik.setFieldValue("client", foundById.id);
            return;
        }

        const foundByName = desiredName ? clients.find(c => c.name === desiredName) : undefined;
        if (foundByName) {
            if (currentClient !== foundByName.id) formik.setFieldValue("client", foundByName.id);
            return;
        }

        // No matching client: clear any stale id so the stored name (clientName) is
        // displayed instead of an unknown id.
        if (currentClient && !clients.some(c => c.id === currentClient)) {
            formik.setFieldValue("client", "");
        }
    }, [isOpen, clientsLoading, editData?.client, editData?.clientName, clients]);

    if (!isOpen) return null;

    const isPersonalEvent = (eventType?: string) => eventType === "PERSONAL";

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title={mode === "edit" ? "Edit Enquiry" : "Create Enquiry"}
            description={
                mode === "edit"
                    ? "Update the event, client and contact details for this enquiry."
                    : "Capture the event, client and contact details to create an enquiry."
            }
            size="xxl"
            showCloseIcon
            icon={
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
                    <CalendarDays size={20} aria-hidden="true" />
                </span>
            }
        >
            <Formik
                innerRef={formikRef}
                initialValues={initialValues}
                enableReinitialize
                validationSchema={validationSchema}
                onSubmit={handleSubmit}
            >
                {({ isSubmitting, status, values, setFieldValue, setValues, submitForm }) => (
                    <Form noValidate>
                        <ModalBody className="space-y-5">
                            {status && (
                                <div
                                    role="alert"
                                    className="flex items-start gap-3 rounded-lg border border-error/30 bg-error-light px-4 py-3 text-sm text-error"
                                >
                                    <CircleAlert size={18} aria-hidden="true" />
                                    <div className="min-w-0">
                                        <p className="font-semibold">
                                            Unable to {isEdit ? "update" : "create"} enquiry
                                        </p>
                                        <p className="mt-0.5 break-words opacity-90">{status}</p>
                                    </div>
                                </div>
                            )}
                            {/* Assignee strip (unnumbered) — first in visual + tab order. */}
                            <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
                                <div className="w-full sm:max-w-[320px]">
                                    <UserSelectDropdown
                                        value={values.assignedTo ?? ""}
                                        onChange={assignedTo =>
                                            setFieldValue("assignedTo", assignedTo)
                                        }
                                        label={
                                            <span className="inline-flex items-center gap-1.5">
                                                <Briefcase
                                                    size={14}
                                                    className="text-muted-foreground"
                                                    aria-hidden="true"
                                                />
                                                Assignee
                                                <OptionalBadge />
                                            </span>
                                        }
                                        placeholder="Search or enter assignee name"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
                                <section
                                    aria-labelledby="enquiry-event-details-heading"
                                    className="flex flex-col rounded-xl border border-border bg-background p-4 sm:p-5"
                                >
                                    <SectionHeader
                                        id="enquiry-event-details-heading"
                                        icon={<CalendarDays size={18} aria-hidden="true" />}
                                        eyebrow="Step 1"
                                        title="Event Details"
                                        description="What is happening, when, and where."
                                        badge={<StepBadge>Required</StepBadge>}
                                    />
                                    <div className="mt-4 flex flex-1 flex-col justify-start gap-4">
                                        <FormikFieldInput
                                            name="title"
                                            label={
                                                <span className="inline-flex items-center gap-1">
                                                    Event Title
                                                    <RequiredMark />
                                                </span>
                                            }
                                            type="text"
                                            placeholder="e.g. Birthday party, Annual day celebration"
                                        />
                                        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
                                            <FormikFieldDatePicker
                                                name="fromDate"
                                                label={
                                                    <span className="inline-flex items-center gap-1.5">
                                                        Starts <OptionalBadge />
                                                    </span>
                                                }
                                                placeholderText="Select start date & time"
                                            />
                                            <FormikFieldDatePicker
                                                name="toDate"
                                                label={
                                                    <span className="inline-flex items-center gap-1.5">
                                                        Ends <OptionalBadge />
                                                    </span>
                                                }
                                                placeholderText="Select end date & time"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
                                            <FormikFieldInput
                                                name="location"
                                                label={
                                                    <span className="inline-flex items-center gap-1">
                                                        Location
                                                        <RequiredMark />
                                                    </span>
                                                }
                                                type="text"
                                                placeholder="City or area"
                                            />
                                            <FormikFieldInput
                                                name="venue"
                                                label={
                                                    <span className="inline-flex items-center gap-1">
                                                        Venue
                                                        <RequiredMark />
                                                    </span>
                                                }
                                                type="text"
                                                placeholder="Hall, resort, or address"
                                            />
                                        </div>
                                    </div>
                                </section>

                                <section
                                    aria-labelledby="enquiry-client-details-heading"
                                    className="rounded-xl border border-border bg-background p-4 sm:p-5"
                                >
                                    <SectionHeader
                                        id="enquiry-client-details-heading"
                                        icon={<Building2 size={18} aria-hidden="true" />}
                                        eyebrow="Step 2"
                                        title="Client & Primary Contact"
                                        description="Who is requesting the event and contact details."
                                        badge={<StepBadge>Required</StepBadge>}
                                    />
                                    <div className="mt-4 space-y-4">
                                        <FormikFieldRadio
                                            name="eventType"
                                            label={
                                                <span className="inline-flex items-center gap-1">
                                                    Event Type
                                                    <RequiredMark />
                                                </span>
                                            }
                                            options={[
                                                { label: "Individual", value: "PERSONAL" },
                                                { label: "Corporate", value: "CORPORATE" },
                                                { label: "Other", value: "OTHER" },
                                            ]}
                                        />

                                        <div>
                                            {clientsLoading ? (
                                                <div className="flex flex-col gap-1.5">
                                                    <span className="flex min-h-5 flex-wrap items-center gap-1.5 text-sm font-medium leading-5 text-foreground">
                                                        <span className="inline-flex items-center gap-1">
                                                            Client
                                                            <RequiredMark />
                                                        </span>
                                                    </span>
                                                    <div className="flex h-10 items-center gap-2 rounded-md border border-input bg-surface px-3 py-2 text-sm text-muted-foreground">
                                                        <Loader2
                                                            size={16}
                                                            className="animate-spin"
                                                            aria-hidden="true"
                                                        />
                                                        Loading clients...
                                                    </div>
                                                </div>
                                            ) : (
                                                <FormikFieldCreatableSelect
                                                    name="client"
                                                    id="client"
                                                    label={
                                                        <span className="inline-flex items-center gap-1">
                                                            Client
                                                            <RequiredMark />
                                                        </span>
                                                    }
                                                    placeholder="Search or type a new client name..."
                                                    isClearable
                                                    options={clients.map(c => ({
                                                        value: c.id,
                                                        label: c.name,
                                                    }))}
                                                    value={(() => {
                                                        const option = clients.find(
                                                            c => c.id === values.client,
                                                        );
                                                        if (option)
                                                            return {
                                                                value: option.id,
                                                                label: option.name,
                                                            };
                                                        if (clientsLoading) return null;
                                                        if (values.clientName)
                                                            return {
                                                                value: "__new__",
                                                                label: values.clientName,
                                                            };
                                                        return null;
                                                    })()}
                                                    onChange={selectedValue => {
                                                        const selectedOption = clients.find(
                                                            c => c.id === selectedValue,
                                                        );
                                                        const personal = isPersonalEvent(
                                                            values.eventType,
                                                        );
                                                        // Update client + clientName (+ clientPoC for PERSONAL)
                                                        // atomically with a single setValues call. Separate
                                                        // sequential setFieldValue() calls re-validate the
                                                        // form against stale values, so the second call
                                                        // (clientName = "") re-triggers "Please select a
                                                        // client" even though the client id was just set.
                                                        if (selectedValue === "__new__") {
                                                            setValues({
                                                                ...values,
                                                                client: "",
                                                                ...(personal
                                                                    ? {
                                                                          clientPoC:
                                                                              values.clientName,
                                                                      }
                                                                    : {}),
                                                            });
                                                        } else if (selectedOption) {
                                                            setValues({
                                                                ...values,
                                                                client: selectedOption.id,
                                                                clientName: "",
                                                                ...(personal
                                                                    ? {
                                                                          clientPoC:
                                                                              selectedOption.name,
                                                                      }
                                                                    : {}),
                                                            });
                                                        } else {
                                                            setValues({
                                                                ...values,
                                                                client: "",
                                                                clientName: "",
                                                            });
                                                        }
                                                    }}
                                                    onCreateOption={(inputValue: string) => {
                                                        // Do not persist immediately; store typed name and show as selected.
                                                        // Single atomic update (same stale-values rationale as above).
                                                        setValues({
                                                            ...values,
                                                            client: "",
                                                            clientName: inputValue,
                                                            ...(isPersonalEvent(values.eventType)
                                                                ? { clientPoC: inputValue }
                                                                : {}),
                                                        });
                                                    }}
                                                />
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
                                            <FormikFieldInput
                                                name="clientPoC"
                                                label={
                                                    isPersonalEvent(values.eventType) ? (
                                                        <span className="inline-flex min-h-5 items-center">
                                                            Contact Person Name
                                                        </span>
                                                    ) : (
                                                        "Contact Person Name"
                                                    )
                                                }
                                                type="text"
                                                placeholder={
                                                    isPersonalEvent(values.eventType)
                                                        ? "Auto-filled from client"
                                                        : "Primary contact name"
                                                }
                                                disabled={isPersonalEvent(values.eventType)}
                                                inputClassName={cn(
                                                    isPersonalEvent(values.eventType) &&
                                                        "cursor-not-allowed opacity-80",
                                                )}
                                            />
                                            <FormikFieldInput
                                                name="enquiryPoCNumber"
                                                label={
                                                    <span className="inline-flex min-h-5 items-center gap-1">
                                                        Contact Mobile Number
                                                        <RequiredMark />
                                                    </span>
                                                }
                                                type="tel"
                                                inputMode="tel"
                                                autoComplete="tel"
                                                placeholder="10-digit mobile number"
                                                maxLength={10}
                                                onChange={e => {
                                                    const value = e.target.value
                                                        .replace(/\D/g, "")
                                                        .slice(0, 10);
                                                    setFieldValue("enquiryPoCNumber", value);
                                                }}
                                            />
                                        </div>
                                        {showAlternateContact && (
                                            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
                                                <FormikFieldInput
                                                    name="alternateClientPoC"
                                                    type="text"
                                                    placeholder="Alternate contact name"
                                                />
                                                <FormikFieldInput
                                                    name="alternateEnquiryPocNumber"
                                                    type="tel"
                                                    inputMode="tel"
                                                    autoComplete="tel"
                                                    placeholder="Alternate mobile number"
                                                    maxLength={10}
                                                    onChange={e => {
                                                        const value = e.target.value
                                                            .replace(/\D/g, "")
                                                            .slice(0, 10);
                                                        setFieldValue(
                                                            "alternateEnquiryPocNumber",
                                                            value,
                                                        );
                                                    }}
                                                />
                                            </div>
                                        )}
                                        <div className="flex justify-start">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (showAlternateContact) {
                                                        setFieldValue("alternateClientPoC", "");
                                                        setFieldValue(
                                                            "alternateEnquiryPocNumber",
                                                            "",
                                                        );
                                                    }
                                                    setShowAlternateContact(prev => !prev);
                                                }}
                                                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary-hover hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer"
                                            >
                                                {showAlternateContact ? (
                                                    <>
                                                        <Minus size={14} aria-hidden="true" />
                                                        Remove alternate contact
                                                    </>
                                                ) : (
                                                    <>
                                                        <Plus size={14} aria-hidden="true" />
                                                        Add alternate contact
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                        {isPersonalEvent(values.eventType) && (
                                            <p className="rounded-lg border border-border bg-surface px-3 py-2 text-xs leading-5 text-muted-foreground">
                                                Individual events use the client name as the point
                                                of contact.
                                            </p>
                                        )}
                                    </div>
                                </section>
                            </div>

                            <section
                                aria-labelledby="enquiry-additional-contacts-heading"
                                className="rounded-xl border border-border bg-background p-4 sm:p-5"
                            >
                                <SectionHeader
                                    id="enquiry-additional-contacts-heading"
                                    icon={<Users size={18} aria-hidden="true" />}
                                    eyebrow="Step 3"
                                    title="Additional Contacts"
                                    description="Add these only when they differ from the primary client contact."
                                    badge={
                                        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                            Optional
                                        </span>
                                    }
                                />
                                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                                    <FormikFieldInput
                                        name="eventPoC"
                                        label={
                                            <span className="inline-flex items-center gap-1.5">
                                                <UserRound
                                                    size={14}
                                                    className="text-muted-foreground"
                                                    aria-hidden="true"
                                                />
                                                Event POC Name
                                            </span>
                                        }
                                        type="text"
                                        placeholder="On-ground contact person"
                                    />
                                    <FormikFieldInput
                                        name="eventPoCNumber"
                                        label={
                                            <span className="inline-flex items-center gap-1.5">
                                                <Phone
                                                    size={14}
                                                    className="text-muted-foreground"
                                                    aria-hidden="true"
                                                />
                                                Event POC Number
                                            </span>
                                        }
                                        type="tel"
                                        inputMode="tel"
                                        autoComplete="tel"
                                        placeholder="10-digit mobile number"
                                        maxLength={10}
                                        onChange={e => {
                                            const value = e.target.value
                                                .replace(/\D/g, "")
                                                .slice(0, 10);
                                            setFieldValue("eventPoCNumber", value);
                                        }}
                                    />
                                    <FormikFieldInput
                                        name="enquiryPoC"
                                        label={
                                            <span className="inline-flex items-center gap-1.5">
                                                <UserRound
                                                    size={14}
                                                    className="text-muted-foreground"
                                                    aria-hidden="true"
                                                />
                                                Enquiry POC Name
                                            </span>
                                        }
                                        type="text"
                                        placeholder="Follow-up contact person"
                                    />
                                </div>
                            </section>

                            <section
                                aria-labelledby="enquiry-requirements-heading"
                                className="rounded-xl border border-border bg-background p-4 sm:p-5"
                            >
                                <SectionHeader
                                    id="enquiry-requirements-heading"
                                    icon={<ClipboardList size={18} aria-hidden="true" />}
                                    eyebrow="Step 4"
                                    title="High Level Requirements"
                                    description="Capture guest count, theme, catering, décor, AV, and other must-haves."
                                    badge={<StepBadge>Required</StepBadge>}
                                />
                                <div className="mt-4">
                                    <FormikFieldTextArea
                                        name="highlvelRequirement"
                                        label={
                                            <>
                                                Requirements
                                                <RequiredMark />
                                            </>
                                        }
                                        rows={5}
                                        placeholder="Guests, theme, catering, décor, AV, and other must-haves"
                                    />
                                </div>
                            </section>
                        </ModalBody>
                        <ModalFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MapPin size={14} className="shrink-0" aria-hidden="true" />
                                <span>
                                    Fields marked{" "}
                                    <span className="font-semibold text-error">*</span> are
                                    required.
                                </span>
                            </p>
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                                <Button
                                    variant="outline"
                                    onClick={onClose}
                                    type="button"
                                    disabled={isSubmitting || saveProcessing}
                                    className="w-full sm:w-auto"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    isLoading={isSubmitting || saveProcessing}
                                    disabled={isSubmitting || saveProcessing}
                                    onClick={() => submitForm()}
                                    className="w-full sm:w-auto"
                                >
                                    {saveProcessing || isSubmitting
                                        ? "Saving..."
                                        : isEdit
                                          ? "Save changes"
                                          : "Create enquiry"}
                                </Button>
                            </div>
                        </ModalFooter>
                    </Form>
                )}
            </Formik>
        </Modal>
    );
}
