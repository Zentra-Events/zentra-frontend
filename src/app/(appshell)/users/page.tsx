"use client";
import { useState, useEffect, useCallback } from "react";
import { useFormik } from "formik";
import { toast } from "sonner";

import { useRequestApi } from "@/hooks/useRequestApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MenuList } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { MoreVerticalIcon, PencilIcon, TrashIcon, UserPlusIcon } from "@/components/ui/icons";
import CreateUserModal from "@/components/create-user-modal";
import { PageHeader } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { MobileCardList } from "@/components/shared/mobile-card-list";
import { UsersTableFilters } from "@/components/users-table-filters";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import { User, UsersTableFiltersFormValues } from "@/types/user";
import { DEFAULT_PAGE_SIZE } from "@/constants";
import { APIResponse, MenuItem } from "@/types";
import { usePagination } from "@/hooks/usePagination";
import { downloadCSV } from "@/lib/utils/file";
import { buildQueryUrl } from "@/lib/api/query-params";
import { userFiltersInitialValues, rolesLabelMap, statusLabelMap } from "@/constants/user";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { useAuth } from "@/context/auth";
import { AccessButton } from "@/components/shared/access-button";
import { Download } from "lucide-react";

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

const columns = (onEdit: (user: User) => void, onDelete: (row: User) => void, canEdit: boolean = false): Column<User>[] => [
    {
        key: "name",
        header: "Name",
        render: row => (
            <div className="flex items-center gap-3">
                <Avatar name={row.name} />
                <div className="flex flex-col">
                    <span className="font-medium">{row.name}</span>
                    <span className="text-xs text-muted-foreground">{row.email}</span>
                </div>
            </div>
        ),
    },
    {
        key: "username",
        header: "Username",
        render: row => row.uid,
        className: "text-muted-foreground",
    },
    {
        key: "role",
        header: "Role",
        render: row => {
            const role = row.role.toLowerCase();
            return <Badge variant="info">{rolesLabelMap[role] ?? row.role}</Badge>;
        },
    },
    {
        key: "status",
        header: "Status",
        render: row => {
            const isActive = row.status === "active";
            return (
                <Badge variant={isActive ? "success" : "default"}>
                    <span
                        className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                            isActive ? "bg-success" : "bg-muted-foreground"
                        }`}
                    />
                    {isActive ? statusLabelMap.active : statusLabelMap.active}
                </Badge>
            );
        },
        className: "text-muted-foreground",
    },
    {
        key: "phone",
        header: "Phone Number",
        render: row => row.phone,
        className: "text-muted-foreground",
    },
    {
        key: "actions",
        header: "",
        className: "text-right",
        render: row => {
            const items: MenuItem[] = [];
            if (canEdit) {
                items.push({
                    key: "edit",
                    label: "Edit",
                    icon: <PencilIcon size={16} />,
                    onClick: () => onEdit(row),
                    scopes: ["w:users"],
                });
            }
            items.push({
                key: "delete",
                label: "Delete",
                icon: <TrashIcon size={16} />,
                onClick: () => onDelete(row),
                className: "text-destructive focus:text-destructive",
                scopes: ["w:users"],
            });

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

export default function UsersPage() {
    const { user: currentUser } = useAuth();
    const canEditUsers = currentUser?.role === "admin" || currentUser?.role === "super_admin";
    const { request, loading } = useRequestApi<APIResponse<User[]>>();
    const [result, setResult] = useState<APIResponse<User[]>>();
    const [modalOpen, setModalOpen] = useState(false);
    const [editUser, setEditUser] = useState<User | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);

    const users = result?.content || [];
    const totalElements = result?.totalElements || 0;
    const totalPages = result?.totalPages || 1;

    const { currentPage, handlePageChange, pagination, setCurrentPage } = usePagination({
        totalPages,
        pageSize: PAGE_SIZE,
        totalElements,
        itemName: "user",
    });

    const formik = useFormik<UsersTableFiltersFormValues>({
        initialValues: userFiltersInitialValues,
        onSubmit: () => {
            setCurrentPage(1);
        },
    });
    const { values } = formik;

    const handleResetFilters = useCallback(() => {
        formik.resetForm();
        setCurrentPage(1);
    }, [formik, setCurrentPage]);

    const fetchUsers = useCallback(async () => {
        try {
            const url = buildQueryUrl(API_ENDPOINTS.users, {
                page: currentPage - 1,
                size: PAGE_SIZE,
                search: values.search,
                role: values.role,
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
            toast.error("Failed to fetch users. Please try again.");
        }
    }, [request, currentPage, values.search, values.role, values.sortBy, values.sortOrder]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    useEffect(() => {
        formik.submitForm();
    }, [values.search, values.role, values.sortBy, values.sortOrder]);

    const handleCreate = () => {
        setEditUser(null);
        setModalOpen(true);
    };

    const handleEdit = (user: User) => {
        setEditUser(user);
        setModalOpen(true);
    };

    const handleDeleteClick = (user: User) => {
        setUserToDelete(user);
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!userToDelete) return;
        try {
            const result = await request(`${API_ENDPOINTS.users}/${userToDelete.id}`, {
                method: "DELETE",
            });

            // Check if request failed (returns null on error)
            if (result === null) {
                toast.error("Failed to delete user. Please try again.");
                return;
            }

            toast.success("User deleted successfully!");
            fetchUsers();
        } catch {
            toast.error("Failed to delete user. Please try again.");
        } finally {
            setDeleteModalOpen(false);
            setUserToDelete(null);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteModalOpen(false);
        setUserToDelete(null);
    };

    const handleExport = () => {
        const exportData = users.map(user => ({
            Name: user.name,
            Username: user.uid,
            Role: user.role,
            Email: user.email,
            Phone: user.phone,
        }));
        downloadCSV(exportData, "users-export.csv");
    };

    return (
        <div className="flex flex-col gap-6 sm:gap-8">
            <PageHeader
                title="User Management"
                description="Manage all users and their roles"
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
                            className="w-full sm:w-auto"
                            onClick={handleCreate}
                            scope={["w:users"]}
                            icon={<UserPlusIcon size={16} />}
                        >
                            Create User
                        </AccessButton>
                    </div>
                }
            />
            <div className="flex flex-col gap-4 sm:gap-1">
                <UsersTableFilters formik={formik} onReset={handleResetFilters} />
                <div className="rounded-lg bg-surface p-4 sm:p-6 shadow-sm hidden md:block">
                    <DataTable
                        columns={columns(handleEdit, handleDeleteClick, canEditUsers)}
                        data={users}
                        rowKey={row => row.id}
                        emptyMessage="No users found."
                        hoverable
                        pagination={pagination}
                        onPageChange={handlePageChange}
                        isLoading={loading}
                    />

                    {/* Mobile cards */}
                </div>
                <MobileCardList
                    className="flex flex-col gap-4 md:hidden"
                    items={users.map(user => ({ id: user.id, data: user }))}
                    renderHeader={user => (
                        <div className="flex items-center justify-between">
                            <div className="font-bold text-lg">{user.name}</div>
                            <div className="text-xs text-muted-foreground">{user.role}</div>
                        </div>
                    )}
                    renderContent={user => (
                        <>
                            <div className="mb-1">
                                Username: <span className="font-medium">{user.uid}</span>
                            </div>
                            <div className="mb-1">
                                Email: <span className="font-medium">{user.email}</span>
                            </div>
                            <div className="mb-2">
                                Phone: <span className="font-medium">{user.phone}</span>
                            </div>
                        </>
                    )}
                    renderActions={user => (
                        <div className="flex gap-2 justify-end">
                            {canEditUsers && (
                                <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>
                                    Edit
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteClick(user)}
                            >
                                Delete
                            </Button>
                        </div>
                    )}
                    emptyMessage="No users found."
                    pagination={pagination}
                    onPageChange={handlePageChange}
                    isLoading={loading}
                />
                <CreateUserModal
                    open={modalOpen}
                    onClose={() => setModalOpen(false)}
                    user={editUser}
                    onSuccess={fetchUsers}
                />
                <ConfirmationModal
                    open={deleteModalOpen}
                    onClose={handleDeleteCancel}
                    onConfirm={handleDeleteConfirm}
                    title="Delete User"
                    description={
                        userToDelete
                            ? `Are you sure you want to delete "${userToDelete.name}"? This action cannot be undone.`
                            : undefined
                    }
                    confirmText="Delete"
                    cancelText="Cancel"
                />
            </div>
        </div>
    );
}
