"use client";

import React, { useMemo } from "react";
import { DollarSign } from "lucide-react";
import { Formik, Form, type FormikHelpers } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormikFieldDatePicker } from "@/components/ui/formik-field-date-picker";
import { FormikFieldInput } from "@/components/ui/formik-field-input";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { UserSelectDropdown } from "@/components/user-select-dropdown";
import type { FundAllocation } from "@/types/fund-allocation";
import type { User } from "@/types/user";

interface FundAllocationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (values: {
        eventId: string;
        assigneeUserId: string;
        assignedAmount: number;
        allocatedDate: string | null;
    }) => Promise<void>;
    eventID: string;
    eventName?: string;
    users: User[];
    editing: FundAllocation | null;
}

interface FundAllocationFormValues {
    eventId: string;
    assigneeUserId: string;
    assignedAmount: string;
    allocatedDate: string;
}

const validationSchema = Yup.object({
    eventId: Yup.string().required("Event is required"),
    assigneeUserId: Yup.string().required("Assignee is required"),
    assignedAmount: Yup.string()
        .trim()
        .required("Allocated amount is required")
        .test(
            "is-positive-amount",
            "Allocated amount must be greater than 0",
            function (value) {
                return Boolean(value && parseFloat(value || "0") > 0);
            },
        ),
    allocatedDate: Yup.string().optional(),
});

function RequiredMark() {
    return <span className="text-error" aria-hidden="true">*</span>;
}

export function FundAllocationModal({
    isOpen,
    onClose,
    onSave,
    eventID,
    eventName,
    users,
    editing,
}: FundAllocationModalProps) {
    const isEdit = !!editing;
    const title = isEdit ? "Edit Allocation" : "Allocate Funds";

    const initialValues: FundAllocationFormValues = useMemo(() => ({
        eventId: eventID,
        assigneeUserId: editing?.assigneeUserId || editing?.assignedUserId || "",
        assignedAmount: editing ? String(editing.assignedAmount) : "",
        allocatedDate: editing?.allocatedDate ?? "",
    }), [editing, eventID]);

    const handleSave = async (
        values: FundAllocationFormValues,
        { setSubmitting }: FormikHelpers<FundAllocationFormValues>,
    ) => {
        try {
            const parsedAmount = Number(values.assignedAmount);
            if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
                setSubmitting(false);
                return;
            }

            // When no allocation date is picked, default to the current date.
            const allocatedDate = values.allocatedDate || new Date(Date.now()).toISOString();

            await onSave({
                eventId: values.eventId,
                assigneeUserId: values.assigneeUserId,
                assignedAmount: parsedAmount,
                allocatedDate,
            });
            onClose();
        } catch (err) {
            setSubmitting(false);
            toast.error(err instanceof Error ? err.message : "Failed to save fund allocation.");
        }
    };

    if (!isOpen) return null;

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title={title}
            description={
                isEdit
                    ? `Update the fund allocation for this event.`
                    : `Allocate funds to a user for "${eventName || eventID}".`
            }
            size="xl"
            showCloseIcon
            icon={
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
                    <DollarSign size={20} aria-hidden="true" />
                </span>
            }
        >
            <Formik
                initialValues={initialValues}
                enableReinitialize
                validationSchema={validationSchema}
                onSubmit={handleSave}
            >
                {({ isSubmitting, values, setFieldValue, errors, touched }) => (
                    <Form noValidate>
                        <ModalBody className="space-y-5">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="flex min-h-5 flex-wrap items-center gap-1.5 font-medium text-foreground">
                                        Event <RequiredMark />
                                    </label>
                                    <Input
                                        value={eventName || eventID}
                                        readOnly
                                        disabled
                                        className="flex h-10 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <UserSelectDropdown
                                        isCreatable={false}
                                        label={
                                            <span className="inline-flex items-center gap-1">
                                                Assignee <RequiredMark />
                                            </span>
                                        }
                                       value={values.assigneeUserId ? users.find(u => u.id === values.assigneeUserId)?.name || "" : ""}
                                        onChange={name => {
                                            const user = users.find(u => u.name === name);
                                            setFieldValue("assigneeUserId", user?.id || "");
                                        }}
                                        placeholder="Select assignee"
                                        isClearable
                                        error={touched.assigneeUserId ? errors.assigneeUserId : undefined}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <FormikFieldInput
                                        name="assignedAmount"
                                        label={
                                            <span className="inline-flex items-center gap-1">
                                                Allocated Amount <RequiredMark />
                                            </span>
                                        }
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <FormikFieldDatePicker
                                        name="allocatedDate"
                                        label="Allocation Date"
                                        placeholderText="Select date"
                                        showTimeSelect={false}
                                        dateFormat="MMM d, yyyy"
                                        error={touched.allocatedDate ? errors.allocatedDate : undefined}
                                    />
                                </div>
                            </div>
                        </ModalBody>
                        <ModalFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                Fields marked <span className="font-semibold text-error">*</span> are
                                required.
                            </p>
                            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onClose}
                                    disabled={isSubmitting}
                                    className="w-full sm:w-auto"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    isLoading={isSubmitting}
                                    disabled={isSubmitting}
                                    className="w-full sm:w-auto"
                                >
                                    {isSubmitting ? "Saving..." : isEdit ? "Save Changes" : "Allocate Funds"}
                                </Button>
                            </div>
                        </ModalFooter>
                    </Form>
                )}
            </Formik>
        </Modal>
    );
}
