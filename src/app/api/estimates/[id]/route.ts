import { NextRequest, NextResponse } from "next/server";
import { getBackendHeaders, getBackendUrl, addContentType, forwardBackendResponse } from "@/lib/api/api-server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const BACKEND_URL = getBackendUrl();
    try {
        const { id } = await params;
        const headers = getBackendHeaders(request);
        const backendUrl = `${BACKEND_URL}/estimates/${id}`;

        const res = await fetch(backendUrl, { headers });

        const text = await res.text();
        const responseHeaders: Record<string, string> = {};
        const contentType = res.headers.get("content-type");
        if (contentType) responseHeaders["content-type"] = contentType;

        return forwardBackendResponse(text, res.status, responseHeaders);
    } catch (error) {
        console.error("Failed to fetch estimate:", error);
        return NextResponse.json({ error: "Failed to fetch estimate" }, { status: 502 });
    }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const BACKEND_URL = getBackendUrl();
    try {
        const { id } = await params;
        const body = await request.text();
        const headers = addContentType(getBackendHeaders(request));
        const res = await fetch(`${BACKEND_URL}/estimates/${id}`, {
            method: "PUT",
            headers,
            body,
        });
        const text = await res.text();
        const responseHeaders: Record<string, string> = {};
        const contentType = res.headers.get("content-type");
        if (contentType) responseHeaders["content-type"] = contentType;
        return forwardBackendResponse(text, res.status, responseHeaders);
    } catch (error) {
        console.error("Failed to update estimate:", error);
        return NextResponse.json({ error: "Failed to update estimate" }, { status: 502 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const BACKEND_URL = getBackendUrl();
    try {
        const { id } = await params;
        const headers = getBackendHeaders(request);
        const res = await fetch(`${BACKEND_URL}/estimates/${id}`, {
            method: "DELETE",
            headers,
        });
        const text = await res.text();
        const responseHeaders: Record<string, string> = {};
        const contentType = res.headers.get("content-type");
        if (contentType) responseHeaders["content-type"] = contentType;
        return forwardBackendResponse(text, res.status, responseHeaders);
    } catch (error) {
        console.error("Failed to delete estimate:", error);
        return NextResponse.json({ error: "Failed to delete estimate" }, { status: 502 });
    }
}
