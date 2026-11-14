"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

import { useRequestApi } from "@/hooks/useRequestApi";
import { useServerPagination } from "@/hooks/useServerPagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MenuList } from "@/components/ui";
import {
    MoreVerticalIcon,
    TrashIcon,
    FileTextIcon,
    PencilIcon,
    UserPlusIcon,
} from "@/components/ui/icons";
import CreateClientModal from "@/components/create-client-modal";
import { PageHeader } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { MobileCardList } from "@/components/shared/mobile-card-list";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { KeyValueDisplay } from "@/components/ui/key-value-display";
import { Client } from "@/types/client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { downloadCSV } from "@/lib/utils/file";
import { MenuItem } from "@/types";
import { AccessButton } from "@/components/shared/access-button";
import { DEFAULT_PAGE_SIZE } from "@/constants";
import { clientTypeOptions } from "@/constants/client";
import { apiRequest } from "@/lib/api/api-client";
import { Download, Search, RefreshCw } from "lucide-react";
import { buildQueryUrl } from "@/lib/api/query-params";

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

const clientTypeLabelMap: Record<string, string> = Object.fromEntries(
    clientTypeOptions.map(o => [o.value, o.label]),
);

const typeFilterOptions = [
    { label: "All Types", value: "" },
    ...clientTypeOptions,
];

const columns = (
    onView: (row: Client) => void,
    onEdit: (row: Client) => void,
    onDelete: (row: Client) => void,
): Column<Client>[] => [
    {
        key: "name",
        header: "Name",
        render: row => (
            <div className="flex items-center gap-3 min-w-0">
                <Avatar name={row.name || "-"} />
                <div className="flex min-w-0 flex-col">
                    <span className="max-w-[220px] truncate font-medium">{row.name}</span>
                    <span className="max-w-[220px] truncate text-xs text-muted-foreground">
                        {row.email}
                    </span>
                </div>
            </div>
        ),
    },
    {
        key: "phone",
        header: "Phone",
        render: row => <span className="whitespace-nowrap">{row.phone}</span>,
        className: "text-muted-foreground",
    },
    {
        key: "poc",
        header: "Point of Contact",
        render: row => (
            <span className="block max-w-[160px] truncate" title={row.poc}>
                {row.poc}
            </span>
        ),
        className: "text-muted-foreground",
    },
    {
        key: "clientType",
        header: "Type",
        render: row => (
            <Badge variant="info">{clientTypeLabelMap[row.clientType] ?? row.clientType ?? "-"}</Badge>
        ),
    },
    {
        key: "gst",
        header: "GST",
        render: row => (
            <span className="block max-w-[140px] truncate text-muted-foreground" title={row.gst || "-"}>
                {row.gst || "-"}
            </span>
        ),
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
                    scopes: ["w:clients"],
                },
                {
                    key: "delete",
                    label: "Delete",
                    icon: <TrashIcon size={16} />,
                    onClick: () => onDelete(row),
                    className: "text-destructive focus:text-destructive",
                    scopes: ["w:clients"],
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

export default function ClientsPage() {
    const { request, loading: requestLoading } = useRequestApi();
    const [modalOpen, setModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [typeFilter, setTypeFilter] = useState("");

    const {
        items: clients,
        total,
        totalPages,
        currentPage,
        pageSize,
        search,
        setSearch,
        loading,
        error,
        setPage,
        refetch,
        reset,
    } = useServerPagination<Client>({
        fetchPage: async ({ search: q, page, pageSize: size }) => {
            const url = buildQueryUrl(API_ENDPOINTS.clients.list, {
                page: page - 1,
                size,
                search: q,
            });
            const res = await apiRequest(url);
            if (!res.ok) {
                throw new Error(`Failed to fetch clients: ${res.statusText}`);
            }
            const data = await res.json();
            const items = Array.isArray(data) ? (data as Client[]) : [];
            return { items };
        },
        pageSize: PAGE_SIZE,
        filterSignature: JSON.stringify({ typeFilter }),
    });

    const errorShownRef = useRef(false);
    useEffect(() => {
        if (error && !errorShownRef.current) {
            errorShownRef.current = true;
            toast.error(error);
        }
        if (!error) {
            errorShownRef.current = false;
        }
    }, [error]);

    // The clients API returns a bare array (no total count), so `total` is 0.
    // Derive a best-effort item count for the pagination "Showing X-Y of Z" text:
    // the cumulative count of items seen up to and including the current page.
    const totalItems =
        total > 0
            ? total
            : clients.length > 0
                ? (currentPage - 1) * pageSize + clients.length
                : 0;

    const hasMore = currentPage < totalPages;

    const pagination = {
        currentPage,
        totalPages,
        pageSize,
        totalItems,
        itemName: "client",
        hasNextPage: hasMore,
        hasPreviousPage: currentPage > 1,
    };

    const emptyMessage =
        search && total === 0 ? "No clients match your search." : "No clients found.";

    const handleResetFilters = useCallback(() => {
        setSearch("");
        setTypeFilter("");
        setPage(1);
        reset();
    }, [setPage, reset]);

    const handleCreate = () => {
        setEditingClient(null);
        setModalOpen(true);
    };

    const handleEdit = (client: Client) => {
        setEditingClient(client);
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setEditingClient(null);
    };

    const handleView = (client: Client) => {
        setSelectedClient(client);
        setViewModalOpen(true);
    };

    const handleDeleteClick = (client: Client) => {
        setClientToDelete(client);
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!clientToDelete) return;
        setDeleting(true);
        try {
            await request(`${API_ENDPOINTS.clients.detail(clientToDelete.id)}`, {
                method: "DELETE",
            });

            toast.success("Client deleted successfully!");
            // Refresh the current page so the paginated backend list reflects
            // the deletion, even when the page number has not changed.
            await refetch();
        } catch {
            toast.error("Failed to delete client. Please try again.");
        } finally {
            setDeleting(false);
            setDeleteModalOpen(false);
            setClientToDelete(null);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteModalOpen(false);
        setClientToDelete(null);
    };

    const handleExport = () => {
        const exportData = clients.map(client => ({
            Name: client.name,
            Type: client.clientType || "",
            Email: client.email,
            Phone: client.phone,
            "Point of Contact": client.poc,
            Address: client.address,
            GST: client.gst,
            PAN: client.pan,
            "GST Certificate": client.gstCertificate,
        }));
        downloadCSV(exportData, "clients-export.csv");
    };

    return (
        <div className="flex flex-col gap-6 sm:gap-8">
            <PageHeader
                title="Client Management"
                description="Manage all clients and their contact information"
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
                            scope={["w:clients"]}
                            className="w-full sm:w-auto"
                            onClick={handleCreate}
                            icon={<UserPlusIcon size={16} />}
                        >
                            Create Client
                        </AccessButton>
                    </div>
                }
            />
            <div className="flex flex-col gap-4 sm:gap-1">
                <div className="rounded-lg bg-surface p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search by name, email, phone or POC..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="h-10 pl-9"
                            />
                        </div>
                        <div className="sm:w-[180px]">
                            <Select
                                options={typeFilterOptions}
                                value={
                                    typeFilterOptions.find(o => o.value === typeFilter) || null
                                }
                                onChange={option => setTypeFilter(option?.value || "")}
                                placeholder="All Types"
                                isClearable={false}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                            title="Reset Filters"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                <div className="rounded-lg bg-surface p-4 sm:p-6 shadow-sm hidden md:block">
                    <DataTable
                        columns={columns(handleView, handleEdit, handleDeleteClick)}
                        data={clients}
                        rowKey={row => row.id}
                        emptyMessage={emptyMessage}
                        hoverable
                        pagination={pagination}
                        onPageChange={setPage}
                        isLoading={loading || requestLoading || deleting}
                    />
                </div>
                <MobileCardList
                    className="flex flex-col gap-4 md:hidden"
                    items={clients.map(client => ({ id: client.id, data: client }))}
                    renderHeader={client => (
                        <div className="flex items-center gap-3">
                            <Avatar name={client.name || "-"} />
                            <div className="min-w-0 flex-1">
                                <div className="truncate font-bold text-base">{client.name}</div>
                                <div className="truncate text-xs text-muted-foreground">
                                    {client.email}
                                </div>
                            </div>
                        </div>
                    )}
                    renderContent={client => (
                        <>
                            <div className="mb-1">
                                Phone: <span className="font-medium">{client.phone}</span>
                            </div>
                            <div className="mb-1">
                                POC: <span className="font-medium">{client.poc}</span>
                            </div>
                            <div className="mb-1">
                                GST: <span className="font-medium">{client.gst || "-"}</span>
                            </div>
                            <div className="mb-2">
                                Address: <span className="font-medium">{client.address}</span>
                            </div>
                        </>
                    )}
                    renderActions={client => (
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => handleView(client)}>
                                View
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleEdit(client)}>
                                Edit
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteClick(client)}
                            >
                                Delete
                            </Button>
                        </div>
                    )}
                    emptyMessage={emptyMessage}
                    pagination={pagination}
                    onPageChange={setPage}
                    isLoading={loading || requestLoading || deleting}
                />
                <CreateClientModal
                    key={editingClient?.id ?? "create"}
                    open={modalOpen}
                    onClose={handleCloseModal}
                    onSuccess={name => {
                        const searchUnchanged = search === name;
                        setSearch(name);
                        setTypeFilter("");
                        if (searchUnchanged) refetch();
                    }}
                    editData={editingClient}
                    mode={editingClient ? "edit" : "create"}
                />
                <ConfirmationModal
                    open={deleteModalOpen}
                    onClose={handleDeleteCancel}
                    onConfirm={handleDeleteConfirm}
                    title="Delete Client"
                    description={
                        clientToDelete
                            ? `Are you sure you want to delete "${clientToDelete.name}"? This action cannot be undone.`
                            : undefined
                    }
                    confirmText={deleting ? "Deleting..." : "Delete"}
                    cancelText="Cancel"
                    isLoading={deleting}
                />
                {/* View Client Modal */}
                <Modal
                    open={viewModalOpen}
                    onClose={() => {
                        setViewModalOpen(false);
                        setSelectedClient(null);
                    }}
                    title="Client Details"
                    size="xl"
                >
                    <ModalBody>
                        {selectedClient && (
                            <KeyValueDisplay
                                items={[
                                    { key: "Name", value: selectedClient.name },
                                    { key: "Type", value: selectedClient.clientType || "-" },
                                    { key: "Email", value: selectedClient.email },
                                    { key: "Phone", value: selectedClient.phone },
                                    { key: "Point of Contact", value: selectedClient.poc },
                                    { key: "Address", value: selectedClient.address },
                                    { key: "GST Number", value: selectedClient.gst || "-" },
                                    { key: "PAN Number", value: selectedClient.pan || "-" },
                                    {
                                        key: "GST Certificate",
                                        value: selectedClient.gstCertificate || "-",
                                    },
                                ]}
                                columns={2}
                            />
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setViewModalOpen(false);
                                setSelectedClient(null);
                            }}
                        >
                            Close
                        </Button>
                    </ModalFooter>
                </Modal>
            </div>
        </div>
    );
}
