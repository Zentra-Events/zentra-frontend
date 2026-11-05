"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

import { useRequestApi } from "@/hooks/useRequestApi";
import { Button } from "@/components/ui/button";
import { MenuList } from "@/components/ui";
import { MoreVerticalIcon, TrashIcon, FileTextIcon, PencilIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { MobileCardList } from "@/components/shared/mobile-card-list";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import CreateChecklistModal from "@/components/create-checklist-modal";
import { ChecklistFormData } from "@/types/checklist";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { downloadCSV } from "@/lib/utils/file";
import { AccessButton } from "@/components/shared/access-button";
import { MenuItem } from "@/types";
import { Download, SquarePlus } from "lucide-react";

const columns = (
    onView: (row: ChecklistFormData) => void,
    onEdit: (row: ChecklistFormData) => void,
    onDelete: (row: ChecklistFormData) => void,
): Column<ChecklistFormData>[] => [
    {
        key: "eventName",
        header: "Event Name",
        render: row => row.eventName,
    },
    {
        key: "enquiryDate",
        header: "Enquiry Date",
        render: row => row.enquiryDate,
        className: "text-muted-foreground",
    },
    {
        key: "clientPoc",
        header: "Client POC",
        render: row => row.clientPoc,
        className: "text-muted-foreground",
    },
    {
        key: "status",
        header: "Status",
        render: row => {
            const s = String(row.status ?? "").toLowerCase();
            if (s === "in progress" || s === "in_progress" || s === "ongoing") {
                return (
                    <span className="inline-block rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400">
                        {row.status}
                    </span>
                );
            }
            if (s === "completed" || s === "done") {
                return (
                    <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900/40 dark:text-green-400">
                        {row.status}
                    </span>
                );
            }
            return (
                <span className="inline-block rounded-full bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700 dark:bg-gray-700/50 dark:text-gray-300">
                    {row.status ?? "Not Started"}
                </span>
            );
        },
    },
    {
        key: "gst",
        header: "GST",
        render: row => row.gst || "-",
        className: "text-muted-foreground",
    },
    {
        key: "actions",
        header: "",
        className: "text-right",
        render: row => {
            const items: MenuItem[] = [
                {
                    key: "view",
                    label: "View",
                    icon: <FileTextIcon size={16} />,
                    onClick: () => onView(row),
                },
                {
                    key: "edit",
                    label: "Edit",
                    icon: <PencilIcon size={16} />,
                    onClick: () => onEdit(row),
                    scopes: ["w:checklists"],
                },
                {
                    key: "delete",
                    label: "Delete",
                    icon: <TrashIcon size={16} />,
                    onClick: () => onDelete(row),
                    className: "text-destructive focus:text-destructive",
                    scopes: ["w:checklists"],
                },
            ];

            return (
                <div className="flex justify-center">
                    <MenuList
                        align="end"
                        items={items}
                        trigger={
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVerticalIcon size={16} />
                            </Button>
                        }
                    />
                </div>
            );
        },
    },
];

export default function ChecklistsPage() {
    const { request, loading } = useRequestApi<ChecklistFormData[]>();
    const [checklists, setChecklists] = useState<ChecklistFormData[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [_selectedChecklist, set_selectedChecklist] = useState<ChecklistFormData | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [checklistToDelete, setChecklistToDelete] = useState<ChecklistFormData | null>(null);

    const fetchChecklists = useCallback(async () => {
        try {
            const res = await request(API_ENDPOINTS.checklists.list, {
                method: "GET",
            });
            if (res !== null) {
                setChecklists(res);
            }
        } catch (_err) {
            toast.error("Failed to fetch checklists. Please try again.");
        }
    }, [request]);

    useEffect(() => {
        fetchChecklists();
    }, [fetchChecklists]);

    const handleCreate = () => {
        setModalOpen(true);
    };

    const handleView = (checklist: ChecklistFormData) => {
        set_selectedChecklist(checklist);
    };

    const handleEdit = (checklist: ChecklistFormData) => {
        set_selectedChecklist(checklist);
        setModalOpen(true);
    };

    const handleDeleteClick = (checklist: ChecklistFormData) => {
        setChecklistToDelete(checklist);
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!checklistToDelete || !checklistToDelete.id) return;
        try {
            await request(`${API_ENDPOINTS.checklists.detail(checklistToDelete.id)}`, {
                method: "DELETE",
            });

            toast.success("Checklist deleted successfully!");
            fetchChecklists();
        } catch {
            toast.error("Failed to delete checklist. Please try again.");
        } finally {
            setDeleteModalOpen(false);
            setChecklistToDelete(null);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteModalOpen(false);
        setChecklistToDelete(null);
    };

    const handleExport = () => {
        const exportData = checklists.map(checklist => ({
            "Event Name": checklist.eventName,
            "Enquiry Date": checklist.enquiryDate,
            "Client POC": checklist.clientPoc,
            Status: checklist.status,
            GST: checklist.gst,
        }));
        downloadCSV(exportData, "checklists-export.csv");
    };

    return (
        <div className="flex flex-col gap-6 sm:gap-8">
            <PageHeader
                title="Checklist Management"
                description="Manage all event checklists and their status"
                actions={
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
                        <Button
                            variant="ghost"
                            className="w-full sm:w-auto"
                            onClick={handleExport}
                            icon={<Download size={16} />}
                        >
                            Export
                        </Button>
                        <AccessButton
                            scope={["w:checklists"]}
                            className="w-full sm:w-auto"
                            onClick={handleCreate}
                            icon={<SquarePlus size={16} />}
                        >
                            Create Checklist
                        </AccessButton>
                    </div>
                }
            />
            <div className="flex flex-col gap-4 sm:gap-1">
                <div className="rounded-lg bg-surface p-4 sm:p-6 shadow-sm hidden md:block">
                    <DataTable
                        columns={columns(handleView, handleEdit, handleDeleteClick)}
                        data={checklists}
                        rowKey={row => String(row.id)}
                        emptyMessage="No checklists found."
                        hoverable
                        isLoading={loading}
                    />
                </div>
                <MobileCardList
                    className="flex flex-col gap-4 md:hidden"
                    items={checklists.map(checklist => ({
                        id: String(checklist.id),
                        data: checklist,
                    }))}
                    renderHeader={checklist => (
                        <div className="flex items-center justify-between">
                            <div className="font-bold text-lg">{checklist.eventName}</div>
                            <div className="text-xs text-muted-foreground">
                                {checklist.enquiryDate}
                            </div>
                        </div>
                    )}
                    renderContent={checklist => (
                        <>
                            <div className="mb-1">
                                Client POC:{" "}
                                <span className="font-medium">{checklist.clientPoc}</span>
                            </div>
                            <div className="mb-1">
                                Status:{" "}
                                <span className="font-medium">
                                    {checklist.status ?? "Not Started"}
                                </span>
                            </div>
                            <div className="mb-2">
                                GST: <span className="font-medium">{checklist.gst || "-"}</span>
                            </div>
                        </>
                    )}
                    renderActions={checklist => (
                        <div className="flex gap-2 justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleView(checklist)}
                            >
                                View
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteClick(checklist)}
                            >
                                Delete
                            </Button>
                        </div>
                    )}
                    emptyMessage="No checklists found."
                    isLoading={loading}
                />
                <CreateChecklistModal
                    open={modalOpen}
                    onClose={() => {
                        setModalOpen(false);
                        set_selectedChecklist(null);
                    }}
                    onSave={() => {
                        fetchChecklists();
                    }}
                />
                <ConfirmationModal
                    open={deleteModalOpen}
                    onClose={handleDeleteCancel}
                    onConfirm={handleDeleteConfirm}
                    title="Delete Checklist"
                    description={
                        checklistToDelete
                            ? `Are you sure you want to delete this checklist for "${checklistToDelete.eventName}"? This action cannot be undone.`
                            : undefined
                    }
                    confirmText="Delete"
                    cancelText="Cancel"
                />
            </div>
        </div>
    );
}
