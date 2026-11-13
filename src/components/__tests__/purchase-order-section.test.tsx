import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PurchaseOrderSection } from "@/components/purchase-order-section";
import type { VendorSummary } from "@/types/event";

const vendorSummary: VendorSummary[] = [
    {
        vendor: "v1",
        totalAmount: 5000,
        advanceAmount: 1000,
        gst: 18,
        tds: 1,
        adjustedAmt: 5850,
        balance: 4850,
    },
    {
        vendor: "v2",
        totalAmount: 2000,
        advanceAmount: 0,
        gst: 12,
        tds: 2,
        adjustedAmt: 2240,
        balance: 2240,
    },
];

const vendorList = [
    { id: "v1", name: "Stage Co" },
    { id: "v2", name: "Audio Co" },
];

const baseProps = {
    expanded: false,
    onToggle: vi.fn(),
    onAddPurchaseOrder: vi.fn(),
    onViewPurchaseOrder: vi.fn(),
    isChecklistCompleted: true,
    vendorSummary,
    vendorList,
};

function renderSection(props: Record<string, unknown> = {}) {
    return render(<PurchaseOrderSection {...baseProps} {...props} />);
}

describe("PurchaseOrderSection", () => {
    it("renders the section header in collapsed state", () => {
        renderSection();
        expect(screen.getByText("Purchase Order")).toBeInTheDocument();
        expect(screen.getByText("Vendor items and order details")).toBeInTheDocument();
    });

    it("does not render the table when collapsed", () => {
        renderSection();
        expect(screen.queryByText("Stage Co")).not.toBeInTheDocument();
        expect(screen.queryByText("No purchase orders available for this event.")).not.toBeInTheDocument();
    });

    it("toggles expanded state when the header is clicked", () => {
        renderSection();
        expect(baseProps.onToggle).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: /purchase order/i }));
        expect(baseProps.onToggle).toHaveBeenCalledTimes(1);
    });

    it("renders vendor table rows when expanded with vendor summary", () => {
        renderSection({ expanded: true });
        expect(screen.getByText("Stage Co")).toBeInTheDocument();
        expect(screen.getByText("Audio Co")).toBeInTheDocument();
        expect(screen.getByText("₹5,000.00")).toBeInTheDocument();
        expect(screen.getByText("₹2,000.00")).toBeInTheDocument();
    });

    it("shows empty message when vendor summary is empty and expanded", () => {
        renderSection({ expanded: true, vendorSummary: [] });
        expect(screen.getByText(/no purchase orders available for this event/i)).toBeInTheDocument();
    });

    it("shows checklist message when vendor summary is empty and expanded", () => {
        renderSection({ expanded: true, vendorSummary: [] });
        expect(screen.getByText(/please complete the checklist to add purchase orders/i)).toBeInTheDocument();
    });

    it("renders View and Update buttons when expanded with data", () => {
        renderSection({ expanded: true });
        expect(screen.getByRole("button", { name: /view/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /update/i })).toBeInTheDocument();
    });

    it("calls onViewPurchaseOrder when View button is clicked", () => {
        renderSection({ expanded: true });
        fireEvent.click(screen.getByRole("button", { name: /view/i }));
        expect(baseProps.onViewPurchaseOrder).toHaveBeenCalledTimes(1);
    });

    it("calls onAddPurchaseOrder when Update button is clicked", () => {
        renderSection({ expanded: true });
        fireEvent.click(screen.getByRole("button", { name: /update/i }));
        expect(baseProps.onAddPurchaseOrder).toHaveBeenCalledTimes(1);
    });

    it("renders action buttons when expanded even with empty vendor summary", () => {
        renderSection({ expanded: true, vendorSummary: [] });
        expect(screen.getByRole("button", { name: /view/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /update/i })).toBeInTheDocument();
    });

    it("renders amount, gst, tds, adjustment, advance and balance columns", () => {
        renderSection({ expanded: true });
        expect(screen.getByText("Amount")).toBeInTheDocument();
        expect(screen.getByText("GST(%)")).toBeInTheDocument();
        expect(screen.getByText("TDS(%)")).toBeInTheDocument();
        expect(screen.getByText("Adjustment")).toBeInTheDocument();
        expect(screen.getByText("Advance")).toBeInTheDocument();
        expect(screen.getByText("Balance")).toBeInTheDocument();
    });

    it("shows dash for null/undefined monetary values", () => {
        const emptySummary: VendorSummary[] = [
            {
                vendor: "v1",
                totalAmount: 0,
                advanceAmount: 0,
                balance: 0,
            },
        ];
        renderSection({ expanded: true, vendorSummary: emptySummary, vendorList: [] });
        const dashes = screen.getAllByText("—");
        expect(dashes.length).toBeGreaterThan(0);
    });
});
