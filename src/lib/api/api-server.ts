/**
 * Server-side API utility for Next.js API routes
 * This handles forwarding authentication tokens from Next.js API routes to the backend
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Extract the authentication token from the incoming request
 * and prepare headers for forwarding to the backend
 */
export function getBackendHeaders(request: NextRequest | Request): HeadersInit {
    const authToken =
        request.headers.get("X-Auth-Token") ||
        request.headers.get("x-auth-token") ||
        request.headers.get("Authorization") ||
        request.headers.get("authorization");

    const headers: HeadersInit = {};
    if (authToken) {
        headers["Authorization"] = authToken;
        headers["X-Auth-Token"] = authToken;
    }

    return headers;
}

/**
 * Add content-type header if needed
 */
export function addContentType(headers: HeadersInit, contentType: string = "application/json"): HeadersInit {
    if (typeof headers === "object" && !Array.isArray(headers)) {
        return {
            ...headers,
            "Content-Type": contentType,
        };
    }
    return headers;
}

/**
 * Get the backend URL from environment variables
 */
export function getBackendUrl(): string {
    return process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
}

/**
 * Build a NextResponse that safely forwards an upstream backend response.
 *
 * Responses with a "null body status" (101, 204, 205, 304) must not carry a
 * body. Passing an empty string (which is what `await res.text()` yields for a
 * body-less 204) to the NextResponse/Response constructor throws
 * "TypeError: Response constructor: Invalid response status code 204", so we
 * must pass `null` instead. Without this, a successful DELETE that returns
 * 204 would be swallowed by the surrounding try/catch and surface as a
 * spurious 502 "Failed to proxy request" error.
 */
export function forwardBackendResponse(
    body: string | null,
    status: number,
    headers: Record<string, string> = {}
): NextResponse {
    const isNullBodyStatus = status === 101 || status === 204 || status === 205 || status === 304;
    return new NextResponse(isNullBodyStatus ? null : body, {
        status,
        headers,
    });
}

/**
 * Proxy an event scoped list endpoint to the backend.
 *
 * The backend exposes the event scoped lookups of the bills under different
 * paths depending on the deployed version (`/byevent` and `/event`). A path
 * that the running backend does not know is answered by the `/{id}` route,
 * which resolves to `null` for the unknown id instead of failing, so a
 * response is only accepted when it is a JSON array. The first candidate that
 * returns a list wins, the remaining ones are not called.
 */
export async function proxyEventScopedList(
    request: NextRequest | Request,
    backendPaths: string[],
): Promise<NextResponse> {
    const backendUrl = getBackendUrl();
    const search = new URL(request.url).search || "";
    const headers = getBackendHeaders(request);

    let fallback: { body: string; status: number; contentType: string | null } | null = null;

    for (const path of backendPaths) {
        const res = await fetch(`${backendUrl}${path}${search}`, { headers });
        const body = await res.text();
        const contentType = res.headers.get("content-type");

        let isList = false;
        try {
            isList = Array.isArray(JSON.parse(body));
        } catch {
            isList = false;
        }

        if (res.ok && isList) {
            return new NextResponse(body, {
                status: res.status,
                headers: contentType ? { "content-type": contentType } : {},
            });
        }

        if (!fallback) {
            fallback = { body, status: res.status, contentType };
        }
    }

    return new NextResponse(fallback?.body ?? "", {
        status: fallback?.status ?? 502,
        headers: fallback?.contentType ? { "content-type": fallback.contentType } : {},
    });
}

/**
 * Utility to handle API requests in Next.js API routes, forwarding to the backend
 */
export async function handleApiRequest(fn: () => Promise<Response>) {
    try {
        const response = await fn();
        const data = await response.json();

        return NextResponse.json(data, {
            status: response.status,
        });
    } catch {
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
