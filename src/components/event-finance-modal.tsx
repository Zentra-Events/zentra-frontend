"use client";

import React, { useState } from "react";
import { WalletIcon, PlusIcon, ReceiptIcon } from "lucide-react";

import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { useAuth } from "@/context/auth";
import { hasPermission } from "@/lib/utils/permissions";
import { useExpenses } from "@/hooks/useExpenses";
import { useFundAllocations } from "@/hooks/useFundAllocations";
import { useUsers } from "@/hooks/useUsers";
import { createFundAllocation, deleteFundAllocation, updateFundAllocation } from "@/lib/api/fund-allocation";
import { deleteExpense } from "@/lib/api/expense";
import { formatCurrency } from "@/lib/utils";
import type { Expense } from "@/types/expense";
import type { FundAllocation } from "@/types/fund-allocation";
import { FundAllocationManager } from "@/components/fund-allocation-manager";
import { ExpensesManager } from "@/components/expenses-manager";

type TabKey = "allocations" | "expenses";

interface EventFinanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventData?: {
        id?: string;
        eventID?: string;
        title?: string;
        [key: string]: unknown;
    } | null;
    eventID?: string;
}

/* ------------------------------------------------------------------ */
/*  Financial Summary Cards                                           */

function StatCard({
    title,
    value,
    icon,
    variant,
}: {
    title: string;
    value: string;
    icon: React.ReactNode;
    variant?: "primary" | "success" | "warning" | "danger";
}) {
    const variantMap: Record<string, string> = {
        primary: "bg-primary-light text-primary",
        success: "bg-success-light text-success",
        warning: "bg-warning-light text-warning",
        danger: "bg-error-light text-error",
    };
    return (
        <div className="rounded-lg border border-border p-3 sm:p-4">
            <div className="flex items-center gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${variantMap[variant ?? "primary"]}`}>
                    {icon}
                </span>
                <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
                    <p className="text-sm font-semibold text-foreground">{value}</p>
                </div>
            </div>
        </div>
    );
}

function EventFinanceSummary({ summary }: { summary: { totalAllocated: number; totalExpenseAmount: number; totalBalanceToPay: number } }) {
    const availableBalance = summary.totalAllocated - summary.totalExpenseAmount;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-5 py-3 sm:px-6 sm:py-4">
            <StatCard title="Total Allocated" value={formatCurrency(summary.totalAllocated)} icon={<WalletIcon size={16} aria-hidden="true" />} variant="primary" />
            <StatCard title="Total Expenses" value={formatCurrency(summary.totalExpenseAmount)} icon={<ReceiptIcon size={16} aria-hidden="true" />} variant="danger" />
            <StatCard title="Available Balance" value={formatCurrency(availableBalance)} icon={<WalletIcon size={16} aria-hidden="true" />} variant="success" />
            <StatCard title="Pending Expenses" value={formatCurrency(summary.totalExpenseAmount)} icon={<ReceiptIcon size={16} aria-hidden="true" />} variant="warning" />
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Main Event Finance Modal                                          */
/* ------------------------------------------------------------------ */

export function EventFinanceModal({
    isOpen,
    onClose,
    eventData,
    eventID,
}: EventFinanceModalProps) {
    const { user } = useAuth();
    const canManage = hasPermission(user, undefined, ["w:expenses", "a:expenses"]);

    const resolvedEventID = String(eventID || eventData?.eventID || eventData?.id || "");
    const resolvedEventName = String(eventData?.title || "");

    const [activeTab, setActiveTab] = useState<TabKey>("allocations");
    const [allocationModalOpen, setAllocationModalOpen] = useState(false);
    const [editingAllocation, setEditingAllocation] = useState<FundAllocation | null>(null);

    const [expensesModalOpen, setExpensesModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

    const [deleteAllocTarget, setDeleteAllocTarget] = useState<FundAllocation | null>(null);
    const [deletingAlloc, setDeletingAlloc] = useState(false);

    const { users } = useUsers();

    const {
        expenses,
        refetch: refetchExpenses,
        closeForm: closeExpensesForm,
        handleFormSaved: handleExpensesFormSaved,
    } = useExpenses({
        eventID: resolvedEventID || undefined,
        fetchOnMount: false,
    });

    const {
        allocations,
        refetch: refetchAllocations,
        summary,
    } = useFundAllocations({
        eventID: resolvedEventID || undefined,
        fetchOnMount: false,
    });

    React.useEffect(() => {
        if (!isOpen) {
            closeExpensesForm();
            setActiveTab("allocations");
            return;
        }
        (async () => {
            await Promise.all([refetchExpenses(), refetchAllocations()]);
        })();
    }, [isOpen, refetchExpenses, refetchAllocations, closeExpensesForm]);

    const allocationCount = allocations.length;
    const expenseCount = expenses.length;

    const handleViewExpenses = (_allocation: FundAllocation) => {
        setActiveTab("expenses");
    };

    const handleCreateAllocation = () => {
        setEditingAllocation(null);
        setActiveTab("allocations");
        setAllocationModalOpen(true);
    };

    const handleCreateExpense = () => {
        setEditingExpense(null);
        setActiveTab("expenses");
        setExpensesModalOpen(true);
    };

    const handleSaveAllocation = async (values: {
        eventId: string;
        assigneeUserId: string;
        assignedAmount: number;
        allocatedDate: string | null;
    }) => {
        if (editingAllocation) {
            const res = await updateFundAllocation(editingAllocation.id, {
                id: editingAllocation.id,
                assigneeUserId: values.assigneeUserId,
                eventId: values.eventId,
                eventName: resolvedEventName,
                assignedAmount: values.assignedAmount,
                expenseAmount: editingAllocation.expenseAmount,
                allocatedDate: values.allocatedDate,
                assignedUserId: values.assigneeUserId,
                balanceToPay: editingAllocation.balanceToPay,
            });
            if (!res.ok) throw new Error(`Failed to update allocation (status ${res.status})`);
        } else {
            const res = await createFundAllocation({
                eventId: values.eventId,
                eventName: resolvedEventName,
                assigneeUserId: values.assigneeUserId,
                assignedAmount: values.assignedAmount,
                allocatedDate: values.allocatedDate,
                assignedUserId: values.assigneeUserId,
                expenseAmount: 0,
                balanceToPay: values.assignedAmount,
            });
            if (!res.ok) throw new Error(`Failed to create allocation (status ${res.status})`);
        }
        await refetchAllocations();
    };

    const handleDeleteAllocation = async (allocation: FundAllocation) => {
        const res = await deleteFundAllocation(allocation.id);
        if (!res.ok) throw new Error(`Failed to delete allocation (status ${res.status})`);
        await refetchAllocations();
    };

    const handleDeleteConfirm = async () => {
        if (!deleteAllocTarget) return;
        await handleDeleteAllocation(deleteAllocTarget);
    };

    const handleDeleteExpense = async (expense: Expense) => {
        if (!expense.id) return;
        const res = await deleteExpense(expense.id);
        if (!res.ok) throw new Error(`Failed to delete expense (status ${res.status})`);
        await refetchExpenses();
    };

    return (
        <>
            <Modal
                open={isOpen}
                onClose={onClose}
                title="Event Finance"
                description="Track allocated funds, expenses, and remaining balance for this event."
                size="xxl"
                icon={
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
                        <ReceiptIcon size={20} aria-hidden="true" />
                    </span>
                }
                headerActions={
                    canManage ? (
                        <div className="flex items-center gap-2">
                            <Button size="sm" onClick={handleCreateAllocation} icon={<WalletIcon size={16} aria-hidden="true" />}>
                                Allocate Funds
                            </Button>
                            <Button size="sm" onClick={handleCreateExpense} icon={<ReceiptIcon size={16} aria-hidden="true" />}>
                                Create Expense
                            </Button>
                        </div>
                    ) : undefined
                }
            >
                <ModalBody className="max-h-[calc(100vh-240px)] overflow-y-auto">
                    <EventFinanceSummary summary={summary} />

                    <Tabs
                        value={activeTab}
                        onChange={(key: string) => setActiveTab(key as TabKey)}
                        className="px-5 sm:px-6 border-b border-border"
                        items={[
                            { key: "allocations", label: "Fund Allocation", count: allocationCount },
                            { key: "expenses", label: "Expenses", count: expenseCount },
                        ]}
                    />

                    {activeTab === "allocations" ? (
                        <FundAllocationManager
                            allocations={allocations}
                            users={users}
                            canManage={canManage}
                            eventID={resolvedEventID}
                            eventName={resolvedEventName}
                            onViewExpenses={handleViewExpenses}
                            onSaveAllocation={handleSaveAllocation}
                            editingAllocation={editingAllocation}
                            setEditingAllocation={setEditingAllocation}
                            allocationModalOpen={allocationModalOpen}
                            setAllocationModalOpen={setAllocationModalOpen}
                            onDeleteConfirm={handleDeleteConfirm}
                            deleteAllocTarget={deleteAllocTarget}
                            setDeleteAllocTarget={setDeleteAllocTarget}
                            deletingAlloc={deletingAlloc}
                            setDeletingAlloc={setDeletingAlloc}
                        />
                    ) : (
                        <ExpensesManager
                            expenses={expenses}
                            eventID={resolvedEventID}
                            onDeleteExpense={handleDeleteExpense}
                            editingExpense={editingExpense}
                            setEditingExpense={setEditingExpense}
                            expensesModalOpen={expensesModalOpen}
                            setExpensesModalOpen={setExpensesModalOpen}
                            handleExpensesFormSaved={handleExpensesFormSaved}
                        />
                    )}
                </ModalBody>
                <ModalFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between px-5 sm:px-6 py-4">
                    <p className="text-xs text-muted-foreground">
                        {allocationCount} allocation{allocationCount === 1 ? "" : "s"} ·
                        {expenseCount} expense{expenseCount === 1 ? "" : "s"}
                    </p>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </ModalFooter>
            </Modal>
        </>
    );
}
