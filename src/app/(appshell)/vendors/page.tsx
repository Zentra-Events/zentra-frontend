"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MenuList } from "@/components/ui";
import { MoreVerticalIcon, TrashIcon, FileTextIcon, StorePlusIcon, PencilIcon } from "@/components/ui/icons";
import CreateVendorModal from "@/components/create-vendor-modal";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api/api-client";
import { PageHeader } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { MobileCardList } from "@/components/shared/mobile-card-list";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { KeyValueDisplay } from "@/components/ui/key-value-display";
import { Table, Column as TableColumn } from "@/components/ui/table";
import { downloadCSV } from "@/lib/utils/file";
import { AccessButton } from "@/components/shared/access-button";
import { MenuItem } from "@/types";
import { Download } from "lucide-react";

type VendorItem = {
    item: string;
    count: number;
    pricePerItem: number;
    description?: string;
};

type Vendor = {
    id: string;
    name: string;
    billingAddress: string;
    gst: number;
    tds: number;
    gstCertificate?: string;
    phone: string;
    items?: VendorItem[];
};

const vendorItemColumns: TableColumn<VendorItem>[] = [
    { key: "item", header: "Item" },
    {
        key: "count",
        header: "Count",
        align: "right",
    },
    {
        key: "pricePerItem",
        header: "Price per Item",
        align: "right",
        render: item => `₹${item.pricePerItem.toFixed(2)}`,
    },
    {
        key: "description",
        header: "Description",
        render: item => item.description || "-",
        maxWidth: "200px",
    },
];

const columns = (
    onView: (row: Vendor) => void,
    onEdit: (row: Vendor) => void,
    onDelete: (row: Vendor) => void,
): Column<Vendor>[] => [
    {
        key: "name",
        header: "Name",
        render: row => row.name,
    },
    {
        key: "phone",
        header: "Phone",
        render: row => row.phone,
        className: "text-muted-foreground",
    },
    {
        key: "billingAddress",
        header: "Billing Address",
        render: row => row.billingAddress,
        className: "text-muted-foreground",
    },
    {
        key: "gst",
        header: "GST",
        render: row => `${row.gst}%`,
        className: "text-muted-foreground",
    },
    {
        key: "tds",
        header: "TDS",
        render: row => `${row.tds}%`,
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
                    scopes: ["w:vendors"],
                },
                {
                    key: "delete",
                    label: "Delete",
                    icon: <TrashIcon size={16} />,
                    onClick: () => onDelete(row),
                    className: "text-destructive focus:text-destructive",
                    scopes: ["w:vendors"],
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

export default function VendorsPage() {
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
    const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchVendors = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiRequest("/api/vendors");
            if (!res.ok) {
                throw new Error(`Failed to fetch vendors: ${res.status}`);
            }
            const data = await res.json();
            setVendors(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Error fetching vendors:", err);
            setVendors([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchVendors();
    }, [fetchVendors]);

    const openCreateModal = () => {
        setIsModalOpen(true);
        setEditingVendor(null);
    };

    const openEditModal = (vendor: Vendor) => {
        setEditingVendor(vendor);
        setIsModalOpen(true);
    };

    const handleView = (vendor: Vendor) => {
        setSelectedVendor(vendor);
        setViewModalOpen(true);
    };

    const handleDeleteClick = (vendor: Vendor) => {
        setVendorToDelete(vendor);
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!vendorToDelete) return;
        setDeleting(true);
        try {
            const res = await apiRequest(`/api/vendors/${vendorToDelete.id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                await fetchVendors();
                toast.success("Vendor deleted successfully!");
            } else {
                const errText = await res.text().catch(() => "");
                throw new Error(`Failed to delete vendor: ${res.status} ${errText}`);
            }
        } catch (_error) {
            toast.error("Failed to delete vendor. Please try again.");
        } finally {
            setDeleting(false);
            setDeleteModalOpen(false);
            setVendorToDelete(null);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteModalOpen(false);
        setVendorToDelete(null);
    };

    const handleVendorSaved = async () => {
        await fetchVendors();
    };

    const handleExport = () => {
        const exportData = vendors.map(vendor => ({
            Name: vendor.name,
            Phone: vendor.phone,
            "Billing Address": vendor.billingAddress,
            GST: `${vendor.gst}%`,
            TDS: `${vendor.tds}%`,
            "GST Certificate": vendor.gstCertificate || "-",
        }));
        downloadCSV(exportData, "vendors-export.csv");
    };

    return (
        <div className="flex flex-col gap-6 sm:gap-8">
            <PageHeader
                title="Vendor Management"
                description={`Manage all vendors and their contact information.`}
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
                            scope={["w:vendors"]}
                            className="w-full sm:w-auto"
                            onClick={openCreateModal}
                            icon={<StorePlusIcon size={16} />}
                        >
                            Create Vendor
                        </AccessButton>
                    </div>
                }
            />
            <div className="flex flex-col gap-4 sm:gap-1">
                <div className="rounded-lg bg-surface p-4 sm:p-6 shadow-sm hidden md:block">
                    <DataTable
                        columns={columns(handleView, openEditModal, handleDeleteClick)}
                        data={vendors}
                        rowKey={row => row.id}
                        emptyMessage="No vendors found."
                        hoverable
                        isLoading={loading}
                    />
                </div>
                <MobileCardList
                    className="flex flex-col gap-4 md:hidden"
                    items={vendors.map(vendor => ({ id: vendor.id, data: vendor }))}
                    renderHeader={vendor => (
                        <div className="flex items-center justify-between">
                            <div className="font-bold text-lg">{vendor.name}</div>
                            <div className="text-xs text-muted-foreground">{vendor.phone}</div>
                        </div>
                    )}
                    renderContent={vendor => (
                        <>
                            <div className="mb-1">
                                Billing Address:{" "}
                                <span className="font-medium">{vendor.billingAddress}</span>
                            </div>
                            <div className="mb-1">
                                GST: <span className="font-medium">{vendor.gst}%</span>
                            </div>
                            <div className="mb-1">
                                TDS: <span className="font-medium">{vendor.tds}%</span>
                            </div>
                            <div className="mb-2">
                                GST Certificate:{" "}
                                <span className="font-medium">{vendor.gstCertificate || "-"}</span>
                            </div>
                        </>
                    )}
                    renderActions={vendor => (
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" onClick={() => handleView(vendor)}>
                                View
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditModal(vendor)}
                            >
                                Edit
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteClick(vendor)}
                            >
                                Delete
                            </Button>
                        </div>
                    )}
                    emptyMessage="No vendors found."
                    isLoading={loading}
                />
                <ConfirmationModal
                    open={deleteModalOpen}
                    onClose={handleDeleteCancel}
                    onConfirm={handleDeleteConfirm}
                    title="Delete Vendor"
                    description={
                        vendorToDelete
                            ? `Are you sure you want to delete "${vendorToDelete.name}"? This action cannot be undone.`
                            : undefined
                    }
                    confirmText={deleting ? "Deleting..." : "Delete"}
                    cancelText="Cancel"
                    isLoading={deleting}
                />
                {/* View Vendor Modal */}
                <Modal
                    open={viewModalOpen}
                    onClose={() => {
                        setViewModalOpen(false);
                        setSelectedVendor(null);
                    }}
                    title="Vendor Details"
                    size="xl"
                >
                    <ModalBody>
                        {selectedVendor && (
                            <div className="space-y-4">
                                <KeyValueDisplay
                                    columns={2}
                                    items={[
                                        { key: "Name", value: selectedVendor.name },
                                        { key: "Phone", value: selectedVendor.phone },
                                        {
                                            key: "Billing Address",
                                            value: selectedVendor.billingAddress,
                                        },
                                        { key: "GST", value: `${selectedVendor.gst}%` },
                                        { key: "TDS", value: `${selectedVendor.tds}%` },
                                        {
                                            key: "GST Certificate",
                                            value: selectedVendor.gstCertificate || "-",
                                        },
                                    ]}
                                />
                                {selectedVendor.items && selectedVendor.items.length > 0 && (
                                    <div className="border-t border-border pt-4">
                                        <h3 className="text-sm font-semibold text-foreground mb-3">
                                            Vendor Items
                                        </h3>
                                        <Table
                                            data={selectedVendor.items}
                                            columns={vendorItemColumns}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setViewModalOpen(false);
                                setSelectedVendor(null);
                            }}
                        >
                            Close
                        </Button>
                    </ModalFooter>
                </Modal>
                {/* Create / Edit Vendor Modal */}
                <CreateVendorModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setEditingVendor(null);
                    }}
                    onSubmit={handleVendorSaved}
                    mode={editingVendor ? "edit" : "create"}
                    vendor={editingVendor}
                />
            </div>
        </div>
    );
}
