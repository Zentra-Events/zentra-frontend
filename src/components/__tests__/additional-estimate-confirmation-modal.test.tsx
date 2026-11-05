import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AdditionalEstimateConfirmationModal from "@/components/ui/additional-estimate-confirmation-modal";
import type { GroupedCategory, GroupedItem } from "@/lib/utils/estimate-comparison";

const makeItem = (overrides: Partial<GroupedItem> = {}): GroupedItem => ({
    id: "item-1",
    item: "Sound System",
    specification: "Wireless mic",
    days: 1,
    sqft: 2,
    rate: 1000,
    vendor: "Vendor A",
    unit: "nos",
    ...overrides,
});

const makeCategory = (
    name: string,
    directItems: GroupedItem[] = [],
    subCategories: Array<{ name: string; items: GroupedItem[] }> = [],
): GroupedCategory => ({
    id: `cat-${name}`,
    name,
    directItems,
    subCategories: subCategories.map(sub => ({
        id: `sub-${name}-${sub.name}`,
        name: sub.name,
        items: sub.items,
        romanIndex: "",
    })),
});

const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    existingEventItems: [] as GroupedCategory[],
    newEstimateItems: [] as GroupedCategory[],
};

function renderModal(props: Record<string, unknown> = {}) {
    return render(<AdditionalEstimateConfirmationModal {...defaultProps} {...props} />);
}

describe("AdditionalEstimateConfirmationModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders the modal with title when open", () => {
        renderModal();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("Confirm Additional Estimate")).toBeInTheDocument();
    });

    it("does not render when open is false", () => {
        renderModal({ open: false });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("calls onClose when Back to Estimate button is clicked", () => {
        renderModal();
        fireEvent.click(screen.getByRole("button", { name: /back to estimate/i }));
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onConfirm when Confirm and Save button is clicked", () => {
        renderModal();
        fireEvent.click(screen.getByRole("button", { name: /confirm and save/i }));
        expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it("disables Confirm and Save when loading", () => {
        renderModal({ loading: true });
        const confirmBtn = screen.getByRole("button", { name: /confirm and save/i });
        expect(confirmBtn).toBeDisabled();
    });

    it("shows loading message when loading", () => {
        renderModal({ loading: true });
        expect(screen.getByText(/loading existing event items/i)).toBeInTheDocument();
    });

    it("shows error message when error is provided", () => {
        renderModal({ error: "Failed to load items" });
        expect(screen.getByText(/failed to load items/i)).toBeInTheDocument();
    });

    it("shows 'No existing event items found' when existing is empty", () => {
        renderModal({ existingEventItems: [], newEstimateItems: [] });
        expect(screen.getByText(/no existing event items found/i)).toBeInTheDocument();
    });

    it("shows 'No new items have been added yet' when new is empty", () => {
        renderModal({ existingEventItems: [], newEstimateItems: [] });
        expect(screen.getByText(/no new items have been added yet/i)).toBeInTheDocument();
    });

    it("renders existing items in left panel", () => {
        const existing = [makeCategory("Audio", [makeItem({ id: "e1", item: "Mic", sqft: 2, rate: 500 })])];
        renderModal({ existingEventItems: existing });

        expect(screen.getByText("Existing Finalized Event Items")).toBeInTheDocument();
        expect(screen.getByText("Mic")).toBeInTheDocument();
    });

    it("renders new items in right panel", () => {
        const newItems = [makeCategory("Audio", [makeItem({ id: "n1", item: "Mic", sqft: 2, rate: 500 })])];
        renderModal({ newEstimateItems: newItems });

        expect(screen.getByText("New Additional Estimate Items")).toBeInTheDocument();
        expect(screen.getByText("Mic")).toBeInTheDocument();
    });

    it("shows subcategory headers when items have subcategories", () => {
        const existing = [
            makeCategory("Audio", [], [
                { name: "Mics", items: [makeItem({ id: "e1", item: "Mic", sqft: 2, rate: 500 })] },
            ]),
        ];
        renderModal({ existingEventItems: existing });

        expect(screen.getByText("Mics")).toBeInTheDocument();
    });

    it("shows comparison summary banner when there are matching items", () => {
        const existing = [makeCategory("Audio", [makeItem({ id: "e1", item: "Mic", sqft: 2, rate: 500 })])];
        const newItems = [makeCategory("Audio", [makeItem({ id: "n1", item: "Mic", sqft: 5, rate: 500 })])];
        renderModal({ existingEventItems: existing, newEstimateItems: newItems });

        expect(screen.getByText(/review required/i)).toBeInTheDocument();
    });

    it("does not show comparison summary banner when all items are new", () => {
        const existing: GroupedCategory[] = [];
        const newItems = [makeCategory("Audio", [makeItem({ id: "n1", item: "New Mic", sqft: 2, rate: 500 })])];
        renderModal({ existingEventItems: existing, newEstimateItems: newItems });

        expect(screen.queryByText(/review required/i)).not.toBeInTheDocument();
    });

    it("shows item total in each row (days * sqft * rate)", () => {
        const existing = [makeCategory("Audio", [makeItem({ id: "e1", item: "Mic", days: 2, sqft: 3, rate: 100 })])];
        renderModal({ existingEventItems: existing });

        // 2 * 3 * 100 = 600.00
        expect(screen.getByText("600.00")).toBeInTheDocument();
    });
});
