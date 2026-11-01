"use client";

import React, { useMemo } from "react";

import { Button, MenuList, Table } from "@/components/ui";
import { MoreVerticalIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import { formatCurrency } from "@/lib/utils";
import { formatShortDate } from "@/lib/utils/date";
import { FundAllocationModal } from "@/components/fund-allocation-modal";
import type { Column } from "@/components/ui/table";
import type { FundAllocation } from "@/types/fund-allocation";
import type { MenuItem } from "@/types";
import type { User } from "@/types/user";

function resolveUserName(users: User[], id: string): string {
    const user = users.find(u => u.id === id);
    return user?.name ? user.name : id;
}

/* ------------------------------------------------------------------ */
/*  Fund Allocation Table */
/* ------------------------------------------------------------------ */

interface FundAllocationTableProps {
    data: FundAllocation[];
    users: User[];
    onViewExpenses: (allocation: FundAllocation) => void;
    onEdit: (allocation: FundAllocation) => void;
    onDelete: (allocation: FundAllocation) => void;
    canManage: boolean;
}

function FundAllocationTable({
    data,
    users,
    onViewExpenses,
    onEdit,
    onDelete,
    canManage,
}: FundAllocationTableProps) {
    const renderActions = (item: FundAllocation) => {
        const items: MenuItem[] = [];
        if (canManage && item.id) {
            items.push(
                { key: "edit", label: "Edit", icon: <PencilIcon size={16} />, onClick: () => onEdit(item) },
                { key: "delete", label: "Delete", icon: <TrashIcon size={16} />, onClick: () => onDelete(item), className: "text-destructive focus:text-destructive" },
            );
        }

        return (
            <div className="flex justify-end">
                {Boolean(items.length) && (<MenuList
                    align="end"
                    items={items}
                    trigger={
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVerticalIcon size={16} />
                        </Button>
                    }
                />)}
            </div>
        );
    };

    const columns: Column<FundAllocation>[] = useMemo(() => [
        {
            key: "assignee",
            header: "Assignee",
            render: (item: FundAllocation) => (
                <span className="font-medium text-foreground">{resolveUserName(users, item.assigneeUserId)}</span>
            ),
        },
        {
            key: "assignedAmount",
            header: "Allocated Amount",
            align: "right",
            render: (item: FundAllocation) => formatCurrency(item.assignedAmount),
        },
        {
            key: "expenseAmount",
            header: "Expense Amount",
            align: "right",
            render: (item: FundAllocation) => formatCurrency(item.expenseAmount),
        },
        {
            key: "balanceToPay",
            header: "Balance",
            align: "right",
            render: (item: FundAllocation) => formatCurrency(item.balanceToPay),
        },
        
        {
            key: "allocatedDate",
            header: "Allocated Date",
            render: (item: FundAllocation) => formatShortDate(item.allocatedDate ?? undefined),
        },
        {
            key: "usage",
            header: "Usage",
            align: "right",
            render: (item: FundAllocation) => {
                const pct = item.assignedAmount > 0 ? (item.expenseAmount / item.assignedAmount) * 100 : 0;
                const capped = Math.min(Math.max(pct, 0), 100);
                return (
                    <div className="w-full max-w-xs">
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs text-muted-foreground">{capped.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${capped}%` }} />
                        </div>
                    </div>
                );
            },
        },
        {
            key: "actions",
            header: "",
            align: "right",
            render: (item: FundAllocation) => renderActions(item),
        },
    ], [users, onViewExpenses, onEdit, onDelete, canManage]);

    return (
        <div className="overflow-x-auto">
            <Table data={data} columns={columns} getKey={(item: FundAllocation, index: number) => item.id ?? index} emptyMessage="No fund allocations found." />
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Fund Allocation Manager                                           */
/* ------------------------------------------------------------------ */

interface FundAllocationManagerProps {
    allocations: FundAllocation[];
    users: User[];
    canManage: boolean;
    eventID: string;
    eventName: string;
    onViewExpenses: (allocation: FundAllocation) => void;
    onSaveAllocation: (values: {
        eventId: string;
        assigneeUserId: string;
        assignedAmount: number;
        allocatedDate: string | null;
    }) => Promise<void>;
    editingAllocation: FundAllocation | null;
    setEditingAllocation: React.Dispatch<React.SetStateAction<FundAllocation | null>>;
    allocationModalOpen: boolean;
    setAllocationModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    onDeleteConfirm: () => Promise<void>;
    deleteAllocTarget: FundAllocation | null;
    setDeleteAllocTarget: React.Dispatch<React.SetStateAction<FundAllocation | null>>;
    deletingAlloc: boolean;
    setDeletingAlloc: React.Dispatch<React.SetStateAction<boolean>>;
}

export function FundAllocationManager({
    allocations,
    users,
    canManage,
    eventID,
    eventName,
    onViewExpenses,
    onSaveAllocation,
    editingAllocation,
    setEditingAllocation,
    allocationModalOpen,
    setAllocationModalOpen,
    onDeleteConfirm,
    deleteAllocTarget,
    setDeleteAllocTarget,
    deletingAlloc,
    setDeletingAlloc,
}: FundAllocationManagerProps) {
    const handleEditAllocation = (allocation: FundAllocation) => {
        setEditingAllocation(allocation);
        setAllocationModalOpen(true);
    };

    const handleDeleteAllocation = (allocation: FundAllocation) => {
        setAllocationModalOpen(false);
        setDeleteAllocTarget(allocation);
    };

    const handleConfirmDeleteAlloc = async () => {
        if (!deleteAllocTarget?.id) return;
        setDeletingAlloc(true);
        try {
            await onDeleteConfirm();
            setDeleteAllocTarget(null);
        } catch (err) {
            console.error("Error deleting fund allocation:", err);
        } finally {
            setDeletingAlloc(false);
        }
    };

    return (
        <>
            <FundAllocationTable
                data={allocations}
                users={users}
                onViewExpenses={onViewExpenses}
                onEdit={handleEditAllocation}
                onDelete={handleDeleteAllocation}
                canManage={canManage}
            />

            {allocationModalOpen && (
                <FundAllocationModal
                    isOpen={allocationModalOpen}
                    onClose={() => setAllocationModalOpen(false)}
                    onSave={onSaveAllocation}
                    eventID={eventID}
                    eventName={eventName}
                    users={users}
                    editing={editingAllocation}
                />
            )}

            <ConfirmationModal
                open={!!deleteAllocTarget}
                onClose={() => setDeleteAllocTarget(null)}
                onConfirm={handleConfirmDeleteAlloc}
                title="Delete Fund Allocation"
                description={
                    deleteAllocTarget
                        ? `Are you sure you want to delete the fund allocation for "${resolveUserName(users, deleteAllocTarget.assigneeUserId)}"? This action cannot be undone.`
                        : undefined
                }
                confirmText={deletingAlloc ? "Deleting..." : "Delete"}
                cancelText="Cancel"
                variant="destructive"
                isLoading={deletingAlloc}
            />
        </>
    );
}
