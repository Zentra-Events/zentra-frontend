export type ForgotPasswordFormValues = {
    email: string;
    otp?: string;
    password: string;
    confirmPassword: string;
    showResetForm?: boolean;
    otpVerified?: boolean;
};

/**
 * Defines the possible roles for users in the system.
 * These roles can be used to categorize users and assign
 * specific permissions or access levels based on their role.
 * For example, a 'super_admin' might have full access to all features,
 * while a 'customer' might have limited access to only certain features.
 */
export type Role = "super_admin" | "admin" | "user" | "customer";

/**
 * Defines the possible scopes/permissions for users in the system.
 * These can be used to control access to various features and
 * resources based on the users role and assigned permissions.
 */
export type Scope =
    | "r:users"
    | "w:users"
    | "r:enquiries"
    | "w:enquiries"
    | "r:estimates"
    | "w:estimates"
    | "r:events"
    | "w:events"
    | "r:inventory"
    | "w:inventory"
    | "r:vendors"
    | "w:vendors"
    | "r:reports"
    | "w:reports"
    | "r:bills"
    | "w:bills"
    | "r:schedules"
    | "w:schedules"
    | "r:dashboard"
    | "w:dashboard"
    | "r:expenses"
    | "w:expenses"
    | "a:expenses"
    | "r:checklists"
    | "w:checklists"
    | "r:clients"
    | "w:clients";

export type RoutePermission = {
    roles?: Role[];
    scopes?: Scope[];
};
