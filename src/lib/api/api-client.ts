/**
 * API Utility for Authenticated Requests
 *
 * This utility provides helper functions to make authenticated API requests
 * to the backend. It automatically includes the Authorization header with
 * the Bearer token from encrypted storage.
 */

import { getSecureItem, removeSecureItem } from "../secure-storage";
import { notifySessionExpired } from "@/lib/auth/session";

const AUTH_STORAGE_KEY = "zentra_auth";

interface AuthData {
    token: string;
    tokenType: string;
    expiresAt: number;
}

function handleUnauthorized(hasAuthToken: boolean): void {
    if (!hasAuthToken || typeof window === "undefined") return;
    removeSecureItem(AUTH_STORAGE_KEY);
    notifySessionExpired();
}

/**
 * Get the authorization header value from stored auth data
 */
export function getAuthHeader(): string | null {
    try {
        const stored = getSecureItem<AuthData>(AUTH_STORAGE_KEY);
        if (!stored) return null;

        // Check if token is expired
        if (stored.expiresAt && Date.now() >= stored.expiresAt) {
            removeSecureItem(AUTH_STORAGE_KEY);
            notifySessionExpired();
            return null;
        }

        return `${stored.tokenType || "Bearer"} ${stored.token}`;
    } catch (error) {
        console.error("Failed to get auth header:", error);
        return null;
    }
}

/**
 * Make an authenticated fetch request to the backend
 * This is a wrapper around the native fetch API that automatically includes auth headers
 */
export async function authenticatedFetch(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    const authHeader = getAuthHeader();

    const headers = new Headers(options.headers || {});

    // Add authorization header if available
    if (authHeader) {
        headers.set("Authorization", authHeader);
    }

    // Add content-type if not specified and body is present
    if (options.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    // Let the auth provider move the user to login and preserve their current page.
    if (response.status === 401) {
        handleUnauthorized(Boolean(authHeader));
    }

    return response;
}

/**
 * Helper function to make authenticated requests to Next.js API routes
 * Next.js API routes will then forward the auth header to the backend
 */
export async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const authHeader = getAuthHeader();

    const headers = new Headers(options.headers || {});

    // Add auth headers to pass through to Next API (and then backend)
    if (authHeader) {
        headers.set("X-Auth-Token", authHeader); // legacy/custom
        headers.set("Authorization", authHeader); // standard header expected by backend
        console.log("[API Client] Adding auth headers:", authHeader.substring(0, 20) + "...");
    } else {
        console.warn("[API Client] No auth token found in secure storage");
    }

    if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(endpoint, {
        ...options,
        headers,
    });

    if (response.status === 401) handleUnauthorized(Boolean(authHeader));
    return response;
}
