import { Role, RoutePermission, Scope } from "../types/auth";

/**
 * Defines the mapping of roles to their respective permissions/scopes.
 * This can be used to determine what actions a user with a specific role is allowed to perform.
 * For example, an 'admin' might have permissions to read and edit users, while a 'user' might only have permissions to read posts.
 */
export const roleScopeMap: Record<Exclude<Role, "super_admin">, Scope[]> = {
    admin: [
        "r:enquiries",
        "w:enquiries",
        "r:estimates",
        "w:estimates",
        "r:events",
        "w:events",
        "r:inventory",
        "w:inventory",
        "r:vendors",
        "w:vendors",
        "r:reports",
        "w:reports",
        "r:bills",
        "w:bills",
        "r:schedules",
        "w:schedules",
        "r:users",
        "w:users",
        "r:dashboard",
        "w:dashboard",
        "r:expenses",
        "w:expenses",
        "a:expenses",
        "r:checklists",
        "w:checklists",
        "r:clients",
        "w:clients",
    ],
    user: [
        "r:enquiries",
        "r:estimates",
        "r:events",
        "r:inventory",
        "r:vendors",
        "r:reports",
        "r:bills",
        "r:schedules",
        "r:dashboard",
        "r:expenses",
        "r:checklists",
        "r:clients",
    ],
    customer: ["r:estimates", "r:events", "r:dashboard", "r:checklists"],
};

export const routePermissions: Record<string, RoutePermission> = {
    "/dashboard": {
        scopes: ["r:dashboard"],
    },
    "/users": {
        scopes: ["r:users"],
    },
    "/enquiries": {
        scopes: ["r:enquiries"],
    },
    "/enquiries/:id": {
        scopes: ["r:enquiries"],
    },
    "/estimates": {
        scopes: ["r:estimates"],
    },
    "/events": {
        scopes: ["r:events"],
    },
    "/events/:id": {
        scopes: ["r:events"],
    },
    "/inventory": {
        scopes: ["r:inventory"],
    },
    "/vendors": {
        scopes: ["r:vendors"],
    },
    "/bills": {
        scopes: ["r:bills"],
    },
    "/schedules": {
        scopes: ["r:schedules"],
    },
    "/reports": {
        scopes: ["r:reports"],
    },
    "/expenses": {
        scopes: ["r:expenses"],
    },
    "/checklists": {
        scopes: ["r:checklists"],
    },
    "/clients": {
        scopes: ["r:clients"],
    },
};
