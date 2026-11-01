"use client";

import React, { useState } from "react";

import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import { ExpensesModal } from "@/components/expenses-modal";
import { ExpensesTable } from "@/components/expenses-table";
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

    return (
        <>
            <div className="px-5 sm:px-6 py-3">
                <ExpensesTable data={expenses} onEdit={handleEditExpense} onDelete={handleDeleteExpense} />
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
