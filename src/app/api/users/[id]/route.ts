import { NextRequest, NextResponse } from "next/server";
import { getBackendHeaders, getBackendUrl, forwardBackendResponse } from "@/lib/api/api-server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const BACKEND_URL = getBackendUrl();
    try {
        const headers = getBackendHeaders(request);
        const { id } = await params;
        const res = await fetch(`${BACKEND_URL}/users/${id}`, {
            method: "GET",
            headers,
        });
        const data = await res.text();
        const contentType = res.headers.get("content-type");
        return forwardBackendResponse(data, res.status, contentType ? { "content-type": contentType } : {});
    } catch (error) {
        console.error("[User Detail API] Error:", error);
        return NextResponse.json({ error: "Failed to fetch user" }, { status: 502 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const BACKEND_URL = getBackendUrl();
    try {
        const headers = getBackendHeaders(request);
        const { id } = await params;
        const body = await request.text();
        const res = await fetch(`${BACKEND_URL}/users/${id}`, {
            method: "PUT",
            headers: { ...headers, "Content-Type": "application/json" },
            body,
        });
        const data = await res.text();
        const contentType = res.headers.get("content-type");
        return forwardBackendResponse(data, res.status, contentType ? { "content-type": contentType } : {});
    } catch (_error) {
        return NextResponse.json({ error: "Failed to update user" }, { status: 502 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const BACKEND_URL = getBackendUrl();
    try {
        const headers = getBackendHeaders(request);
        const { id } = await params;
        const res = await fetch(`${BACKEND_URL}/users/${id}`, {
            method: "DELETE",
            headers,
        });
        const data = await res.text();
        const contentType = res.headers.get("content-type");
        return forwardBackendResponse(data, res.status, contentType ? { "content-type": contentType } : {});
    } catch (_error) {
        return NextResponse.json({ error: "Failed to delete user" }, { status: 502 });
    }
}
