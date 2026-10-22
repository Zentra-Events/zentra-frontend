import { NextRequest, NextResponse } from "next/server";
import {
    addContentType,
    getBackendHeaders,
    getBackendUrl,
} from "@/lib/api/api-server";

const BACKEND_PATH = "/api/client-bills";

export async function GET(request: NextRequest) {
    const BACKEND_URL = getBackendUrl();
    try {
        const search = request.nextUrl.search || "";
        const headers = getBackendHeaders(request);
        const res = await fetch(`${BACKEND_URL}${BACKEND_PATH}${search}`, { headers });

        const text = await res.text();
        const responseHeaders: Record<string, string> = {};
        const contentType = res.headers.get("content-type");
        if (contentType) responseHeaders["content-type"] = contentType;

        return new NextResponse(text, { status: res.status, headers: responseHeaders });
    } catch (error) {
        console.error("Failed to fetch client bills:", error);
        return NextResponse.json({ error: "Failed to fetch client bills" }, { status: 502 });
    }
}

export async function POST(request: NextRequest) {
    const BACKEND_URL = getBackendUrl();
    try {
        const body = await request.text();
        const headers = addContentType(getBackendHeaders(request));
        const res = await fetch(`${BACKEND_URL}${BACKEND_PATH}`, {
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
        console.error("Failed to create client bill:", error);
        return NextResponse.json({ error: "Failed to create client bill" }, { status: 502 });
    }
}
