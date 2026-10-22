import { NextRequest, NextResponse } from "next/server";
import { getBackendHeaders, getBackendUrl, forwardBackendResponse } from "@/lib/api/api-server";

function idFrom(request: NextRequest): string | null {
    const parts = (request.nextUrl?.pathname ?? "").split("/");
    // /api/enquiries/[id]/notes -> second-to-last segment
    const idx = parts.lastIndexOf("notes");
    const id = idx > 0 ? parts[idx - 1] : null;
    return id || null;
}

// GET /api/enquiries/[id]/notes -> GET {backend}/enquiries/{id}/notes
// Returns 404 when the backend has no notes resource so the UI can fall
// back to device-local notes instead of faking server persistence.
export async function GET(request: NextRequest) {
    const upstream = getBackendUrl();
    const id = idFrom(request);
    if (!id) return NextResponse.json({ error: "Missing enquiry id" }, { status: 400 });
    try {
        const headers = getBackendHeaders(request);
        const res = await fetch(`${upstream}/enquiries/${encodeURIComponent(id)}/notes`, {
            headers,
        });
        const body = await res.text();
        const responseHeaders: Record<string, string> = {};
        const contentType = res.headers.get("content-type");
        if (contentType) responseHeaders["content-type"] = contentType;
        return forwardBackendResponse(body, res.status, responseHeaders);
    } catch (error) {
        console.error("Error proxying GET enquiry notes:", error);
        return NextResponse.json({ error: "Failed to proxy request" }, { status: 502 });
    }
}

// POST /api/enquiries/[id]/notes -> POST {backend}/enquiries/{id}/notes
export async function POST(request: NextRequest) {
    const upstream = getBackendUrl();
    const id = idFrom(request);
    if (!id) return NextResponse.json({ error: "Missing enquiry id" }, { status: 400 });
    try {
        const headers = getBackendHeaders(request);
        const body = await request.text();
        const res = await fetch(`${upstream}/enquiries/${encodeURIComponent(id)}/notes`, {
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
        console.error("Error proxying POST enquiry notes:", error);
        return NextResponse.json({ error: "Failed to proxy request" }, { status: 502 });
    }
}
