"use client";

import React, { useEffect, useState, type ReactNode } from "react";
import { Formik, Form } from "formik";
import * as Yup from "yup";

import { Button } from "@/components/ui/button";
import { FormikFieldInput } from "@/components/ui/formik-field-input";
import { FormikFieldSelect } from "@/components/ui/formik-field-select";
import { FormikFieldTextArea } from "@/components/ui/formik-field-textarea";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { createExpense, updateExpense } from "@/lib/api/expense";
import { useAuth } from "@/context/auth";
import { toast } from "sonner";
import { Info, Receipt } from "lucide-react";
import { hasPermission } from "@/lib/utils/permissions";
import type { Expense } from "@/types/expense";

interface ExpenseItem {
    id?: string;
    itemName: string;
    amount: string;
    comments: string;
    expenseDescription: "ESTIMATED_EXPENSE" | "ACTUAL_EXPENSE";
    poc: string;
    expenseStatus:
        | "ESTIMATE_SUBMITTED"
        | "ESTIMATE_REVIEW"
        | "ESTIMATE_APPROVED"
        | "ESTIMATE_REJECTED";
    createdDate?: string;
    lastUpdateddDate?: string;
}

interface ExpensesModalFormValues {
    expenses: ExpenseItem[];
}

interface ExpensesModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventData: {
        id?: string;
        expensesList?: ExpenseItem[];
        [key: string]: unknown;
    };
    eventID?: string;
    onSave: () => void;
    /** When set, the modal edits this single existing expense instead of creating new ones. */
    editingExpense?: Expense | null;
}

const EXPENSE_TYPE_OPTIONS: { value: ExpenseItem["expenseDescription"]; label: string }[] = [
    { value: "ESTIMATED_EXPENSE", label: "Estimated Expense" },
    { value: "ACTUAL_EXPENSE", label: "Actual Expense" },
];

const EXPENSE_STATUS_OPTIONS: { value: ExpenseItem["expenseStatus"]; label: string }[] = [
    { value: "ESTIMATE_SUBMITTED", label: "Estimate Submitted" },
    { value: "ESTIMATE_REVIEW", label: "Estimate Under Review" },
    { value: "ESTIMATE_APPROVED", label: "Estimate Approved" },
    { value: "ESTIMATE_REJECTED", label: "Estimate Rejected" },
];

const initialExpense: ExpenseItem = {
    itemName: "",
    amount: "",
    comments: "",
    expenseDescription: "ESTIMATED_EXPENSE",
    poc: "",
    expenseStatus: "ESTIMATE_SUBMITTED",
};

const isExpenseTypeEnum = (val: string | undefined): val is ExpenseItem["expenseDescription"] =>
    val === "ESTIMATED_EXPENSE" || val === "ACTUAL_EXPENSE";

const validationSchema = Yup.object({
    expenses: Yup.array().of(
        Yup.object({
            itemName: Yup.string().trim().required("Item name is required"),
            amount: Yup.string()
                .trim()
                .test("is-positive-amount", "Amount must be greater than 0", function (value) {
                    return Boolean(value && parseFloat(value || "0") > 0);
                }),
            expenseDescription: Yup.string()
                .oneOf(["ESTIMATED_EXPENSE", "ACTUAL_EXPENSE"], "Please select an expense type")
                .required("Expense type is required"),
            expenseStatus: Yup.string()
                .oneOf(
                    [
                        "ESTIMATE_SUBMITTED",
                        "ESTIMATE_REVIEW",
                        "ESTIMATE_APPROVED",
                        "ESTIMATE_REJECTED",
                    ],
                    "Please select a status",
                )
                .required("Status is required"),
        }),
    ),
});

function RequiredMark() {
    return (
        <span className="text-error" aria-hidden="true">
            *
        </span>
    );
}

function SectionHeader({
    id,
    icon,
    title,
    description,
    badge,
}: {
    id: string;
    icon: ReactNode;
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

export function ExpensesModal({
    isOpen,
    onClose,
    eventData,
    eventID,
    onSave,
    editingExpense,
}: ExpensesModalProps) {
    const { user } = useAuth();
    // Only admin and super admin roles can change expense type/status
    const canEdit = hasPermission(user, undefined, ["w:expenses", "a:expenses"]);
    const [initialExpenses, setInitialExpenses] = useState<ExpenseItem[]>([]);

    useEffect(() => {
        if (!isOpen) {
            setInitialExpenses([]);
            return;
        }

        // Edit mode: prefill the form with the single expense being edited.
        if (editingExpense) {
            const storedDescription = editingExpense.expenseDescription as string | undefined;
            setInitialExpenses([
                {
                    id: editingExpense.id || undefined,
                    itemName: editingExpense.itemName || "",
                    amount:
                        typeof editingExpense.amount === "number"
                            ? String(editingExpense.amount)
                            : String(editingExpense.amount || ""),
                    comments: editingExpense.comments || "",
                    // `expenseDescription` carries the expense type enum. Fall back to
                    // ESTIMATED_EXPENSE for records that did not store an enum value.
                    expenseDescription: isExpenseTypeEnum(storedDescription)
                        ? storedDescription
                        : "ESTIMATED_EXPENSE",
                    poc: editingExpense.poc || "",
                    expenseStatus:
                        (editingExpense.expenseStatus as ExpenseItem["expenseStatus"]) ||
                        "ESTIMATE_SUBMITTED",
                    createdDate: editingExpense.createdDate || undefined,
                    lastUpdateddDate: editingExpense.lastUpdateddDate || undefined,
                },
            ]);
            return;
        }

        // Load existing expenses if available, otherwise start with one empty field
        if (Array.isArray(eventData?.expensesList) && eventData.expensesList.length > 0) {
            setInitialExpenses(
                eventData.expensesList.map(exp => {
                    const storedDescription = exp.expenseDescription as string | undefined;
                    return {
                        id: exp.id || undefined,
                        itemName: exp.itemName,
                        amount:
                            typeof exp.amount === "number"
                                ? String(exp.amount)
                                : String(exp.amount || ""),
                        comments: exp.comments || "",
                        // `expenseDescription` carries the expense type enum. Fall back to
                        // ESTIMATED_EXPENSE for records that did not store an enum value.
                        expenseDescription: isExpenseTypeEnum(storedDescription)
                            ? storedDescription
                            : "ESTIMATED_EXPENSE",
                        poc: exp.poc || "",
                        expenseStatus:
                            (exp.expenseStatus as ExpenseItem["expenseStatus"]) ||
                            "ESTIMATE_SUBMITTED",
                        createdDate: exp.createdDate,
                        lastUpdateddDate: exp.lastUpdateddDate,
                    };
                }),
            );
        } else {
            setInitialExpenses([{ ...initialExpense }]);
        }
    }, [isOpen, eventData, editingExpense]);

    const persistExpenseUpdate = async (exp: ExpenseItem, expenseId: string | undefined) => {
        const eventId = String(eventID || eventData?.id || "");
        if (!eventId) {
            toast.error("Event ID is missing. Please refresh the page and try again.");
            return;
        }

        if (!expenseId) {
            toast.error(
                "This expense cannot be updated because the API did not return an expense ID.",
            );
            return;
        }

        // Send the request body using the exact backend property names.
        const payload = {
            itemName: exp.itemName,
            eventID: eventId,
            amount: parseFloat(exp.amount) || 0,
            comments: exp.comments || "",
            poc: exp.poc || "",
            expenseDescription: exp.expenseDescription,
            expenseStatus: exp.expenseStatus,
            createdDate: exp.createdDate,
            lastUpdateddDate: new Date().toISOString(),
        };

        const res = await updateExpense(expenseId, payload);

        if (!res.ok) {
            throw new Error(`Failed to update expense "${exp.itemName}" (status ${res.status})`);
        }

        toast.success("Expense updated successfully");
        onSave();
        onClose();
    };

    const handleSave = async (values: ExpensesModalFormValues) => {
        try {
            // Edit mode: update the single expense currently being edited.
            if (editingExpense) {
                const expense = values.expenses[0];
                if (!expense || !expense.itemName.trim() || parseFloat(expense.amount) <= 0) return;
                await persistExpenseUpdate(expense, editingExpense.id);
                return;
            }

            // Create mode: filter out incomplete expenses
            const completeExpenses = values.expenses.filter(
                exp => exp.itemName.trim() && parseFloat(exp.amount) > 0,
            );

            if (completeExpenses.length === 0) {
                toast.error("Please add at least one expense with an item name and amount.");
                return;
            }

            const eventId = String(eventID || eventData?.id || "");
            if (!eventId) {
                toast.error("Event ID is missing. Please refresh the page and try again.");
                return;
            }

            // POST each expense to the expenses endpoint with the expected request body
            for (const exp of completeExpenses) {
                const payload = {
                    itemName: exp.itemName,
                    eventID: eventId,
                    amount: parseFloat(exp.amount) || 0,
                    comments: exp.comments || "",
                    poc: exp.poc || "",
                    expenseDescription: exp.expenseDescription,
                    expenseStatus: exp.expenseStatus,
                    createdDate: new Date().toISOString(),
                };

                const res = await createExpense(payload);

                if (!res.ok) {
                    throw new Error(
                        `Failed to save expense "${exp.itemName}" (status ${res.status})`,
                    );
                }
            }

            toast.success("Expenses saved successfully");
            onSave();
            onClose();
        } catch (err) {
            console.error("Error saving expenses:", err);
            toast.error(editingExpense ? "Error updating expense" : "Error saving expenses");
        }
    };

    if (!isOpen) return null;

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title={editingExpense ? "Edit Expense" : "Expenses"}
            description={
                editingExpense
                    ? `Update details for "${editingExpense.itemName || "this expense"}".`
                    : "Add, edit, or manage expense items for this event."
            }
            size="xl"
            showCloseIcon
            icon={
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
                    <Receipt size={20} aria-hidden="true" />
                </span>
            }
        >
            <Formik
                initialValues={{ expenses: initialExpenses }}
                enableReinitialize
                validationSchema={validationSchema}
                onSubmit={handleSave}
            >
                {({ isSubmitting, values }) => (
                    <Form noValidate>
                        <ModalBody className="space-y-5">
                            {values.expenses.map((_, index) => (
                                <section
                                    key={index}
                                    aria-labelledby={`expense-${index}-heading`}
                                    className="flex flex-col rounded-xl border border-border bg-background p-4 sm:p-5"
                                >
                                    <SectionHeader
                                        id={`expense-${index}-heading`}
                                        icon={<Receipt size={18} aria-hidden="true" />}
                                        title="Expense Details"
                                        description="Item name, amount, type, and status for this expense."
                                        badge={<StepBadge>Required</StepBadge>}
                                    />
                                    <div className="mt-4 flex flex-1 flex-col justify-start gap-4">
                                        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                                            <FormikFieldInput
                                                name={`expenses[${index}].itemName`}
                                                label={
                                                    <span className="inline-flex items-center gap-1">
                                                        Item Name
                                                        <RequiredMark />
                                                    </span>
                                                }
                                                placeholder="e.g., Transportation, Food"
                                            />
                                            <FormikFieldInput
                                                name={`expenses[${index}].amount`}
                                                label={
                                                    <span className="inline-flex items-center gap-1">
                                                        Amount
                                                        <RequiredMark />
                                                    </span>
                                                }
                                                type="number"
                                                placeholder="Enter amount"
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                                            <FormikFieldSelect
                                                name={`expenses[${index}].expenseDescription`}
                                                label={
                                                    <span className="inline-flex items-center gap-1">
                                                        Expense Type
                                                        <RequiredMark />
                                                    </span>
                                                }
                                                options={EXPENSE_TYPE_OPTIONS}
                                                placeholder="Select expense type"
                                                isDisabled={!canEdit}
                                            />
                                            <FormikFieldSelect
                                                name={`expenses[${index}].expenseStatus`}
                                                label={
                                                    <span className="inline-flex items-center gap-1">
                                                        Status
                                                        <RequiredMark />
                                                    </span>
                                                }
                                                options={EXPENSE_STATUS_OPTIONS}
                                                placeholder="Select status"
                                                isDisabled={!canEdit}
                                            />
                                        </div>

                                        <FormikFieldInput
                                            name={`expenses[${index}].poc`}
                                            label="POC"
                                            placeholder="Point of Contact"
                                        />

                                        <FormikFieldTextArea
                                            name={`expenses[${index}].comments`}
                                            label="Comments"
                                            placeholder="Add any notes..."
                                            rows={3}
                                        />
                                    </div>
                                </section>
                            ))}
                        </ModalBody>
                        <ModalFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Info size={14} className="shrink-0" aria-hidden="true" />
                                <span>
                                    Fields marked{" "}
                                    <span className="font-semibold text-error">*</span> are
                                    required.
                                </span>
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
                                    {isSubmitting
                                        ? "Saving..."
                                        : editingExpense
                                          ? "Save Changes"
                                          : "Save Expenses"}
                                </Button>
                            </div>
                        </ModalFooter>
                    </Form>
                )}
            </Formik>
        </Modal>
    );
}
