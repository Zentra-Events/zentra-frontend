"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
    deleteFundAllocation,
    fetchFundAllocations,
    fetchFundAllocationById,
} from "@/lib/api/fund-allocation";
import { formatCurrency } from "@/lib/utils";
import { formatShortDate } from "@/lib/utils/date";
import type { FundAllocation } from "@/types/fund-allocation";
import type { MenuItem } from "@/types";

interface UseFundAllocationsOptions {
    /** When provided, fetches allocations for this specific event only. */
    eventID?: string;
    /** Whether to fetch immediately on mount. Defaults to true. */
    fetchOnMount?: boolean;
    /** Callback invoked after a successful create, edit, or delete. */
    onSaved?: () => void;
}

interface UseFundAllocationsReturn {
    allocations: FundAllocation[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    /** Open the create/edit form. */
    openForm: (editingAllocation?: FundAllocation | null) => void;
    closeForm: () => void;
    formOpen: boolean;
    editingAllocation: FundAllocation | null;
    /** Select an allocation for deletion. */
    selectForDelete: (allocation: FundAllocation) => void;
    cancelDelete: () => void;
    confirmDelete: () => Promise<void>;
    deleteTarget: FundAllocation | null;
    deleting: boolean;
    /** Format an allocation amount for display. */
    formatAmount: (amount: unknown) => string;
    /** Format an allocation date for display. */
    formatDate: (date: string | null | undefined) => string;
    /** Fetch a single allocation by ID. */
    fetchOne: (id: string) => Promise<FundAllocation | null>;
    /** Build the standard action menu items for an allocation row. */
    buildActionItems: (allocation: FundAllocation) => MenuItem[];
    /** Compute financial summary totals from the current allocations. */
    summary: {
        totalAllocated: number;
        totalExpenseAmount: number;
        totalBalanceToPay: number;
    };
    /** Called by the form modal when a create/update succeeds. */
    handleFormSaved: () => Promise<void>;
}

export function useFundAllocations({
    eventID,
    fetchOnMount = true,
    onSaved,
}: UseFundAllocationsOptions = {}): UseFundAllocationsReturn {
    const [allocations, setAllocations] = useState<FundAllocation[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form (create/edit) modal state.
    const [formOpen, setFormOpen] = useState(false);
    const [editingAllocation, setEditingAllocation] = useState<FundAllocation | null>(null);

    // Delete confirmation state.
    const [deleteTarget, setDeleteTarget] = useState<FundAllocation | null>(null);
    const [deleting, setDeleting] = useState(false);

    /* ── Data fetching ───────────────────────────────────────────── */

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = eventID ? await fetchFundAllocations(eventID) : [];
            setAllocations(data);
        } catch (err) {
            console.error("Failed to load fund allocations:", err);
            setAllocations([]);
            setError(
                err instanceof Error ? err.message : "Unable to load fund allocations."
            );
        } finally {
            setLoading(false);
        }
    }, [eventID]);

    const fetchOne = useCallback(
        async (id: string): Promise<FundAllocation | null> => {
            try {
                return await fetchFundAllocationById(id);
            } catch (err) {
                console.error("Failed to load fund allocation:", err);
                return null;
            }
        },
        []
    );

    useEffect(() => {
        if (fetchOnMount) {
            refetch();
        }
    }, [refetch, fetchOnMount]);

    /* ── Create / Edit ───────────────────────────────────────────── */

    const openForm = useCallback(
        (allocation?: FundAllocation | null) => {
            setEditingAllocation(allocation ?? null);
            setFormOpen(true);
        },
        []
    );

    const closeForm = useCallback(() => {
        setFormOpen(false);
        setEditingAllocation(null);
    }, []);

    const handleFormSaved = useCallback(async () => {
        setFormOpen(false);
        setEditingAllocation(null);
        await refetch();
        onSaved?.();
    }, [refetch, onSaved]);

    /* ── Delete ──────────────────────────────────────────────────── */

    const selectForDelete = useCallback((allocation: FundAllocation) => {
        if (!allocation.id) {
            toast.error(
                "This allocation cannot be deleted because the API did not return an allocation ID."
            );
            return;
        }
        setDeleteTarget(allocation);
    }, []);

    const cancelDelete = useCallback(() => {
        setDeleteTarget(null);
        setDeleting(false);
    }, []);

    const confirmDelete = useCallback(async () => {
        if (!deleteTarget?.id) return;

        setDeleting(true);
        try {
            const res = await deleteFundAllocation(deleteTarget.id);
            if (!res.ok) {
                throw new Error(
                    `Failed to delete fund allocation (status ${res.status})`
                );
            }
            toast.success("Fund allocation deleted successfully");
            setDeleteTarget(null);
            await refetch();
            onSaved?.();
        } catch (err) {
            console.error("Error deleting fund allocation:", err);
            toast.error("Failed to delete fund allocation. Please try again.");
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
        (date: string | null | undefined): string =>
            date ? formatShortDate(date) : "—",
        []
    );

    /* ── Financial summary ───────────────────────────────────────── */

    const summary = {
        totalAllocated: allocations.reduce((sum, a) => sum + a.assignedAmount, 0),
        totalExpenseAmount: allocations.reduce((sum, a) => sum + a.expenseAmount, 0),
        totalBalanceToPay: allocations.reduce((sum, a) => sum + a.balanceToPay, 0),
    };

    const buildActionItems = useCallback(
        (allocation: FundAllocation): MenuItem[] => {
            if (!allocation.id) {
                return [];
            }
            return [
                {
                    key: "view",
                    label: "View Expenses",
                    icon: undefined,
                    onClick: () => {},
                    scopes: ["r:expenses"],
                },
                {
                    key: "edit",
                    label: "Edit",
                    icon: undefined,
                    onClick: () => openForm(allocation),
                    scopes: ["w:expenses", "a:expenses"],
                },
                {
                    key: "delete",
                    label: "Delete",
                    icon: undefined,
                    onClick: () => selectForDelete(allocation),
                    className: "text-destructive focus:text-destructive",
                    scopes: ["w:expenses", "a:expenses"],
                },
            ];
        },
        [openForm, selectForDelete]
    );

    return {
        allocations,
        loading,
        error,
        refetch,
        fetchOne,
        openForm,
        closeForm,
        formOpen,
        editingAllocation,
        selectForDelete,
        cancelDelete,
        confirmDelete,
        deleteTarget,
        deleting,
        formatAmount,
        formatDate,
        summary,
        buildActionItems,
        handleFormSaved,
    };
}
