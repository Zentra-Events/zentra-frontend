import { NextRequest, NextResponse } from "next/server";
import { getBackendHeaders, getBackendUrl } from "@/lib/api/api-server";
import { buildQueryUrl } from "@/lib/api/query-params";

const DEFAULT_TIMEOUT = 5000; // ms

async function fetchWithTimeout(input: RequestInfo, init?: RequestInit, timeout = DEFAULT_TIMEOUT) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(input, { signal: controller.signal, ...init });
        return res;
    } finally {
        clearTimeout(id);
    }
}

function isConnectionRefusedError(err: unknown) {
    // Node fetch wraps socket errors in an AggregateError with cause.code = 'ECONNREFUSED'
    // This helper inspects common shapes to detect connection refused.
    if (!err || typeof err !== "object") return false;
    const e = err as { code?: string; cause?: unknown };
    if (e.code === "ECONNREFUSED") return true;
    if (e.cause && typeof e.cause === "object") {
        const c = e.cause as { code?: string };
        if (c.code === "ECONNREFUSED") return true;
    }
    return false;
}

export async function GET(request: NextRequest) {
    const BACKEND_URL = getBackendUrl();
    try {
        const headers = getBackendHeaders(request);
        const searchParams = request.nextUrl.searchParams;

        const url = buildQueryUrl(`${BACKEND_URL}/clients`, {
            page: searchParams.get("page"),
            size: searchParams.get("size"),
            search: searchParams.get("search"),
        });

        const response = await fetchWithTimeout(url, {
            method: "GET",
            headers,
        });

        if (!response.ok) {
            throw new Error(`Backend responded with status: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Error fetching clients from", BACKEND_URL, error);
        if (isConnectionRefusedError(error)) {
            return NextResponse.json(
                { error: "Backend unreachable (connection refused)", backend: BACKEND_URL },
                { status: 502 }
            );
        }
        if (error && typeof error === "object" && "name" in error) {
            const name = (error as { name?: unknown }).name;
            if (name === "AbortError") {
                return NextResponse.json(
                    { error: "Request to backend timed out", backend: BACKEND_URL },
                    { status: 504 }
                );
            }
        }
        return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const BACKEND_URL = getBackendUrl();
    try {
        const body = await request.json();
        const url = `${BACKEND_URL}/clients`;

        const headers = { ...getBackendHeaders(request), "Content-Type": "application/json" };
        const response = await fetchWithTimeout(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Backend responded with status: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Error creating client to", BACKEND_URL, error);
        if (isConnectionRefusedError(error)) {
            return NextResponse.json(
                { error: "Backend unreachable (connection refused)", backend: BACKEND_URL },
                { status: 502 }
            );
        }
        if (error && typeof error === "object" && "name" in error) {
            const name = (error as { name?: unknown }).name;
            if (name === "AbortError") {
                return NextResponse.json(
                    { error: "Request to backend timed out", backend: BACKEND_URL },
                    { status: 504 }
                );
            }
        }
        return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
    }
}
