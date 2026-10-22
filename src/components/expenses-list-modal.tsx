"use client";

import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import { ExpensesModal } from "@/components/expenses-modal";
import { PlusIcon, ReceiptIcon } from "@/components/ui/icons";
import { useAuth } from "@/context/auth";
import { hasPermission } from "@/lib/utils/permissions";
import { useExpenses } from "@/hooks/useExpenses";
import { ExpensesTable } from "@/components/expenses-table";
import type { Expense } from "@/types/expense";

interface ExpensesListModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventData?: {
        id?: string;
        eventID?: string;
        title?: string;
        [key: string]: unknown;
    } | null;
    eventID?: string;
    /** Optional callback invoked after a successful create, edit, or delete. */
    onSaved?: () => void;
}

export function ExpensesListModal({
    isOpen,
    onClose,
    eventData,
    eventID,
    onSaved,
}: ExpensesListModalProps) {
    const { user } = useAuth();
    // Only admin and super admin roles can create, edit, or delete expenses.
    const canManage = hasPermission(user, undefined, ["w:expenses", "a:expenses"]);

    const resolvedEventID = String(eventID || eventData?.eventID || eventData?.id || "");

    const {
        expenses,
        loading,
        error,
        refetch,
        openForm,
        closeForm,
        formOpen,
        editingExpense,
        selectForDelete,
        cancelDelete,
        confirmDelete,
        deleteTarget,
        deleting,
        handleFormSaved,
    } = useExpenses({
        eventID: resolvedEventID || undefined,
        fetchOnMount: false,
        onSaved,
    });

    // Fetch when the modal opens; reset any transient state when it closes.
    React.useEffect(() => {
        if (!isOpen) {
            closeForm();
            cancelDelete();
            return;
        }
        refetch();
    }, [isOpen, refetch, closeForm, cancelDelete]);

    const missingIdCount = expenses.filter(item => !item.id).length;
    const canNotModifyAny = missingIdCount > 0 && missingIdCount === expenses.length;

    const handleCreateClick = () => {
        openForm();
    };

    const handleEditClick = (expense: Expense) => {
        openForm(expense);
    };

    const handleDeleteClick = (expense: Expense) => {
        selectForDelete(expense);
    };

    /* Table rendering is handled by the shared ExpensesTable component below */

    return (
        <>
            <Modal
                open={isOpen}
                onClose={onClose}
                title="Expenses"
                description="View and manage expense items for this event."
                size="xxl"
                icon={
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
                        <ReceiptIcon size={20} aria-hidden="true" />
                    </span>
                }
                headerActions={
                    canManage ? (
                        <Button size="sm" onClick={handleCreateClick}>
                            Create Expense
                        </Button>
                    ) : undefined
                }
            >
                <ModalBody>
                    {loading ? (
                        <div className="flex h-56 items-center justify-center">
                            <Loading />
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-error-light text-error">
                                <AlertCircle size={20} aria-hidden="true" />
                            </span>
                            <p className="text-sm text-muted-foreground">{error}</p>
                            <Button
                                variant="outline"
                                size="sm"
                                icon={<RefreshCw size={14} aria-hidden="true" />}
                                onClick={refetch}
                            >
                                Retry
                            </Button>
                        </div>
                    ) : expenses.length === 0 ? (
                        <div className="rounded-md border border-border p-8 text-center">
                            <p className="text-sm text-muted-foreground">
                                No expenses have been added for this event yet.
                            </p>
                            {canManage && (
                                <Button
                                    size="sm"
                                    icon={<PlusIcon size={16} aria-hidden="true" />}
                                    onClick={handleCreateClick}
                                    className="mt-4"
                                >
                                    Create Expense
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {missingIdCount > 0 && (
                                <div className="rounded-md border border-warning-light bg-warning-light/40 px-3 py-2 text-xs text-warning">
                                    <strong className="font-semibold">
                                        Edit and delete unavailable:
                                    </strong>{" "}
                                    the backend does not currently return an expense ID for this
                                    list
                                    {canNotModifyAny
                                        ? " — expenses can be viewed but not edited or deleted"
                                        : " — those rows can be viewed but not edited or deleted"}
                                    .
                                </div>
                            )}
                            <ExpensesTable
                                data={expenses}
                                onEdit={handleEditClick}
                                onDelete={handleDeleteClick}
                            />
                        </div>
                    )}
                </ModalBody>
                <ModalFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                        {expenses.length > 0
                            ? `${expenses.length} expense${expenses.length === 1 ? "" : "s"}`
                            : "No expenses"}
                    </p>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </ModalFooter>
            </Modal>

            {isOpen && (
                <ExpensesModal
                    isOpen={formOpen}
                    onClose={closeForm}
                    eventData={{ id: eventData?.id, eventID: eventData?.eventID }}
                    eventID={resolvedEventID}
                    editingExpense={editingExpense}
                    onSave={handleFormSaved}
                />
            )}

            <ConfirmationModal
                open={!!deleteTarget}
                onClose={() => {
                    if (!deleting) cancelDelete();
                }}
                onConfirm={confirmDelete}
                title="Delete Expense"
                description={
                    deleteTarget
                        ? `Are you sure you want to delete "${
                              deleteTarget.itemName || "this expense"
                          }"? This action cannot be undone.`
                        : undefined
                }
                confirmText={deleting ? "Deleting..." : "Delete"}
                cancelText="Cancel"
                variant="destructive"
                isLoading={deleting}
            />
        </>
    );
}
