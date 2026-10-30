import { NextRequest, NextResponse } from "next/server";
import { getBackendHeaders, getBackendUrl, forwardBackendResponse } from "@/lib/api/api-server";

// Proxy for POST /enquiries/clone. The view modal already calls
// /api/enquiries/clone but the route was missing — without it Next.js
// returns 404 and cloning silently fails.
export async function POST(request: NextRequest) {
    const upstream = getBackendUrl();
    try {
        const headers = getBackendHeaders(request);
        const body = await request.text();
        const res = await fetch(`${upstream}/enquiries/clone`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body,
        });
        const responseBody = await res.text();
        const responseHeaders: Record<string, string> = {};
        const contentType = res.headers.get("content-type");
        if (contentType) responseHeaders["content-type"] = contentType;
        return forwardBackendResponse(responseBody, res.status, responseHeaders);
    } catch (error) {
        console.error("Error proxying POST /enquiries/clone:", error);
        return NextResponse.json({ error: "Failed to proxy clone request" }, { status: 502 });
    }
}
