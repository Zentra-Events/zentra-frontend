import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl, getBackendHeaders, forwardBackendResponse } from "@/lib/api/api-server";

export async function GET(request: NextRequest) {
    const upstream = getBackendUrl();
    try {
        const pathname = request.nextUrl?.pathname ?? "";
        const parts = pathname.split("/");
        const id = parts[parts.length - 1];
        if (!id) return NextResponse.json({ error: "Missing event id" }, { status: 400 });

        const headers = getBackendHeaders(request);
        const encodedId = encodeURIComponent(id);
        // Backend changed to query-based endpoint: /events/by-eventid?eventID=<id>
        const url = `${upstream}/events/by-eventid?eventID=${encodedId}`;
        console.log("[API] Proxy GET event detail ->", url);
        const res = await fetch(url, { headers });
        const body = await res.text();
        const responseHeaders: Record<string, string> = {};
        const contentType = res.headers.get("content-type");
        if (contentType) responseHeaders["content-type"] = contentType;
        return forwardBackendResponse(body, res.status, responseHeaders);
    } catch (err) {
        console.error("Error proxying GET /events/:id:", err);
        return NextResponse.json({ error: "Failed to proxy request" }, { status: 502 });
    }
}

export async function DELETE(request: NextRequest) {
    const upstream = getBackendUrl();
    try {
        const pathname = request.nextUrl?.pathname ?? "";
        const parts = pathname.split("/");
        const id = parts[parts.length - 1];
        if (!id) return NextResponse.json({ error: "Missing event id" }, { status: 400 });

        const headers = getBackendHeaders(request);

        const encodedId = encodeURIComponent(id);
        // DELETE remains path-based: /events/{eventId}
        const url = `${upstream}/events/${encodedId}`;
        console.log("[API] Proxy DELETE event ->", url);
        const res = await fetch(url, { method: "DELETE", headers });
        const body = await res.text();
        const responseHeaders: Record<string, string> = {};
        const contentType = res.headers.get("content-type");
        if (contentType) responseHeaders["content-type"] = contentType;
        return forwardBackendResponse(body, res.status, responseHeaders);
    } catch (err) {
        console.error("Error proxying DELETE /events/:id", err);
        return NextResponse.json({ error: "Failed to proxy delete" }, { status: 502 });
    }
}

export async function PUT(request: NextRequest) {
    const upstream = getBackendUrl();
    try {
        const pathname = request.nextUrl?.pathname ?? "";
        const parts = pathname.split("/");
        const id = parts[parts.length - 1];
        if (!id) return NextResponse.json({ error: "Missing event id" }, { status: 400 });

        const body = await request.text();
        const headers = {
            ...getBackendHeaders(request),
            "Content-Type": "application/json",
        } as HeadersInit;

        const encodedId = encodeURIComponent(id);
        const url = `${upstream}/events/${encodedId}?eventID=${encodedId}`;
        console.log("[API] Proxy PUT event ->", url);
        const res = await fetch(url, {
            method: "PUT",
            headers,
            body,
        });

        const responseBody = await res.text();
        const responseHeaders: Record<string, string> = {};
        const contentType = res.headers.get("content-type");
        if (contentType) responseHeaders["content-type"] = contentType;
        return forwardBackendResponse(responseBody, res.status, responseHeaders);
    } catch (err) {
        console.error("Error proxying PUT /events/:id", err);
        return NextResponse.json({ error: "Failed to proxy update" }, { status: 502 });
    }
}
