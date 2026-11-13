"use client";

import React, { useCallback, useState } from "react";

import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import { ExpensesModal } from "@/components/expenses-modal";
import { ExpensesTable } from "@/components/expenses-table";
import { ReceiptViewer } from "@/components/receipt-viewer";
import { fetchExpenseReceipt } from "@/lib/api/expense";
import { toast } from "sonner";
import type { Expense } from "@/types/expense";

interface ExpensesManagerProps {
    expenses: Expense[];
    eventID: string;
    onDeleteExpense: (expense: Expense) => Promise<void>;
    editingExpense: Expense | null;
    setEditingExpense: React.Dispatch<React.SetStateAction<Expense | null>>;
    expensesModalOpen: boolean;
    setExpensesModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    handleExpensesFormSaved: () => Promise<void>;
}

export function ExpensesManager({
    expenses,
    eventID,
    onDeleteExpense,
    editingExpense,
    setEditingExpense,
    expensesModalOpen,
    setExpensesModalOpen,
    handleExpensesFormSaved,
}: ExpensesManagerProps) {
    const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<Expense | null>(null);
    const [deletingExpense, setDeletingExpense] = useState(false);

    const [viewReceiptOpen, setViewReceiptOpen] = useState(false);
    const [viewReceiptLoadingExpenseId, setViewReceiptLoadingExpenseId] = useState<string | null>(null);
    const [viewReceiptData, setViewReceiptData] = useState<{
        receipt: string | null;
        receiptFileName: string | null;
        receiptContentType: string | null;
    } | null>(null);

    const handleEditExpense = (expense: Expense) => {
        setEditingExpense(expense);
        setExpensesModalOpen(true);
    };

    const handleDeleteExpense = (expense: Expense) => {
        setExpensesModalOpen(false);
        setDeleteExpenseTarget(expense);
    };

    const handleConfirmDeleteExpense = async () => {
        if (!deleteExpenseTarget?.id) return;
        setDeletingExpense(true);
        try {
            await onDeleteExpense(deleteExpenseTarget);
            setDeleteExpenseTarget(null);
        } catch (err) {
            console.error("Error deleting expense:", err);
        } finally {
            setDeletingExpense(false);
        }
    };

    /** Fetch receipt data on demand and open the viewer modal. */
    const handleViewReceipt = useCallback(
        async (expense: Expense) => {
            if (!expense.id) {
                toast.error("Cannot view receipt: expense ID is missing.");
                return;
            }
            setViewReceiptLoadingExpenseId(expense.id);
            try {
                const res = await fetchExpenseReceipt(expense.id);
                if (!res.ok) {
                    toast.error("Failed to load receipt.");
                    return;
                }
                const arrayBuffer = await res.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);
                let binary = "";
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64 = btoa(binary);
                const contentType =
                    res.headers.get("content-type") || expense.receiptContentType || null;
                setViewReceiptData({
                    receipt: base64,
                    receiptFileName: expense.receiptFileName ?? null,
                    receiptContentType: contentType,
                });
                setViewReceiptOpen(true);
            } catch (err) {
                console.error("Failed to load receipt:", err);
                toast.error("Failed to load receipt.");
            } finally {
                setViewReceiptLoadingExpenseId(null);
            }
        },
        [fetchExpenseReceipt],
    );

    return (
        <>
            <div className="px-5 sm:px-6 py-3">
                <ExpensesTable
                    data={expenses}
                    onEdit={handleEditExpense}
                    onDelete={handleDeleteExpense}
                    onViewReceipt={handleViewReceipt}
                    viewReceiptLoadingExpenseId={viewReceiptLoadingExpenseId}
                />
            </div>

            {expensesModalOpen && (
                <ExpensesModal
                    isOpen={expensesModalOpen}
                    onClose={() => setExpensesModalOpen(false)}
                    eventData={{ id: undefined, expensesList: [] }}
                    eventID={eventID}
                    onSave={handleExpensesFormSaved}
                    editingExpense={editingExpense}
                />
            )}

            <ReceiptViewer
                open={viewReceiptOpen}
                onClose={() => setViewReceiptOpen(false)}
                receipt={viewReceiptData?.receipt ?? null}
                receiptFileName={viewReceiptData?.receiptFileName ?? null}
                receiptContentType={viewReceiptData?.receiptContentType ?? null}
            />

            <ConfirmationModal
                open={!!deleteExpenseTarget}
                onClose={() => setDeleteExpenseTarget(null)}
                onConfirm={handleConfirmDeleteExpense}
                title="Delete Expense"
                description={
                    deleteExpenseTarget
                        ? `Are you sure you want to delete "${
                              deleteExpenseTarget.itemName || "this expense"
                          }"? This action cannot be undone.`
                        : undefined
                }
                confirmText={deletingExpense ? "Deleting..." : "Delete"}
                cancelText="Cancel"
                variant="destructive"
                isLoading={deletingExpense}
            />
        </>
    );
}
