import { NextRequest, NextResponse } from "next/server";
import {
    getBackendHeaders,
    getBackendUrl,
    addContentType,
    forwardBackendResponse,
} from "@/lib/api/api-server";

export async function GET(request: NextRequest) {
    const BACKEND_URL = getBackendUrl();
    try {
        const url = new URL(request.url);
        const headers = getBackendHeaders(request);
        const backendUrl = `${BACKEND_URL}/fund-allocations${url.search}`;
        const res = await fetch(backendUrl, { headers });

        const text = await res.text();
        const responseHeaders: Record<string, string> = {};
        const contentType = res.headers.get("content-type");
        if (contentType) responseHeaders["content-type"] = contentType;

        return new NextResponse(text, { status: res.status, headers: responseHeaders });
    } catch (error) {
        console.error("Failed to fetch fund allocations:", error);
        return NextResponse.json({ error: "Failed to fetch fund allocations" }, { status: 502 });
    }
}

export async function POST(request: NextRequest) {
    const BACKEND_URL = getBackendUrl();
    try {
        const body = await request.text();
        const headers = addContentType(getBackendHeaders(request));
        const res = await fetch(`${BACKEND_URL}/fund-allocations`, {
            method: "POST",
            headers,
            body,
        });

        const text = await res.text();
        const responseHeaders: Record<string, string> = {};
        const contentType = res.headers.get("content-type");
        if (contentType) responseHeaders["content-type"] = contentType;
        return new NextResponse(text, { status: res.status, headers: responseHeaders });
    } catch (error) {
        console.error("Failed to proxy fund allocations POST:", error);
        return NextResponse.json({ error: "Failed to create fund allocation" }, { status: 502 });
    }
}

export async function PUT(request: NextRequest) {
    const BACKEND_URL = getBackendUrl();
    try {
        const url = new URL(request.url);
        const body = await request.text();
        const headers = addContentType(getBackendHeaders(request));
        const backendUrl = `${BACKEND_URL}/fund-allocations${url.search}`;
        const res = await fetch(backendUrl, {
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
        console.error("Failed to proxy fund allocations PUT:", error);
        return NextResponse.json({ error: "Failed to update fund allocation" }, { status: 502 });
    }
}

export async function DELETE(request: NextRequest) {
    const BACKEND_URL = getBackendUrl();
    try {
        const url = new URL(request.url);
        const headers = getBackendHeaders(request);
        const backendUrl = `${BACKEND_URL}/fund-allocations${url.search}`;
        const res = await fetch(backendUrl, {
            method: "DELETE",
            headers,
        });

        const data = await res.text();
        const contentType = res.headers.get("content-type");
        return forwardBackendResponse(
            data,
            res.status,
            contentType ? { "content-type": contentType } : {},
        );
    } catch (error) {
        console.error("Failed to proxy fund allocations DELETE:", error);
        return NextResponse.json({ error: "Failed to delete fund allocation" }, { status: 502 });
    }
}
