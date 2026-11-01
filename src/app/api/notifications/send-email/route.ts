import { getBackendHeaders, getBackendUrl } from "@/lib/api/api-server";
import { NextRequest, NextResponse } from "next/server";

function appendAddressFields(incoming: FormData, outbound: FormData, key: string) {
    const addresses = incoming
        .getAll(key)
        .flatMap(value => String(value).split(/[,;]/))
        .map(value => value.trim().replace(/^mailto:/i, ""))
        .filter(value => value.length > 0);

    for (const address of addresses) {
        outbound.append(key, address);
    }
}

export async function POST(req: NextRequest) {
    try {
        const incoming = await req.formData();
        const outbound = new FormData();

        const pdfPart = incoming.get("pdfFile");
        if (!(pdfPart instanceof File) || pdfPart.size === 0) {
            return new NextResponse("PDF attachment is required", { status: 400 });
        }

        for (const [key, value] of incoming.entries()) {
            if (key === "pdfFile" || key === "to" || key === "cc" || key === "subject" || key === "body") continue;
            if (typeof value === "string" && value.trim().length === 0) continue;
            outbound.append(key, value);
        }

        const subject = incoming.get("subject");
        if (typeof subject === "string" && subject.trim().length > 0) {
            outbound.append("subject", subject.trim());
        }

        const body = incoming.get("body");
        if (typeof body === "string" && body.trim().length > 0) {
            outbound.append("body", body.trim());
        }

        appendAddressFields(incoming, outbound, "to");
        appendAddressFields(incoming, outbound, "cc");

        if (!outbound.has("to")) {
            return new NextResponse("At least one valid To address is required", { status: 400 });
        }

        const filename = pdfPart.name?.toLowerCase().endsWith(".pdf")
            ? pdfPart.name
            : "estimate.pdf";
        outbound.append(
            "pdfFile",
            new File([pdfPart], filename, { type: pdfPart.type || "application/pdf" }),
        );

        // Force IPv4 so Node does not resolve localhost to ::1 while Spring listens on 127.0.0.1
        const backendUrl = getBackendUrl().replace("localhost", "127.0.0.1");
        const response = await fetch(`${backendUrl}/notifications/send-mail`, {
            method: "POST",
            body: outbound,
            headers: getBackendHeaders(req),
        });

        const result = await response.text();
        if (!response.ok) {
            console.error(`Backend failed with status ${response.status}: ${result}`);
            return new NextResponse(result || "Failed to send email", { status: response.status });
        }

        return new NextResponse(result, { status: 200 });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("API Route Proxy Error:", error);
        return new NextResponse(`Internal Server Error: ${message}`, { status: 500 });
    }
}
