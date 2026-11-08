"use client";

import React, { useCallback, useEffect, useState, type ReactNode } from "react";
import { Formik, Form } from "formik";
import * as Yup from "yup";

import { Button } from "@/components/ui/button";
import { FormikFieldInput } from "@/components/ui/formik-field-input";
import { FormikFieldSelect } from "@/components/ui/formik-field-select";
import { FormikFieldTextArea } from "@/components/ui/formik-field-textarea";
import { UserSelectDropdown } from "@/components/user-select-dropdown";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import {
    createExpense,
    deleteExpenseReceipt,
    updateExpense,
    uploadExpenseReceipt,
} from "@/lib/api/expense";
import { useAuth } from "@/context/auth";
import { toast } from "sonner";
import { FileText, Info, Receipt } from "lucide-react";
import { hasPermission } from "@/lib/utils/permissions";
import type { Expense } from "@/types/expense";

interface ExpenseItem {
    id?: string;
    itemName: string;
    amount: string;
    comments: string;
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

interface ReceiptFileInfo {
    file: File;
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

const EXPENSE_STATUS_OPTIONS: { value: ExpenseItem["expenseStatus"]; label: string }[] = [
    { value: "ESTIMATE_SUBMITTED", label: "Estimate Submitted" },
    { value: "ESTIMATE_REVIEW", label: "Estimate Under Review" },
    { value: "ESTIMATE_APPROVED", label: "Estimate Approved" },
    { value: "ESTIMATE_REJECTED", label: "Estimate Rejected" },
];

const ACCEPTED_FILE_TYPES = ".jpg,.jpeg,.png,.pdf";
const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const initialExpense: ExpenseItem = {
    itemName: "",
    amount: "",
    comments: "",
    poc: "",
    expenseStatus: "ESTIMATE_SUBMITTED",
};

const validationSchema = Yup.object({
    expenses: Yup.array().of(
        Yup.object({
            itemName: Yup.string().trim().required("Item name is required"),
            amount: Yup.string()
                .trim()
                .test("is-positive-amount", "Amount must be greater than 0", function (value) {
                    return Boolean(value && parseFloat(value || "0") > 0);
                }),
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

function fileSizeLabel(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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
    const canEdit = hasPermission(user, undefined, ["w:expenses", "a:expenses"]);
    // Only super_admin or admin can choose who spent the money; everyone else
    // defaults the "Spent By" field to the logged in user.
    const isAdminOrSuperAdmin = hasPermission(user, ["super_admin", "admin"]);
    const defaultPoc = isAdminOrSuperAdmin ? "" : user?.name || "";
    const [initialExpenses, setInitialExpenses] = useState<ExpenseItem[]>([]);

    // Receipt file state: maps expense index -> selected file info
    const [receiptFiles, setReceiptFiles] = useState<Map<number, ReceiptFileInfo>>(
        new Map(),
    );
    // Tracks whether to remove an existing receipt on edit (index -> true)
    const [removeReceipt, setRemoveReceipt] = useState<Map<number, boolean>>(new Map());
    // Keep only receipt metadata; the saved binary is never needed for updates.
    const [existingReceipts, setExistingReceipts] = useState<
        Map<number, { fileName: string; contentType: string }>
    >(new Map());

    useEffect(() => {
        if (!isOpen) {
            setInitialExpenses([]);
            setReceiptFiles(new Map());
            setRemoveReceipt(new Map());
            setExistingReceipts(new Map());
            return;
        }

        setReceiptFiles(new Map());
        setRemoveReceipt(new Map());
        setExistingReceipts(new Map());

        // Edit mode: prefill the form with the single expense being edited.
        if (editingExpense) {
            setInitialExpenses([
                {
                    id: editingExpense.id || undefined,
                    itemName: editingExpense.itemName || "",
                    amount:
                        typeof editingExpense.amount === "number"
                            ? String(editingExpense.amount)
                            : String(editingExpense.amount || ""),
                    comments: editingExpense.comments || "",
                    poc: isAdminOrSuperAdmin ? editingExpense.poc || "" : defaultPoc,
                    expenseStatus:
                        (editingExpense.expenseStatus as ExpenseItem["expenseStatus"]) ||
                        "ESTIMATE_SUBMITTED",
                    createdDate: editingExpense.createdDate || undefined,
                    lastUpdateddDate: editingExpense.lastUpdateddDate || undefined,
                },
            ]);

            // Show existing receipt if present
            if (editingExpense.receiptFileName || editingExpense.receiptContentType) {
                setExistingReceipts(
                    new Map([
                        [
                            0,
                            {
                                fileName: editingExpense.receiptFileName || "receipt",
                                contentType: editingExpense.receiptContentType || "application/octet-stream",
                            },
                        ],
                    ]),
                );
            }
            return;
        }

        // Load existing expenses if available, otherwise start with one empty field
        if (Array.isArray(eventData?.expensesList) && eventData.expensesList.length > 0) {
            setInitialExpenses(
                eventData.expensesList.map(exp => ({
                    id: exp.id || undefined,
                    itemName: exp.itemName,
                    amount:
                        typeof exp.amount === "number"
                            ? String(exp.amount)
                            : String(exp.amount || ""),
                    comments: exp.comments || "",
                    poc: isAdminOrSuperAdmin ? exp.poc : defaultPoc,
                    expenseStatus:
                        (exp.expenseStatus as ExpenseItem["expenseStatus"]) ||
                        "ESTIMATE_SUBMITTED",
                    createdDate: exp.createdDate,
                    lastUpdateddDate: exp.lastUpdateddDate,
                })),
            );
        } else {
            setInitialExpenses([{ ...initialExpense, poc: defaultPoc }]);
        }
    }, [isOpen, eventData, editingExpense]);

    const handleFileChange = useCallback(
        (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            // Validate file type
            const validTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
            if (!validTypes.includes(file.type)) {
                toast.error(
                    `Invalid file type "${file.type}". Only JPG, JPEG, PNG, and PDF files are allowed.`,
                );
                e.target.value = "";
                return;
            }

            // Validate file size
            if (file.size > MAX_FILE_SIZE_BYTES) {
                toast.error(`File too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`);
                e.target.value = "";
                return;
            }

            setReceiptFiles(prev => {
                const next = new Map(prev);
                next.set(index, { file });
                return next;
            });
        },
        [],
    );

    const removeReceiptFile = useCallback((index: number) => {
        setReceiptFiles(prev => {
            const next = new Map(prev);
            next.delete(index);
            return next;
        });
    }, []);

    const removeExistingReceipt = useCallback((index: number) => {
        setRemoveReceipt(prev => {
            const next = new Map(prev);
            next.set(index, true);
            return next;
        });
        setReceiptFiles(prev => {
            const next = new Map(prev);
            next.delete(index);
            return next;
        });
        setExistingReceipts(prev => {
            const next = new Map(prev);
            next.delete(index);
            return next;
        });
    }, []);

    const persistExpenseUpdate = useCallback(
        async (exp: ExpenseItem, expenseId: string | undefined) => {
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

            const payload = {
                itemName: exp.itemName,
                eventID: eventId,
                amount: parseFloat(exp.amount) || 0,
                comments: exp.comments || "",
                poc: exp.poc || "",
                expenseStatus: exp.expenseStatus,
                createdDate: exp.createdDate,
                lastUpdateddDate: new Date().toISOString(),
            };
            const res = await updateExpense(expenseId, payload);
            if (!res.ok) {
                throw new Error(`Failed to update expense "${exp.itemName}" (status ${res.status})`);
            }

            const receiptInfo = receiptFiles.get(0);
            if (receiptInfo) {
                const receiptRes = await uploadExpenseReceipt(expenseId, receiptInfo.file);
                if (!receiptRes.ok) {
                    throw new Error(
                        `Expense updated, but receipt replacement failed (status ${receiptRes.status})`,
                    );
                }
            } else if (removeReceipt.has(0)) {
                const receiptRes = await deleteExpenseReceipt(expenseId);
                if (!receiptRes.ok) {
                    throw new Error(
                        `Expense updated, but receipt removal failed (status ${receiptRes.status})`,
                    );
                }
            }

            toast.success("Expense updated successfully");
            onSave();
            onClose();
        },
        [eventID, eventData, receiptFiles, removeReceipt, onSave, onClose],
    );

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

            // POST each expense to the expenses endpoint
            for (let i = 0; i < completeExpenses.length; i++) {
                const exp = completeExpenses[i];
                const payload = {
                    itemName: exp.itemName,
                    eventID: eventId,
                    amount: parseFloat(exp.amount) || 0,
                    comments: exp.comments || "",
                    poc: exp.poc || "",
                    expenseStatus: exp.expenseStatus,
                    createdDate: new Date().toISOString(),
                };
                const res = await createExpense(payload);
                if (!res.ok) {
                    throw new Error(
                        `Failed to save expense "${exp.itemName}" (status ${res.status})`,
                    );
                }

                const receiptInfo = receiptFiles.get(i);
                if (receiptInfo) {
                    const createdExpense: unknown = await res.json();
                    if (
                        typeof createdExpense !== "object" ||
                        createdExpense === null ||
                        !("id" in createdExpense) ||
                        typeof createdExpense.id !== "string" ||
                        !createdExpense.id
                    ) {
                        throw new Error(
                            `Expense "${exp.itemName}" was saved, but its ID was not returned for receipt upload.`,
                        );
                    }

                    const receiptRes = await uploadExpenseReceipt(
                        createdExpense.id,
                        receiptInfo.file,
                    );
                    if (!receiptRes.ok) {
                        throw new Error(
                            `Expense "${exp.itemName}" was saved, but receipt upload failed (status ${receiptRes.status}).`,
                        );
                    }
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
                {({ isSubmitting, values, setFieldValue }) => (
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
                                            <UserSelectDropdown
                                                isCreatable={false}
                                                value={values.expenses[index].poc || ""}
                                                onChange={name =>
                                                    setFieldValue(`expenses[${index}].poc`, name)
                                                }
                                                label={
                                                    <span className="inline-flex items-center gap-1">
                                                        Spent By
                                                    </span>
                                                }
                                                placeholder="Select user"
                                                isDisabled={!isAdminOrSuperAdmin}
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

                                        <FormikFieldTextArea
                                            name={`expenses[${index}].comments`}
                                            label="Comments"
                                            placeholder="Add any notes..."
                                            rows={6}
                                        />

                                        {/* Receipt / Bill Attachment Section */}
                                        <section
                                            className="mt-4 rounded-xl border border-border bg-surface p-4"
                                        >
                                            <SectionHeader
                                                id={`expense-${index}-receipt-heading`}
                                                icon={<Receipt size={18} aria-hidden="true" />}
                                                title="Receipt / Bill Attachment"
                                                description="Optional. Upload a receipt or bill (JPG, JPEG, PNG, PDF). Max 10 MB."
                                                badge={
                                                    editingExpense &&
                                                    existingReceipts.has(index)
                                                        ? <StepBadge>Existing</StepBadge>
                                                        : null
                                                }
                                            />
                                            <div className="mt-3 space-y-2">
                                                {/* Existing receipt display (edit mode) */}
                                                {editingExpense && existingReceipts.has(index) && (
                                                    <div className="flex items-center gap-2 rounded-md border border-border-hover bg-muted/50 p-3">
                                                        <FileText size={16} className="text-primary shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm text-foreground truncate">
                                                                {existingReceipts.get(index)?.fileName}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground truncate">
                                                                {existingReceipts.get(index)?.contentType}
                                                            </p>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                removeExistingReceipt(index)
                                                            }
                                                            className="h-8 px-2"
                                                        >
                                                            Remove
                                                        </Button>
                                                    </div>
                                                )}

                                                {/* File input */}
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="file"
                                                        id={`expense-receipt-${index}`}
                                                        accept={ACCEPTED_FILE_TYPES}
                                                        onChange={e => handleFileChange(index, e)}
                                                        disabled={isSubmitting}
                                                        className="sr-only"
                                                    />
                                                    <label
                                                        htmlFor={`expense-receipt-${index}`}
                                                        className="inline-flex items-center gap-2 rounded-md border border-border-hover bg-muted/50 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-accent cursor-pointer"
                                                    >
                                                        <span className="shrink-0">
                                                            {receiptFiles.has(index) ? (
                                                                <span className="text-primary">
                                                                    Replace
                                                                </span>
                                                            ) : (
                                                                <span>Attach Receipt</span>
                                                            )}
                                                        </span>
                                                    </label>
                                                    {receiptFiles.has(index) && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => removeReceiptFile(index)}
                                                            className="h-8 px-2 text-destructive hover:text-destructive"
                                                            disabled={isSubmitting}
                                                        >
                                                            Remove
                                                        </Button>
                                                    )}
                                                </div>

                                                {/* Selected file preview */}
                                                {receiptFiles.has(index) && (
                                                    <div className="flex items-center gap-2 rounded-md border border-border-hover bg-muted/50 p-3">
                                                        <FileText size={16} className="text-primary shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm text-foreground truncate">
                                                                {receiptFiles.get(index)?.file.name}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {fileSizeLabel(
                                                                    receiptFiles.get(index)?.file.size || 0,
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {!editingExpense && !existingReceipts.has(index) && !receiptFiles.has(index) && (
                                                    <p className="text-xs text-muted-foreground">
                                                        No receipt attached.
                                                    </p>
                                                )}
                                            </div>
                                        </section>
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
