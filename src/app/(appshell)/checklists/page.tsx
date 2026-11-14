"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { Inventory } from "@/types/inventory";
import { apiRequest } from "@/lib/api/api-client";
import { ExecutionChecklistModal } from "@/components/checklist-modal";
import { fetchVendors } from "@/lib/api/vendor";
import type { Vendor } from "@/types/vendor";
import { useRequestApi } from "@/hooks/useRequestApi";
import { Button } from "@/components/ui/button";
import { CheckSquareIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { MobileCardList } from "@/components/shared/mobile-card-list";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import CreateChecklistModal from "@/components/create-checklist-modal";
import type { ChecklistFormData, EventItem, EventDetails } from "@/types/checklist";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { downloadCSV } from "@/lib/utils/file";
import { Download } from "lucide-react";

type ChecklistRow = ChecklistFormData & {
    location?: string;
    assignee?: string | null;
    startDate?: string;
    endDate?: string;
};

type ChecklistEvent = Omit<EventItem, "client"> & {
    client?: string | { name?: string };
    checklistAssignedTo?: string | null;
    startDate?: string;
    endDate?: string;
    location?: string;
    venue?: string;
};

const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "-";
        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    } catch {
        return "-";
    }
};

const columns = (onView: (row: ChecklistRow) => void): Column<ChecklistRow>[] => [
    {
        key: "eventName",
        header: "Event Name",
        render: row => (
            <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                    <CheckSquareIcon size={18} />
                </div>
                <div className="min-w-0">
                    <button
                        type="button"
                        onClick={() => onView(row)}
                        className="text-left font-medium text-primary transition-colors hover:text-primary-hover hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                    >
                        {row.eventName}
                    </button>
                    <p className="truncate text-xs text-muted-foreground">
                        {row.location || "Location not specified"}
                    </p>
                </div>
            </div>
        ),
    },
    {
        key: "clientPoc",
        header: "Client",
        render: row => row.clientPoc,
        className: "text-muted-foreground",
    },
    // {
    //     key: "assignee",
    //     header: "Assignee",
    //     render: row => row.assignee || "-",
    //     className: "text-muted-foreground",
    // },
    {
        key: "startDate",
        header: "Start Date",
        render: row => formatDateTime(row.startDate),
        className: "text-muted-foreground",
    },
    {
        key: "endDate",
        header: "End Date",
        render: row => formatDateTime(row.endDate),
        className: "text-muted-foreground",
    },
];

export interface EventChecklistItem {
    item: string;
    inventoryID?: string;
    startDate?: string | null;
    endDate?: string | null;
    quantity?: number;
    pricePerItem?: number;
    deadlineDate?: string | null;
    itemStatus?: boolean;
    finalAmt?: number;
    category?: string;
    status?: string;
    unit?: string;
    subCategory?: string;
    description?: string;
    vendor?: string;
    days?: number;
}
export default function ChecklistsPage() {
    const { request, loading } = useRequestApi<ChecklistEvent[]>();
    const { request: requestEventDetails, loading: loadingEventDetails } =
        useRequestApi<EventDetails>();
    const [checklists, setChecklists] = useState<ChecklistRow[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [_selectedChecklist, set_selectedChecklist] = useState<ChecklistFormData | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [checklistToDelete, setChecklistToDelete] = useState<ChecklistFormData | null>(null);
    const [checklistModalOpen, setChecklistModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<EventDetails | null>(null);
    const [vendorList, setVendorList] = useState<Vendor[]>([]);
    const [loadingVendors, setLoadingVendors] = useState(false);
    const [inventoryList, setInventoryList] = useState<Inventory[]>([]);
    const [loadingInventory, setLoadingInventory] = useState(false);
    // const fetchChecklists = useCallback(async () => {
    //     try {
    //         const res = await request(API_ENDPOINTS.checklists.list, {
    //             method: "GET",
    //         });
    //         if (res !== null) {
    //             setChecklists(res);
    //         }
    //     } catch (_err) {
    //         toast.error("Failed to fetch checklists. Please try again.");
    //     }
    // }, [request]);

    const fetchChecklists = useCallback(async () => {
        try {
            const res = await request(API_ENDPOINTS.events.list, {
                method: "GET",
            });

            if (res) {
                const checklistData: ChecklistRow[] = res.map(event => ({
                    id: event.eventID,
                    eventName: event.title,
                    enquiryDate: event.enquiryDate || "",
                    clientPoc:
                        typeof event.client === "string" ? event.client : event.client?.name || "-",
                    status: event.status || "Not Started",
                    gst: String(event.gst ?? ""),
                    location: event.location || event.venue,
                    assignee: event.checklistAssignedTo || "",
                    startDate: event.startDate || event.eventStartDate || "",
                    endDate: event.endDate || event.eventEndDate || "",
                }));

                setChecklists(checklistData);
            } else {
                setChecklists([]);
            }
        } catch (error) {
            console.error("Error fetching events:", error);
            toast.error("Failed to load checklist data");
        }
    }, [request]);
    useEffect(() => {
        fetchChecklists();
    }, [fetchChecklists]);

    const handleCreate = () => {
        setModalOpen(true);
    };

    const handleView = async (checklist: ChecklistRow) => {
        try {
            if (!checklist.id) {
                toast.error("Event ID not found");
                return;
            }

            const eventDetails = await requestEventDetails(
                API_ENDPOINTS.events.detail(String(checklist.id)),
                {
                    method: "GET",
                },
            );

            if (eventDetails) {
                setSelectedEvent(eventDetails);
                setChecklistModalOpen(true);
            } else {
                toast.error("Failed to load event details");
            }
        } catch (error) {
            console.error("Error fetching event details:", error);
            toast.error("Failed to load event details");
        }
    };

    const fetchInventory = useCallback(async () => {
        setLoadingInventory(true);

        try {
            const res = await apiRequest("/api/inventory");

            if (!res.ok) {
                throw new Error("Failed to fetch inventory");
            }

            const data: Inventory[] = await res.json();
            setInventoryList(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching inventory:", error);
            setInventoryList([]);
        } finally {
            setLoadingInventory(false);
        }
    }, []);

    const handleEdit = (checklist: ChecklistRow) => {
        set_selectedChecklist(checklist);
        setModalOpen(true);
    };
    const loadVendors = useCallback(async () => {
        setLoadingVendors(true);

        try {
            const vendors = await fetchVendors();
            setVendorList(vendors);
        } catch (error) {
            console.error("Error fetching vendors:", error);
            toast.error("Failed to load vendors");
        } finally {
            setLoadingVendors(false);
        }
    }, []);

    useEffect(() => {
        loadVendors();
        fetchInventory();
    }, [loadVendors, fetchInventory]);

    const handleDeleteClick = (checklist: ChecklistRow) => {
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
            "Client POC": checklist.clientPoc,
            Assignee: checklist.assignee || "",
            "Start Date": formatDateTime(checklist.startDate),
            "End Date": formatDateTime(checklist.endDate),
        }));
        downloadCSV(exportData, "checklists-export.csv");
    };

    return (
        <div className="flex flex-col gap-6 sm:gap-8">
            <PageHeader
                title="Checklist Management"
                description="Manage event checklists, assignees, and schedules"
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
                        {/* <AccessButton
                            scope={["w:checklists"]}
                            className="w-full sm:w-auto"
                            onClick={handleCreate}
                            icon={<SquarePlus size={16} />}
                        >
                            Create Checklist
                        </AccessButton> */}
                    </div>
                }
            />
            <div className="flex flex-col gap-4 sm:gap-1">
                <div className="rounded-lg bg-surface p-4 sm:p-6 shadow-sm hidden md:block">
                    <DataTable
                        columns={columns(handleView)}
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
                            <button
                                type="button"
                                onClick={() => handleView(checklist)}
                                className="text-left text-lg font-bold text-primary hover:underline"
                            >
                                {checklist.eventName}
                            </button>
                        </div>
                    )}
                    renderContent={checklist => (
                        <>
                            <div className="mb-1">
                                Client POC:{" "}
                                <span className="font-medium">{checklist.clientPoc}</span>
                            </div>
                            <div className="mb-1">
                                Assignee:{" "}
                                <span className="font-medium">{checklist.assignee || "-"}</span>
                            </div>
                            <div className="mb-1">
                                Start Date:{" "}
                                <span className="font-medium">
                                    {formatDateTime(checklist.startDate)}
                                </span>
                            </div>
                            <div className="mb-2">
                                End Date:{" "}
                                <span className="font-medium">
                                    {formatDateTime(checklist.endDate)}
                                </span>
                            </div>
                        </>
                    )}
                    renderActions={checklist => (
                        <div className="flex gap-2 justify-end">
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
                {selectedEvent && (
                    <ExecutionChecklistModal
                        isOpen={checklistModalOpen}
                        onClose={() => {
                            setChecklistModalOpen(false);
                            setSelectedEvent(null);
                        }}
                        eventData={selectedEvent}
                        onSave={() => {
                            fetchChecklists();
                        }}
                        vendorList={vendorList}
                        loadingVendors={loadingVendors}
                        inventoryList={inventoryList}
                        loadingInventory={loadingInventory}
                    />
                )}
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
