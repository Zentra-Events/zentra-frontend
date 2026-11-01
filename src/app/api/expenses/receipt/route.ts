import { NextRequest, NextResponse } from "next/server";
import {
    forwardBackendResponse,
    getBackendHeaders,
    getBackendUrl,
} from "@/lib/api/api-server";

export async function POST(request: NextRequest) {
    try {
        const incomingFormData = await request.formData();
        const files = incomingFormData.getAll("file");
        if (
            files.length !== 1 ||
            !(files[0] instanceof File) ||
            [...incomingFormData.keys()].some(key => key !== "file")
        ) {
            return NextResponse.json(
                { error: 'Exactly one receipt file under the "file" field is required.' },
                { status: 400 },
            );
        }

        const formData = new FormData();
        formData.append("file", files[0]);

        const url = new URL(request.url);
        const res = await fetch(
            `${getBackendUrl()}/api/expenses/receipt${url.search}`,
            {
                method: "POST",
                body: formData,
                headers: getBackendHeaders(request),
            },
        );
        const body = await res.text();
        const contentType = res.headers.get("content-type");
        return forwardBackendResponse(
            body,
            res.status,
            contentType ? { "content-type": contentType } : {},
        );
    } catch (error) {
        console.error("Failed to proxy expense receipt upload:", error);
        return NextResponse.json(
            { error: "Failed to upload expense receipt" },
            { status: 502 },
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const res = await fetch(
            `${getBackendUrl()}/api/expenses/receipt${url.search}`,
            {
                method: "DELETE",
                headers: getBackendHeaders(request),
            },
        );
        const body = await res.text();
        const contentType = res.headers.get("content-type");
        return forwardBackendResponse(
            body,
            res.status,
            contentType ? { "content-type": contentType } : {},
        );
    } catch (error) {
        console.error("Failed to delete expense receipt:", error);
        return NextResponse.json(
            { error: "Failed to delete expense receipt" },
            { status: 502 },
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const res = await fetch(
            `${getBackendUrl()}/api/expenses/receipt${url.search}`,
            {
                method: "GET",
                headers: getBackendHeaders(request),
            },
        );
        const arrayBuffer = await res.arrayBuffer();
        const contentType = res.headers.get("content-type");
        return new NextResponse(arrayBuffer, {
            status: res.status,
            headers: contentType ? { "content-type": contentType } : {},
        });
    } catch (error) {
        console.error("Failed to fetch expense receipt:", error);
        return NextResponse.json(
            { error: "Failed to fetch expense receipt" },
            { status: 502 },
        );
    }
}
