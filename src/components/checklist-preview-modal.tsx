"use client";

import React, { useState } from "react";
import { Eye } from "lucide-react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Access } from "@/components/access";
import { groupByCategory } from "@/lib/utils";
import type { ChecklistItem } from "@/components/checklist-modal/types";
import type { ChecklistExportContext } from "@/lib/checklist-export/checklist-document";
import { ChecklistExportPreviewModal } from "@/components/checklist-export-preview-modal";

interface ChecklistPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    checklistData: ChecklistItem[];
    vendorList: { id?: string | number; name?: string }[];
    inventoryList: { id?: string | number; itemName?: string }[];
    exportContext?: ChecklistExportContext;
    onUpdate?: () => void;
}

const checkPastDate = (dateStr?: string) => {
    if (!dateStr) return false;
    const today = new Date();
    const date = new Date(dateStr);
    return date < today;
};

export function ChecklistPreviewModal({
    isOpen,
    onClose,
    checklistData,
    vendorList,
    inventoryList,
    exportContext,
    onUpdate,
}: ChecklistPreviewModalProps) {
    const [isExportPreviewOpen, setIsExportPreviewOpen] = useState(false);

    if (!isOpen) return null;

    const summary = {
        total: checklistData.length,
        completed: checklistData.filter(i => i.status === "COMPLETED").length,
        pending: checklistData.filter(i => i.status === "PENDING").length,
        inProgress: checklistData.filter(i => i.status === "IN_PROGRESS").length,
        totalValue: checklistData.reduce(
            (sum, item) => sum + (item.pricePerItem || 0) * (item.quantity || 1),
            0,
        ),
    };

    // Hierarchical grouping: Category → Sub Category → Items (shared utility).
    const groups = groupByCategory(checklistData);

    const totalItems = groups.reduce(
        (sum, group) =>
            sum +
            group.directItems.length +
            group.subCategories.reduce((subSum, sub) => subSum + sub.items.length, 0),
        0,
    );

    const renderItemRow = (
        item: ChecklistItem,
        key: string,
        isLastItem: boolean,
        rowIndex: number,
    ): React.ReactNode => {
        const descText = item.description || "-";
        const isLongDesc = descText.length > 12;

        return (
            <tr key={key} className={!isLastItem ? "border-b border-border" : ""}>
                <td className="py-3 px-3 align-middle text-xs text-muted-foreground">{rowIndex}</td>
                <td className="py-3 px-3 align-middle">
                    <span className="font-medium">{item.item}</span>
                </td>
                <td className="py-3 px-3 align-middle max-w-[200px]">
                    {isLongDesc ? (
                        <Tooltip content={descText}>
                            <span className="block truncate">{descText.slice(0, 12) + "..."}</span>
                        </Tooltip>
                    ) : (
                        descText
                    )}
                </td>
                <td className="py-3 px-3 align-middle text-center">{item.quantity || 0}</td>
                <td className="py-3 px-3 align-middle text-center">{item.days ?? "-"}</td>
                <td className="py-3 px-3 align-middle">
                    {(() => {
                        if (item.inventoryID) {
                            const inv = inventoryList.find(
                                i => String(i.id) === String(item.inventoryID),
                            );
                            return (
                                <span className="text-blue-600 dark:text-blue-400">
                                    📦 {inv?.itemName}
                                </span>
                            );
                        }
                        const vendor = vendorList.find(v => String(v.id) === String(item.vendor));
                        return <span>{vendor?.name || item.vendor || "-"}</span>;
                    })()}
                </td>
                <td className="py-3 px-3 align-middle text-center">
                    {(() => {
                        const statusStyles: Record<string, string> = {
                            PENDING:
                                "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
                            IN_PROGRESS:
                                "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
                            COMPLETED:
                                "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
                        };
                        const statusClass =
                            statusStyles[item.status || "PENDING"] || statusStyles.PENDING;
                        return (
                            <span
                                className={`px-2 py-1 rounded text-xs font-medium ${statusClass}`}
                            >
                                {item.status || "PENDING"}
                            </span>
                        );
                    })()}
                </td>
                <td className="py-3 px-3 align-middle text-center">
                    {item.deadlineDate ? (
                        <span
                            className={
                                checkPastDate(item.deadlineDate)
                                    ? "text-red-500 font-medium"
                                    : ""
                            }
                        >
                            {item.deadlineDate}
                        </span>
                    ) : (
                        "-"
                    )}
                </td>
                <Access roles={["super_admin"]}>
                    <td className="py-3 px-3 align-middle text-right">
                        {item.pricePerItem ? `₹${item.pricePerItem}` : "-"}
                    </td>
                </Access>
            </tr>
        );
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            size="xxl"
            title="Checklist Preview"
            description="Review all checklist items before saving"
            showCloseIcon={true}
        >
            <ModalBody className="max-h-[calc(100vh-300px)] overflow-y-auto">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 pb-6 border-b border-border">
                    <div className="text-center">
                        <p className="text-2xl font-bold text-primary">{summary.total}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            Total Items
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {summary.completed}
                        </p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            Completed
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                            {summary.pending}
                        </p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            Pending
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {summary.inProgress}
                        </p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            In Progress
                        </p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-primary">₹{summary.totalValue}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            Total Value
                        </p>
                    </div>
                </div>

                {/* Single table with grouped categories and one column header */}
                <div className="overflow-x-auto border border-border rounded-md">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                                <th className="py-3 px-3 font-medium text-xs text-muted-foreground w-10">
                                    No
                                </th>
                                <th className="py-3 px-3 font-medium">Item Name</th>
                                <th className="py-3 px-3 font-medium max-w-[200px]">Description</th>
                                <th className="py-3 px-3 font-medium text-center w-16">Qty</th>
                                <th className="py-3 px-3 font-medium text-center w-16">Days</th>
                                <th className="py-3 px-3 font-medium">Vendor / Inventory</th>
                                <th className="py-3 px-3 font-medium text-center w-24">Status</th>
                                <th className="py-3 px-3 font-medium text-center">Deadline</th>
                                <Access roles={["super_admin"]}>
                                    <th className="py-3 px-3 font-medium text-right w-20">Rate</th>
                                </Access>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                const rows: React.ReactNode[] = [];
                                let globalIndex = 0;

                                groups.forEach(group => {
                                    // Category header row spanning all columns
                                    rows.push(
                                        <tr
                                            key={`category-${group.name}`}
                                            className="bg-muted/50 border-b border-border"
                                        >
                                            <td
                                                colSpan={9}
                                                className="px-4 py-2 text-sm font-semibold text-foreground uppercase tracking-wide"
                                            >
                                                {group.name}
                                            </td>
                                        </tr>,
                                    );

                                    // 1) Items without a Sub Category first
                                    group.directItems.forEach((item, idx) => {
                                        globalIndex++;
                                        const isLastItem = globalIndex === totalItems;
                                        rows.push(
                                            renderItemRow(
                                                item,
                                                `item-${group.name}-direct-${idx}`,
                                                isLastItem,
                                                globalIndex,
                                            ),
                                        );
                                    });

                                    // 2) Then items grouped under their Sub Category headers
                                    group.subCategories.forEach(sub => {
                                        // Sub-category header row (only when items exist)
                                        rows.push(
                                            <tr
                                                key={`subcategory-${group.name}-${sub.name}`}
                                                className="bg-muted/30 border-b border-border"
                                            >
                                                <td
                                                    colSpan={9}
                                                    className="px-6 py-1.5 text-xs font-medium text-muted-foreground"
                                                >
                                                    {sub.name}
                                                </td>
                                            </tr>,
                                        );

                                        sub.items.forEach((item, idx) => {
                                            globalIndex++;
                                            const isLastItem = globalIndex === totalItems;
                                            rows.push(
                                                renderItemRow(
                                                    item,
                                                    `item-${group.name}-${sub.name}-${idx}`,
                                                    isLastItem,
                                                    globalIndex,
                                                ),
                                            );
                                        });
                                    });
                                });

                                return rows;
                            })()}
                        </tbody>
                    </table>
                </div>
            </ModalBody>

            <ModalFooter>
                <Button variant="outline" onClick={onClose}>
                    Close
                </Button>
                <Button
                    variant="outline"
                    onClick={() => setIsExportPreviewOpen(true)}
                    className="flex items-center gap-2"
                    icon={<Eye size={16} />}
                >
                    Preview
                </Button>
                {onUpdate && (
                    <Button onClick={onUpdate} variant="primary">
                        Update Checklist
                    </Button>
                )}
            </ModalFooter>

            {isExportPreviewOpen && (
                <ChecklistExportPreviewModal
                    checklistData={checklistData}
                    vendorList={vendorList}
                    inventoryList={inventoryList}
                    exportContext={exportContext}
                    onClose={() => setIsExportPreviewOpen(false)}
                />
            )}
        </Modal>
    );
}
