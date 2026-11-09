import { NextRequest, NextResponse } from "next/server";
import { getBackendHeaders, getBackendUrl } from "@/lib/api/api-server";
import { buildQueryUrl } from "@/lib/api/query-params";

export async function GET(request: NextRequest) {
    const BACKEND_URL = getBackendUrl();
    try {
        const headers = getBackendHeaders(request);
        const searchParams = request.nextUrl.searchParams;

        const url = buildQueryUrl(`${BACKEND_URL}/users`, {
            page: searchParams.get("page"),
            size: searchParams.get("size"),
            search: searchParams.get("search"),
            role: searchParams.get("role"),
            sortBy: searchParams.get("sortBy"),
            direction: searchParams.get("direction"),
        });

        const res = await fetch(url, {
            method: "GET",
            headers,
        });
        const data = await res.text();
        const contentType = res.headers.get("content-type");
        return new NextResponse(data, {
            status: res.status,
            headers: contentType ? { "content-type": contentType } : undefined,
        });
    } catch (error) {
        console.error("[Users API] Error:", error);
        return NextResponse.json({ error: "Failed to fetch users" }, { status: 502 });
    }
}

export async function POST(request: NextRequest) {
    const BACKEND_URL = getBackendUrl();
    try {
        const headers = getBackendHeaders(request);
        const body = await request.text();
        const res = await fetch(`${BACKEND_URL}/users`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body,
        });
        const data = await res.text();
        const contentType = res.headers.get("content-type");
        return new NextResponse(data, {
            status: res.status,
            headers: contentType ? { "content-type": contentType } : undefined,
        });
    } catch (_error) {
        return NextResponse.json({ error: "Failed to create user" }, { status: 502 });
    }
}
