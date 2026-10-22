import { NextRequest, NextResponse } from "next/server";
import { proxyEventScopedList } from "@/lib/api/api-server";

// The running backend serves the event scoped client bills under one of these
// paths, the first one that returns a list is used.
const BACKEND_PATHS = ["/api/client-bills/byevent", "/api/client-bills/event"];

export async function GET(request: NextRequest) {
    try {
        return await proxyEventScopedList(request, BACKEND_PATHS);
    } catch (error) {
        console.error("Failed to fetch client bills of the event:", error);
        return NextResponse.json(
            { error: "Failed to fetch client bills of the event" },
            { status: 502 },
        );
    }
}
