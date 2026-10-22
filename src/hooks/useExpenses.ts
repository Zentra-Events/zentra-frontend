"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
    deleteExpense,
    fetchAllExpenses,
    fetchEventExpenses,
} from "@/lib/api/expense";
import { formatCurrency } from "@/lib/utils";
import { formatShortDate } from "@/lib/utils/date";
import type { Expense } from "@/types/expense";
import type { MenuItem } from "@/types";

/* ------------------------------------------------------------------ */
/*  Shared labels & status metadata                                   */
/* ------------------------------------------------------------------ */

export const EXPENSE_TYPE_LABELS: Record<string, string> = {
    ESTIMATED_EXPENSE: "Estimated Expense",
    ACTUAL_EXPENSE: "Actual Expense",
};

export const EXPENSE_STATUS_META: Record<
    string,
    {
        label: string;
        variant:
            | "default"
            | "success"
            | "warning"
            | "danger"
            | "info";
    }
> = {
    ESTIMATE_SUBMITTED: { label: "Submitted", variant: "warning" },
    ESTIMATE_REVIEW: { label: "Under Review", variant: "warning" },
    ESTIMATE_APPROVED: { label: "Approved", variant: "success" },
    ESTIMATE_REJECTED: { label: "Rejected", variant: "danger" },
    APPROVED: { label: "Approved", variant: "success" },
    REJECTED: { label: "Rejected", variant: "danger" },
};

interface UseExpensesOptions {
    /** When provided, fetches expenses for this specific event only. */
    eventID?: string;
    /** Whether to fetch immediately on mount. Defaults to true. */
    fetchOnMount?: boolean;
    /** Callback invoked after a successful create, edit, or delete. */
    onSaved?: () => void;
}

interface UseExpensesReturn {
    expenses: Expense[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    /** Open the create/edit form. */
    openForm: (editingExpense?: Expense | null) => void;
    closeForm: () => void;
    formOpen: boolean;
    editingExpense: Expense | null;
    /** Select an expense for deletion. */
    selectForDelete: (expense: Expense) => void;
    cancelDelete: () => void;
    confirmDelete: () => Promise<void>;
    deleteTarget: Expense | null;
    deleting: boolean;
    /** Format an expense amount for display. */
    formatAmount: (amount: unknown) => string;
    /** Format an expense date for display. */
    formatDate: (date: string | undefined) => string;
    /** Get the label for an expense type. */
    getTypeLabel: (type: string | undefined) => string;
    /** Get the status badge metadata for an expense status. */
    getStatusMeta: (status: string | undefined) => {
        label: string;
        variant: "default" | "success" | "warning" | "danger" | "info";
    };
    /** Build the standard action menu items for an expense row. */
    buildActionItems: (expense: Expense) => MenuItem[];
    /** Called by the form modal when a create/update succeeds. */
    handleFormSaved: () => Promise<void>;
}

export function useExpenses({
    eventID,
    fetchOnMount = true,
    onSaved,
}: UseExpensesOptions = {}): UseExpensesReturn {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form (create/edit) modal state.
    const [formOpen, setFormOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

    // Delete confirmation state.
    const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
    const [deleting, setDeleting] = useState(false);

    /* ── Data fetching ───────────────────────────────────────────── */

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = eventID
                ? await fetchEventExpenses(eventID)
                : await fetchAllExpenses();
            setExpenses(data);
        } catch (err) {
            console.error("Failed to load expenses:", err);
            setExpenses([]);
            setError(
                err instanceof Error ? err.message : "Unable to load expenses."
            );
        } finally {
            setLoading(false);
        }
    }, [eventID]);

    useEffect(() => {
        if (fetchOnMount) {
            refetch();
        }
    }, [refetch, fetchOnMount]);
    /* ── Create / Edit ───────────────────────────────────────────── */

    const openForm = useCallback(
        (expense?: Expense | null) => {
            setEditingExpense(expense ?? null);
            setFormOpen(true);
        },
        []
    );

    const closeForm = useCallback(() => {
        setFormOpen(false);
        setEditingExpense(null);
    }, []);

    const handleFormSaved = useCallback(async () => {
        setFormOpen(false);
        setEditingExpense(null);
        await refetch();
        onSaved?.();
    }, [refetch, onSaved]);

    /* ── Delete ──────────────────────────────────────────────────── */

    const selectForDelete = useCallback((expense: Expense) => {
        if (!expense.id) {
            toast.error(
                "This expense cannot be deleted because the API did not return an expense ID."
            );
            return;
        }
        setDeleteTarget(expense);
    }, []);

    const cancelDelete = useCallback(() => {
        setDeleteTarget(null);
        setDeleting(false);
    }, []);

    const confirmDelete = useCallback(async () => {
        if (!deleteTarget?.id) return;

        setDeleting(true);
        try {
            const res = await deleteExpense(deleteTarget.id);
            if (!res.ok) {
                throw new Error(`Failed to delete expense (status ${res.status})`);
            }
            toast.success("Expense deleted successfully");
            setDeleteTarget(null);
            await refetch();
            onSaved?.();
        } catch (err) {
            console.error("Error deleting expense:", err);
            toast.error("Failed to delete expense. Please try again.");
        } finally {
            setDeleting(false);
        }
    }, [deleteTarget, refetch, onSaved]);

    /* ── Formatting helpers ──────────────────────────────────────── */

    const formatAmount = useCallback((amount: unknown): string => {
        const num =
            typeof amount === "string"
                ? Number(amount)
                : typeof amount === "number"
                  ? amount
                  : NaN;
        return Number.isFinite(num) ? formatCurrency(num) : "—";
    }, []);

    const formatDate = useCallback(
        (date: string | undefined): string =>
            date ? formatShortDate(date) : "—",
        []
    );

    const getTypeLabel = useCallback(
        (type: string | undefined): string =>
            EXPENSE_TYPE_LABELS[type ?? ""] || type || "—",
        []
    );

    const getStatusMeta = useCallback(
        (status: string | undefined) => {
            const s = String(status ?? "");
            const meta = EXPENSE_STATUS_META[s];
            return { label: meta?.label ?? s, variant: meta?.variant ?? "default" };
        },
        []
    );

    const buildActionItems = useCallback(
        (expense: Expense): MenuItem[] => {
            if (!expense.id) {
                return [];
            }
            return [
                {
                    key: "edit",
                    label: "Edit",
                    icon: undefined,
                    onClick: () => openForm(expense),
                    scopes: ["w:expenses", "a:expenses"],
                },
                {
                    key: "delete",
                    label: "Delete",
                    icon: undefined,
                    onClick: () => selectForDelete(expense),
                    className: "text-destructive focus:text-destructive",
                    scopes: ["w:expenses", "a:expenses"],
                },
            ];
        },
        [openForm, selectForDelete]
    );

    return {
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
        formatAmount,
        formatDate,
        getTypeLabel,
        getStatusMeta,
        buildActionItems,
        handleFormSaved,
    };
}