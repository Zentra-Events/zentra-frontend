import { NextRequest, NextResponse } from "next/server";
import { getBackendHeaders, getBackendUrl, forwardBackendResponse } from "@/lib/api/api-server";

export async function GET(request: NextRequest) {
    const upstream = getBackendUrl();
    try {
        const pathname = request.nextUrl?.pathname ?? "";
        const parts = pathname.split("/");
        const id = parts[parts.length - 1];
        if (!id) {
            return NextResponse.json({ error: "Missing enquiry id" }, { status: 400 });
        }

        const headers = getBackendHeaders(request);
        const res = await fetch(`${upstream}/enquiries/id?id=${encodeURIComponent(id)}`, {
            headers,
        });

        const responseBody = await res.text();
        const responseHeaders: Record<string, string> = {};
        const contentType = res.headers.get("content-type");
        if (contentType) responseHeaders["content-type"] = contentType;

        return forwardBackendResponse(responseBody, res.status, responseHeaders);
    } catch (error) {
        console.error("Error proxying GET enquiry request:", error);
        return NextResponse.json({ error: "Failed to proxy request" }, { status: 502 });
    }
}

export async function DELETE(request: NextRequest) {
    const upstream = getBackendUrl();
    try {
        // request.nextUrl.pathname is like /api/enquiries/{id}
        const pathname = request.nextUrl?.pathname ?? "";
        const parts = pathname.split("/");
        const id = parts[parts.length - 1];
        if (!id) {
            return NextResponse.json({ error: "Missing enquiry id" }, { status: 400 });
        }

        const headers = getBackendHeaders(request);
        const res = await fetch(`${upstream}/enquiries/${encodeURIComponent(id)}`, {
            method: "DELETE",
            headers,
        });

        const responseBody = await res.text();
        const responseHeaders: Record<string, string> = {};
        const contentType = res.headers.get("content-type");
        if (contentType) responseHeaders["content-type"] = contentType;

        return forwardBackendResponse(responseBody, res.status, responseHeaders);
    } catch (error) {
        console.error("Error proxying DELETE request:", error);
        return NextResponse.json({ error: "Failed to proxy request" }, { status: 502 });
    }
}
