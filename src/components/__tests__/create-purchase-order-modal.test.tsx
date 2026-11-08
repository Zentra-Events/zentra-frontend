import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreatePurchaseOrderModal } from "@/components/create-purchase-order-modal";
import type { EventResponse } from "@/types/event";

vi.mock("@/lib/api/api-client", () => ({
    apiRequest: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

const baseEvent: EventResponse = {
    id: "ev-1",
    eventID: "EV-1",
    title: "Test Event",
    client: "Test Client",
    items: [
        {
            item: "LED Par",
            description: "Stage light",
            quantity: 2,
            pricePerItem: 500,
            days: 1,
            vendor: "v1",
            category: "Lighting",
            unit: "nos",
        },
        {
            item: "Mic",
            description: "Wireless mic",
            quantity: 1,
            pricePerItem: 300,
            days: 1,
            vendor: "v2",
            category: "Audio",
            unit: "nos",
        },
    ],
    vendorSummary: [
        {
            vendor: "v1",
            totalAmount: 1000,
            advanceAmount: 0,
            gst: 18,
            tds: 0,
            adjustedAmt: 1180,
            balance: 1180,
        },
        {
            vendor: "v2",
            totalAmount: 300,
            advanceAmount: 0,
            gst: 12,
            tds: 0,
            adjustedAmt: 336,
            balance: 336,
        },
    ],
} as unknown as EventResponse;

const vendorList = [
    { id: "v1", name: "Stage Co" },
    { id: "v2", name: "Audio Co" },
];

const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    eventData: baseEvent,
    vendorList,
    totalClientEstimatedAmount: 1300,
};

function renderModal(props: Record<string, unknown> = {}) {
    return render(<CreatePurchaseOrderModal {...baseProps} {...props} />);
}

describe("CreatePurchaseOrderModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders the modal title and client view by default", () => {
        renderModal();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("Create Purchase Order")).toBeInTheDocument();
        expect(screen.getByText("Billing information")).toBeInTheDocument();
    });

    it("renders client name from event data", async () => {
        const user = userEvent.setup();
        renderModal();
        await user.click(screen.getByRole("button", { name: /billing information/i }));
        expect(screen.getByText("Test Client")).toBeInTheDocument();
    });

    it("renders vendor sidebar with vendors that have items", () => {
        renderModal();
        expect(screen.getByText("Stage Co")).toBeInTheDocument();
        expect(screen.getByText("Audio Co")).toBeInTheDocument();
    });

    it("shows vendor status labels for each vendor with items", () => {
        renderModal();
        expect(screen.getAllByText("Active Selection")).toHaveLength(2);
    });

    it("switches to vendor view when a vendor is clicked", async () => {
        const user = userEvent.setup();
        renderModal();

        await user.click(screen.getByRole("button", { name: /stage co/i }));

        expect(screen.getByText("Consolidated Financials")).toBeInTheDocument();
        expect(screen.getByText("LED Par")).toBeInTheDocument();
    });

    it("shows vendor items table when vendor view is active", async () => {
        const user = userEvent.setup();
        renderModal();

        await user.click(screen.getByRole("button", { name: /stage co/i }));

        expect(screen.getByText("LED Par")).toBeInTheDocument();
        expect(screen.getByText("Lighting")).toBeInTheDocument();
    });

    it("shows 'No vendors assigned' when no vendors have items", () => {
        const emptyEvent = { ...baseEvent, items: [] } as unknown as EventResponse;
        renderModal({ eventData: emptyEvent });

        expect(screen.getByText(/no vendors assigned/i)).toBeInTheDocument();
    });

    it("does not call apiRequest unless save is triggered", async () => {
        const { apiRequest } = await import("@/lib/api/api-client");
        renderModal();
        expect(apiRequest).not.toHaveBeenCalled();
    });
});
