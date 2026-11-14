"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useFormik } from "formik";
import { toast } from "sonner";

import { useRequestApi } from "@/hooks/useRequestApi";
import { useUsers } from "@/hooks/useUsers";
import { useServerPagination } from "@/hooks/useServerPagination";
import { Button } from "@/components/ui/button";
import { Badge, PageHeader } from "@/components/ui";
import { MenuList } from "@/components/ui";
import { Avatar } from "@/components/ui/avatar";
import { MoreVerticalIcon, PencilIcon, TrashIcon, UserPlusIcon } from "@/components/ui/icons";
import CreateUserModal from "@/components/create-user-modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { MobileCardList } from "@/components/shared/mobile-card-list";
import { UsersTableFilters } from "@/components/users-table-filters";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import { User, UsersTableFiltersFormValues } from "@/types/user";
import { DEFAULT_PAGE_SIZE } from "@/constants";
import { MenuItem } from "@/types";
import { downloadCSV } from "@/lib/utils/file";
import { buildQueryUrl } from "@/lib/api/query-params";
import { userFiltersInitialValues, rolesLabelMap, statusLabelMap } from "@/constants/user";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { useAuth } from "@/context/auth";
import { AccessButton } from "@/components/shared/access-button";
import { Download } from "lucide-react";
import { apiRequest } from "@/lib/api/api-client";

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

const columns = (
    onEdit: (user: User) => void,
    onDelete: (row: User) => void,
    canEdit: boolean = false,
): Column<User>[] => [
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
    const { request, loading: requestLoading } = useRequestApi();
    const { users: allUsers, deleteUser } = useUsers();
    const [modalOpen, setModalOpen] = useState(false);
    const [editUser, setEditUser] = useState<User | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [deleting, setDeleting] = useState(false);

    const formik = useFormik<UsersTableFiltersFormValues>({
        initialValues: userFiltersInitialValues,
        onSubmit: () => {
            // Pagination/search is driven by `useServerPagination`; the form is
            // only a state container for the filter controls.
        },
    });
    const { values } = formik;

    const {
        items: users,
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
    } = useServerPagination<User>({
        fetchPage: async ({ search: q, page, pageSize: size }) => {
            const url = buildQueryUrl(API_ENDPOINTS.users, {
                page: page - 1,
                size,
                search: q,
                role: values.role,
                sortBy: values.sortBy,
                direction: values.sortOrder,
            });
            const res = await apiRequest(url);
            if (!res.ok) {
                throw new Error(`Failed to fetch users: ${res.statusText}`);
            }
            const data = (await res.json()) as {
                content: User[];
                totalElements: number;
            };
            return { items: data.content ?? [], total: data.totalElements ?? 0 };
        },
        pageSize: PAGE_SIZE,
        filterSignature: JSON.stringify({
            role: values.role,
            sortBy: values.sortBy,
            sortOrder: values.sortOrder,
        }),
    });

    // Keep the hook's search in sync with the formik search field. The hook
    // debounces it so searches are not issued on every keystroke.
    useEffect(() => {
        setSearch(values.search);
    }, [values.search, setSearch]);

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

    const hasMore = currentPage < totalPages;

    const pagination = {
        currentPage,
        totalPages,
        pageSize,
        totalItems: total,
        itemName: "user",
        hasNextPage: hasMore,
        hasPreviousPage: currentPage > 1,
    };

    const handleResetFilters = useCallback(() => {
        formik.resetForm();
        reset();
    }, [formik, reset]);

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
        setDeleting(true);
        try {
            const result = await request(`${API_ENDPOINTS.users}/${userToDelete.id}`, {
                method: "DELETE",
            });

            if (result === null) {
                toast.error("Failed to delete user. Please try again.");
                return;
            }

            toast.success("User deleted successfully!");
            deleteUser(userToDelete.id);
            // Refresh the current page so the paginated backend list reflects
            // the deletion.
            void refetch();
        } catch {
            toast.error("Failed to delete user. Please try again.");
        } finally {
            setDeleting(false);
            setDeleteModalOpen(false);
            setUserToDelete(null);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteModalOpen(false);
        setUserToDelete(null);
    };

    const handleExport = () => {
        const exportData = allUsers.map(user => ({
            Name: user.name,
            Username: user.uid,
            Role: user.role,
            Email: user.email,
            Phone: user.phone,
        }));
        downloadCSV(exportData, "users-export.csv");
    };

    const emptyMessage =
        search && total === 0 ? "No users match your search." : "No users found.";

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
                        emptyMessage={emptyMessage}
                        hoverable
                        pagination={pagination}
                        onPageChange={setPage}
                        isLoading={loading || requestLoading || deleting}
                    />
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
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEdit(user)}
                                >
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
                    emptyMessage={emptyMessage}
                    pagination={pagination}
                    onPageChange={setPage}
                    isLoading={loading || requestLoading || deleting}
                />
                <CreateUserModal
                    open={modalOpen}
                    onClose={() => setModalOpen(false)}
                    user={editUser}
                    onSuccess={name => {
                        const searchUnchanged = search === name;
                        void formik.setFieldValue("search", name);
                        void formik.setFieldValue("role", "");
                        if (searchUnchanged) refetch();
                    }}
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
                    confirmText={deleting ? "Deleting..." : "Delete"}
                    cancelText="Cancel"
                    isLoading={deleting}
                />
            </div>
        </div>
    );
}
