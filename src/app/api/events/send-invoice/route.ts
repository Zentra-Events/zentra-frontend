import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        console.log("Received send-invoice request via Next.js API Route");

        // Parse incoming request as FormData
        const formData = await req.formData();

        // Extract headers
        const authHeader = req.headers.get("Authorization") || req.headers.get("X-Auth-Token");

        console.log("Auth Header present:", !!authHeader);

        // Forward to Spring Boot backend - Make sure to use 127.0.0.1 (not localhost)
        const baseUrl = (process.env.BACKEND_URL || "http://127.0.0.1:8080").replace(
            "localhost",
            "127.0.0.1",
        ); // Force 127.0.0.1
        const backendUrl = `${baseUrl}/events/send-invoice`;

        // When sending FormData with fetch, do NOT manually setContent-Type.
        // The browser/fetch automatically sets it with the correct boundary.
        const response = await fetch(backendUrl, {
            method: "POST",
            body: formData, // passing FormData directly lets fetch set the content-type with boundary
            headers: authHeader ? { Authorization: authHeader } : undefined, // do not set Content-Type
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Backend failed with status ${response.status}: ${errorText}`);
            return new NextResponse(errorText, { status: response.status });
        }

        const result = await response.text();
        console.log("Backend success:", result);
        return new NextResponse(result, { status: 200 });
    } catch (error: unknown) {
        console.error("API Route Proxy Error:", error);
        return new NextResponse(`Internal Server Error: ${error instanceof Error ? error.message : String(error)}`, { status: 500 });
    }
}
