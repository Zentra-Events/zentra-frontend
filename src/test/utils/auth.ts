import { act } from "@testing-library/react";

export interface MockAuthState {
    token: string | null;
    tokenType: string;
    expiresIn: number | null;
    user: {
        id: string;
        name: string | null;
        email: string | null;
        uid: string;
        phone: string | null;
        role: string | null;
        lastLoginTimestamp: string | null;
    } | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (userID: string, password: string) => Promise<void>;
    logout: () => void;
    getAuthHeader: () => string | null;
}

export const mockAuthState: MockAuthState = {
    token: "test-token",
    tokenType: "Bearer",
    expiresIn: 86400000,
    user: {
        id: "test-user-1",
        name: "Test User",
        email: "test@example.com",
        uid: "uid-123",
        phone: null,
        role: "ADMIN",
        lastLoginTimestamp: null,
    },
    isAuthenticated: true,
    isLoading: false,
    login: async () => {},
    logout: () => {},
    getAuthHeader: () => "Bearer test-token",
};

export const mockUnauthenticatedState: MockAuthState = {
    token: null,
    tokenType: "Bearer",
    expiresIn: null,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: async () => {},
    logout: () => {},
    getAuthHeader: () => null,
};
