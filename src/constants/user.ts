import { User, UsersTableFiltersFormValues } from "@/types/user";

export const userFormInitialValues: User = {
    id: "",
    name: "",
    role: "",
    phone: "",
    email: "",
    uid: "",
    password: "",
};

export const rolesLabelMap: Record<string, string> = {
    admin: "ADMIN",
    user: "USER",
    customer: "CUSTOMER",
    super_admin: "SUPER ADMIN"
};

export const statusLabelMap: Record<string, string> = {
    active: "ACTIVE",
    inactive: "INACTIVE",
};

export const userRoleOptions = [
    { label: rolesLabelMap.admin, value: "admin" },
    { label: rolesLabelMap.user, value: "user" },
    { label: rolesLabelMap.customer, value: "customer" },
];

export const userSortOptions = [
    { label: "Created At", value: "createdAt" },
    { label: "Updated At", value: "updatedAt" },
    { label: "Name", value: "name" },
    { label: "Email", value: "email" },
    { label: "Username", value: "username" },
];

export const userFiltersInitialValues: UsersTableFiltersFormValues = {
    search: "",
    role: "",
    sortBy: "createdAt",
    sortOrder: "desc",
};
