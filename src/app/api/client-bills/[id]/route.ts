import { NextRequest, NextResponse } from "next/server";
import {
    addContentType,
    forwardBackendResponse,
    getBackendHeaders,
    getBackendUrl,
} from "@/lib/api/api-server";

const BACKEND_PATH = "/api/client-bills";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const BACKEND_URL = getBackendUrl();
    try {
        const { id } = await params;
        const headers = getBackendHeaders(request);
        const res = await fetch(`${BACKEND_URL}${BACKEND_PATH}/${id}`, { headers });

        const text = await res.text();
        const responseHeaders: Record<string, string> = {};
        const contentType = res.headers.get("content-type");
        if (contentType) responseHeaders["content-type"] = contentType;

        return new NextResponse(text, { status: res.status, headers: responseHeaders });
    } catch (error) {
        console.error("Failed to fetch client bill:", error);
        return NextResponse.json({ error: "Failed to fetch client bill" }, { status: 502 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const BACKEND_URL = getBackendUrl();
    try {
        const { id } = await params;
        const body = await request.text();
        const headers = addContentType(getBackendHeaders(request));
        const res = await fetch(`${BACKEND_URL}${BACKEND_PATH}/${id}`, {
            method: "PUT",
            headers,
            body,
        });

        const text = await res.text();
        const responseHeaders: Record<string, string> = {};
        const contentType = res.headers.get("content-type");
        if (contentType) responseHeaders["content-type"] = contentType;

        return new NextResponse(text, { status: res.status, headers: responseHeaders });
    } catch (error) {
        console.error("Failed to update client bill:", error);
        return NextResponse.json({ error: "Failed to update client bill" }, { status: 502 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const BACKEND_URL = getBackendUrl();
    try {
        const { id } = await params;
        const headers = getBackendHeaders(request);
        const res = await fetch(`${BACKEND_URL}${BACKEND_PATH}/${id}`, {
            method: "DELETE",
            headers,
        });

        const text = await res.text();
        const responseHeaders: Record<string, string> = {};
        const contentType = res.headers.get("content-type");
        if (contentType) responseHeaders["content-type"] = contentType;

        return forwardBackendResponse(text, res.status, responseHeaders);
    } catch (error) {
        console.error("Failed to delete client bill:", error);
        return NextResponse.json({ error: "Failed to delete client bill" }, { status: 502 });
    }
}
