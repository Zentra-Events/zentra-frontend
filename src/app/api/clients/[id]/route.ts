import { NextRequest, NextResponse } from "next/server";
import { getBackendHeaders, getBackendUrl } from "@/lib/api/api-server";

const DEFAULT_TIMEOUT = 5000;

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

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const BACKEND_URL = getBackendUrl();
    try {
        const { id } = await params;
        const body = await request.text();
        const url = `${BACKEND_URL}/clients/${id}`;
        const headers = { ...getBackendHeaders(request), "Content-Type": "application/json" };

        const response = await fetchWithTimeout(url, {
            method: "PUT",
            headers,
            body,
        });

        if (!response.ok) {
            throw new Error(`Backend responded with status: ${response.status}`);
        }

        const text = await response.text();
        if (!text) return new NextResponse(null, { status: response.status });
        try {
            return NextResponse.json(JSON.parse(text), { status: response.status });
        } catch {
            return new NextResponse(text, { status: response.status });
        }
    } catch (error) {
        console.error("Error updating client at", BACKEND_URL, error);
        return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const BACKEND_URL = getBackendUrl();
    try {
        const { id } = await params;
        const url = `${BACKEND_URL}/clients/${id}`;
        const headers = { ...getBackendHeaders(request), "Content-Type": "application/json" };

        const response = await fetchWithTimeout(url, {
            method: "DELETE",
            headers,
        });

        if (!response.ok) {
            throw new Error(`Backend responded with status: ${response.status}`);
        }

        return new NextResponse(null, { status: response.status });
    } catch (error) {
        console.error("Error deleting client from", BACKEND_URL, error);
        return NextResponse.json({ error: "Failed to delete client" }, { status: 500 });
    }
}
