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
        const backendUrl = `${BACKEND_URL}/api/expenses${url.search}`;
        const res = await fetch(backendUrl, { headers });

        const text = await res.text();
        const responseHeaders: Record<string, string> = {};
        const contentType = res.headers.get("content-type");
        if (contentType) responseHeaders["content-type"] = contentType;

        return new NextResponse(text, { status: res.status, headers: responseHeaders });
    } catch (error) {
        console.error("Failed to fetch expenses:", error);
        return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 502 });
    }
}

export async function POST(request: NextRequest) {
    const BACKEND_URL = getBackendUrl();
    try {
        const body = await request.text();
        const headers = addContentType(getBackendHeaders(request));
        const res = await fetch(`${BACKEND_URL}/api/expenses`, {
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
        console.error("Failed to proxy expenses POST:", error);
        return NextResponse.json({ error: "Failed to create expense" }, { status: 502 });
    }
}

export async function PUT(request: NextRequest) {
    const BACKEND_URL = getBackendUrl();
    try {
        const url = new URL(request.url);
        const body = await request.text();
        const headers = addContentType(getBackendHeaders(request));
        const backendUrl = `${BACKEND_URL}/api/expenses${url.search}`;
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
        console.error("Failed to proxy expenses PUT:", error);
        return NextResponse.json({ error: "Failed to update expense" }, { status: 502 });
    }
}

export async function DELETE(request: NextRequest) {
    const BACKEND_URL = getBackendUrl();
    try {
        const url = new URL(request.url);
        const headers = getBackendHeaders(request);
        const backendUrl = `${BACKEND_URL}/api/expenses${url.search}`;
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
        console.error("Failed to proxy expenses DELETE:", error);
        return NextResponse.json({ error: "Failed to delete expense" }, { status: 502 });
    }
}
