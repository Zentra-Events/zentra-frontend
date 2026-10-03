import { NextRequest, NextResponse } from "next/server";
import { getBackendHeaders, getBackendUrl } from "@/lib/api/api-server";

export async function GET(request: NextRequest) {
    const upstream = getBackendUrl();
    try {
        const eventID = request.nextUrl?.searchParams?.get("eventID");
        if (!eventID) {
            return NextResponse.json({ error: "Missing eventID" }, { status: 400 });
        }

        const headers = getBackendHeaders(request);
        const encodedId = encodeURIComponent(eventID);
        const url = `${upstream}/estimates/net-total?eventID=${encodedId}`;
        const res = await fetch(url, { headers });
        const body = await res.text();
        const responseHeaders: Record<string, string> = {};
        const contentType = res.headers.get("content-type");
        if (contentType) responseHeaders["content-type"] = contentType;
        return new NextResponse(body, { status: res.status, headers: responseHeaders });
    } catch (err) {
        console.error("Error proxying GET /estimates/net-total:", err);
        return NextResponse.json({ error: "Failed to proxy request" }, { status: 502 });
    }
}
