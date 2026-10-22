import { NextRequest, NextResponse } from "next/server";
import { getBackendHeaders, getBackendUrl } from "@/lib/api/api-server";

export async function GET(request: NextRequest) {
    const BACKEND_URL = getBackendUrl();
    try {
        const url = new URL(request.url);
        const headers = getBackendHeaders(request);
        const backendUrl = `${BACKEND_URL}/api/expenses/event${url.search}`;

        console.log(backendUrl, headers);

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
