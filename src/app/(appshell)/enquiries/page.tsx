"use client";

import { useState, useEffect, useCallback } from "react";
import { useFormik } from "formik";
import { toast } from "sonner";

import { useRequestApi } from "@/hooks/useRequestApi";
import { Button } from "@/components/ui/button";
import { Badge, PageHeader } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { MobileCardList } from "@/components/shared/mobile-card-list";
import CreateEnquiryModal from "@/components/create-enquiry-modal";
import { EnquiriesTableFilters } from "@/components/enquiries-table-filters";
import { EnquiryViewModal } from "@/components/enquiry-view-modal";
import { Enquiry, EnquiryFormData, EnquiriesTableFiltersFormValues } from "@/types/enquiry";
import { DEFAULT_PAGE_SIZE } from "@/constants";
import { APIResponse } from "@/types";
import { usePagination } from "@/hooks/usePagination";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { downloadCSV } from "@/lib/utils/file";
import { formatScheduleRange, formatShortDate } from "@/lib/utils/date";
import { buildQueryUrl } from "@/lib/api/query-params";
import { AccessButton } from "@/components/shared/access-button";
import { Download, MessageSquarePlus } from "lucide-react";

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

const enquiryFiltersInitialValues: EnquiriesTableFiltersFormValues = {
    search: "",
    status: "",
    sortBy: "enquiryDate",
    sortOrder: "desc",
};

const columns = (onView: (enquiry: Enquiry) => void): Column<Enquiry>[] => [
    {
        key: "eventName",
        header: "Event Details",
        render: row => (
            <div>
                <div className="font-medium text-primary">{row.eventName || "-"}</div>
                <div className="text-xs text-gray-500 mt-1">ID: {row.eventID ?? "N/A"}</div>
                <div className="mt-1">
                    <Badge variant="info">{row.eventType || "Unknown"}</Badge>
                </div>
            </div>
        ),
    },
    {
        key: "client",
        header: "Client",
        render: row => (
            <div>
                <div className="font-medium text-gray-900">{row.clientName || row.client}</div>
                {(row.poc || row.enquiryPoCNumber) && (
                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                        {row.poc && <div>POC: {row.poc}</div>}
                        {row.enquiryPoCNumber && <div>Ph: {row.enquiryPoCNumber}</div>}
                    </div>
                )}
            </div>
        ),
    },
    {
        key: "schedule",
        header: "Schedule",
        render: row => (
            <div className="space-y-2">
                <div>
                    <div className="text-xs text-gray-500">Created</div>
                    <div className="text-sm">{row.date ? formatShortDate(row.date) : "-"}</div>
                </div>
                {(row.fromDate || row.toDate) && (
                    <div>
                        <div className="text-xs text-gray-500">Event</div>
                        <div className="text-xs">
                            {formatScheduleRange(row.fromDate, row.toDate)}
                        </div>
                    </div>
                )}
            </div>
        ),
    },
    {
        key: "location",
        header: "Location",
        render: row => (
            <div>
                <div className="text-sm font-medium">{row.venue || "-"}</div>
                {row.location && <div className="text-xs text-gray-500 mt-1">{row.location}</div>}
            </div>
        ),
    },
    {
        key: "team",
        header: "Team",
        render: row => (
            <div className="space-y-1 text-xs">
                <div>
                    <span className="text-gray-500">Assigned:</span> {row.assignee || "-"}
                </div>
                {row.enquiryPoC && (
                    <div>
                        <span className="text-gray-500">Enq POC:</span> {row.enquiryPoC}
                    </div>
                )}
                {row.eventPoC && (
                    <div>
                        <span className="text-gray-500">Evt POC:</span> {row.eventPoC}
                        {row.eventPoCNumber && (
                            <span className="text-gray-400"> ({row.eventPoCNumber})</span>
                        )}
                    </div>
                )}
            </div>
        ),
    },
    {
        key: "requirements",
        header: "Requirements",
        render: row => (
            <div
                className="truncate text-sm text-gray-600 max-w-xs"
                title={row.highlvelRequirement}
            >
                {row.highlvelRequirement || "-"}
            </div>
        ),
    },
];

export default function EnquiriesPage() {
    const { request, loading } = useRequestApi<APIResponse<Enquiry[]>>();
    const [result, setResult] = useState<APIResponse<Enquiry[]>>();
    const [modalOpen, setModalOpen] = useState(false);
    const [editEnquiry, setEditEnquiry] = useState<EnquiryFormData | null>(null);
    const [modalMode, setModalMode] = useState<"create" | "edit">("create");
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);

    const enquiries = result?.content || [];
    const totalElements = result?.totalElements || 0;
    const totalPages = result?.totalPages || 1;

    const { currentPage, handlePageChange, pagination, setCurrentPage } = usePagination({
        totalPages,
        pageSize: PAGE_SIZE,
        totalElements,
        itemName: "enquiry",
    });

    const formik = useFormik<EnquiriesTableFiltersFormValues>({
        initialValues: enquiryFiltersInitialValues,
        onSubmit: () => {
            setCurrentPage(1);
        },
    });
    const { values } = formik;

    const handleResetFilters = useCallback(() => {
        formik.resetForm();
        setCurrentPage(1);
    }, [formik, setCurrentPage]);

    const fetchEnquiries = useCallback(async () => {
        try {
            const url = buildQueryUrl(API_ENDPOINTS.enquiries.list, {
                page: currentPage - 1,
                size: PAGE_SIZE,
                status: values.status || "ENQUIRY_CREATED",
                search: values.search,
                sortBy: values.sortBy,
                direction: values.sortOrder,
            });
            const res = await request(url, {
                method: "GET",
            });
            if (res !== null) {
                setResult(res);
            }
        } catch (_err) {
            toast.error("Failed to fetch enquiries. Please try again.");
        }
    }, [request, currentPage, values.search, values.status, values.sortBy, values.sortOrder]);

    useEffect(() => {
        fetchEnquiries();
    }, [fetchEnquiries]);

    useEffect(() => {
        formik.submitForm();
    }, [values.search, values.status, values.sortBy, values.sortOrder]);

    const handleCreate = () => {
        setEditEnquiry(null);
        setModalMode("create");
        setModalOpen(true);
    };

    const handleEdit = (enquiry: Enquiry) => {
        setModalMode("edit");
        // NOTE: `enquiry.client` holds the client NAME (that is what the create flow
        // posts), while the form's `client` field expects the client ID. Keep both so
        // the modal can resolve the ID against the clients list and still fall back to
        // the name when the client is not found.
        const clientId = enquiry.clientID || "";
        const clientDisplayName = enquiry.clientName || enquiry.client || "";
        const editData: EnquiryFormData = {
            id: enquiry.id,
            highlvelRequirement: enquiry.highlvelRequirement || "",
            enquiryDate: enquiry.enquiryDate || enquiry.date || "",
            fromDate: enquiry.fromDate || "",
            toDate: enquiry.toDate || "",
            venue: enquiry.venue || "",
            location: enquiry.location || "",
            clientPoC: enquiry.clientPoC || enquiry.poc || "",
            enquiryPoCNumber: enquiry.enquiryPoCNumber || "",
            client: clientId,
            clientName: clientDisplayName,
            eventType: (enquiry.eventType as "PERSONAL" | "CORPORATE" | "OTHER") || "CORPORATE",
            eventPoC: enquiry.eventPoC || "",
            title: enquiry.eventName || "",
            enquiryPoC: enquiry.enquiryPoC || "",
            eventPoCNumber: enquiry.eventPoCNumber || "",
            assignedTo:
                enquiry.assignedTo && enquiry.assignedTo !== "Unassigned"
                    ? enquiry.assignedTo
                    : enquiry.assignee && enquiry.assignee !== "Unassigned"
                      ? enquiry.assignee
                      : "",
        };
        setEditEnquiry(editData);
        setModalOpen(true);
    };

    const handleView = (enquiry: Enquiry) => {
        setSelectedEnquiry(enquiry);
        setViewModalOpen(true);
    };

    const handleEditFromView = (enquiry: Enquiry) => {
        setSelectedEnquiry(null);
        handleEdit(enquiry);
    };

    const handleExport = () => {
        const exportData = enquiries.map(enquiry => ({
            "Event Name": enquiry.eventName || "-",
            Client: enquiry.clientName || enquiry.client,
            Date: enquiry.date,
            POC: enquiry.poc,
            Status: enquiry.status,
            Assignee: enquiry.assignee,
            Location: enquiry.venue || enquiry.location || "-",
        }));
        downloadCSV(exportData, "enquiries-export.csv");
    };

    const handleViewModalClose = () => {
        setViewModalOpen(false);
        setSelectedEnquiry(null);
        // Refresh list in case of delete/clone
        fetchEnquiries();
    };

    return (
        <div className="flex flex-col gap-6 sm:gap-8">
            <PageHeader
                title="Enquiry Management"
                description={`Manage all enquiries. You have ${totalElements} ${totalElements === 1 ? "enquiry" : "enquiries"}`}
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
                            scope={["w:enquiries"]}
                            className="w-full sm:w-auto"
                            onClick={handleCreate}
                            icon={<MessageSquarePlus size={16} />}
                        >
                            Create Enquiry
                        </AccessButton>
                    </div>
                }
            />
            <div className="flex flex-col gap-4 sm:gap-1">
                <EnquiriesTableFilters formik={formik} onReset={handleResetFilters} />
                <div className="rounded-lg bg-surface p-4 sm:p-6 shadow-sm hidden md:block">
                    <DataTable
                        columns={columns(handleView)}
                        data={enquiries}
                        rowKey={row => String(row.id)}
                        emptyMessage="No enquiries found."
                        hoverable
                        pagination={pagination}
                        onPageChange={handlePageChange}
                        isLoading={loading}
                        onRowClick={handleView}
                    />
                </div>
                <MobileCardList
                    className="flex flex-col gap-4 md:hidden"
                    items={enquiries.map(enquiry => ({ id: String(enquiry.id), data: enquiry }))}
                    renderHeader={enquiry => (
                        <div className="flex items-center justify-between">
                            <div className="font-bold text-lg">{enquiry.eventName || "-"}</div>
                            <div className="text-xs text-muted-foreground">{enquiry.status}</div>
                        </div>
                    )}
                    renderContent={enquiry => (
                        <>
                            <div className="mb-1">
                                Client:{" "}
                                <span className="font-medium">
                                    {enquiry.clientName || enquiry.client}
                                </span>
                            </div>
                            <div className="mb-1">
                                Date:{" "}
                                <span className="font-medium">
                                    {enquiry.date ? formatShortDate(enquiry.date) : "-"}
                                </span>
                            </div>
                            <div className="mb-2">
                                Assignee: <span className="font-medium">{enquiry.assignee}</span>
                            </div>
                        </>
                    )}
                    renderActions={enquiry => (
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => handleView(enquiry)}>
                                View
                            </Button>
                        </div>
                    )}
                    emptyMessage="No enquiries found."
                    pagination={pagination}
                    onPageChange={handlePageChange}
                    isLoading={loading}
                />
                <CreateEnquiryModal
                    isOpen={modalOpen}
                    onClose={() => {
                        setModalOpen(false);
                        setEditEnquiry(null);
                        setModalMode("create");
                    }}
                    onSubmit={fetchEnquiries}
                    editData={editEnquiry}
                    mode={modalMode}
                    onSaveSuccess={enquiry => {
                        // Re-fetch to get updated data, then open view modal
                        fetchEnquiries().then(() => {
                            setSelectedEnquiry(enquiry);
                            setViewModalOpen(true);
                        });
                    }}
                />
            </div>

            <EnquiryViewModal
                open={viewModalOpen}
                onClose={handleViewModalClose}
                enquiry={selectedEnquiry}
                onEdit={handleEditFromView}
            />
        </div>
    );
}
