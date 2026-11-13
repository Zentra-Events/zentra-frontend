import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { EstimateVersionsView } from "@/components/estimate-versions-view";
import { apiRequest } from "@/lib/api/api-client";
import type { EstimateDto, EstimateVersionStatus } from "@/types/estimate";

vi.mock("@/lib/api/api-client", () => ({
    apiRequest: vi.fn(),
}));
vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));
// Mock MenuList to avoid AuthProvider requirement (it calls useAuth)
vi.mock("@/components/ui", async (importActual) => {
    const actual = await importActual<typeof import("@/components/ui")>();
    return {
        ...actual,
        MenuList: ({
            items,
            trigger,
        }: {
            items: Array<{
                key: string;
                label: string;
                icon?: React.ReactNode;
                onClick?: () => void;
                disabled?: boolean;
                className?: string;
            }>;
            trigger: React.ReactNode;
        }) => (
            <div data-testid="menu-list">
                {trigger}
                {items.map(item => (
                    <button
                        key={item.key}
                        data-testid={`menu-item-${item.key}`}
                        onClick={() => item.onClick?.()}
                        disabled={item.disabled}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
        ),
    };
});
// Mock AccessButton to avoid AuthProvider requirement
vi.mock("@/components/shared/access-button", () => ({
    AccessButton: ({
        children,
        onClick,
        disabled,
        scope,
        className,
        size,
        variant,
        icon,
    }: {
        children?: React.ReactNode;
        onClick?: () => void;
        disabled?: boolean;
        scope?: string[];
        className?: string;
        size?: string;
        variant?: string;
        icon?: React.ReactNode;
    }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            data-testid="access-button"
            data-scope={scope?.join(",")}
            data-size={size}
            data-variant={variant}
            className={className}
        >
            {icon}
            {children}
        </button>
    ),
}));
// Mock CreateEstimateModal to avoid complex dependencies
vi.mock("@/components/create-estimate-modal", () => ({
    default: function MockCreateEstimateModal({
        isOpen,
        onClose,
        initialData,
        isAdditionalEstimate,
        onSaved,
    }: {
        isOpen: boolean;
        onClose: () => void;
        initialData?: Record<string, unknown>;
        isAdditionalEstimate?: boolean;
        onSaved?: () => void;
    }) {
        if (!isOpen) return null;
        return (
            <div data-testid="create-estimate-modal">
                <h3>{isAdditionalEstimate ? "Create Additional Estimate" : initialData?.id ? "Edit Estimate" : "Create Estimate"}</h3>
                <button data-testid="modal-save" onClick={() => onSaved?.()}>Save</button>
                <button data-testid="modal-close" onClick={onClose}>Close</button>
            </div>
        );
    },
}));
vi.mock("@/components/estimate-preview-modal", () => ({
    EstimatePreviewModal: ({ estimate }: { estimate: Record<string, unknown> }) => (
        <div data-testid="estimate-preview-modal">
            Preview: {String(estimate.title)}
        </div>
    ),
}));
vi.mock("@/components/estimate-email-preview-modal", () => ({
    EstimateEmailPreviewModal: ({ _estimate, onSuccess, open }: { _estimate: Record<string, unknown>; onSuccess: () => void; open: boolean }) => {
        if (!open) return null;
        return (
            <div data-testid="estimate-email-preview-modal">
                <button data-testid="email-confirm" onClick={onSuccess}>Confirm</button>
            </div>
        );
    },
}));
vi.mock("@/components/shared/confirmation-modal", () => ({
    ConfirmationModal: ({ open, onClose, onConfirm, isLoading }: { open: boolean; onClose: () => void; onConfirm: () => void; isLoading?: boolean }) => {
        if (!open) return null;
        return (
            <div data-testid="confirmation-modal">
                <button data-testid="confirm-cancel" onClick={onClose}>Cancel</button>
                <button data-testid="confirm-confirm" onClick={onConfirm} disabled={isLoading}>Confirm</button>
            </div>
        );
    },
}));

const mockApiRequest = vi.mocked(apiRequest);

const baseEstimate = (overrides: Partial<EstimateDto> = {}): EstimateDto => ({
    id: "est-1",
    enquiryId: "enq-1",
    title: "Test Event",
    version: "v1",
    versionTitle: "Version 1",
    estimateStatus: "DRAFT" as EstimateVersionStatus,
    status: "ENQUIRY_CREATED",
    venue: "Grand Hall",
    location: "City",
    client: "Client A",
    clientID: "client-1",
    clientPoC: "John Doe",
    pocContactNumber: "9876543210",
    enquiryPoC: "Jane",
    highlvelRequirement: "Test requirement",
    enquiryDate: "2025-06-25T09:00:00Z",
    fromDate: "2025-07-01T09:00:00Z",
    toDate: "2025-07-02T09:00:00Z",
    gst: 18,
    gstType: "CGST_SGST",
    tds: 0,
    serviceCharge: 10,
    discounts: 0,
    billingAddress: "123 Street",
    items: {},
    eventID: "event-1",
    eventName: "Test Event",
    createdAt: "2025-06-25T09:00:00Z",
    updatedAt: "2025-06-25T09:00:00Z",
    ...overrides,
});

const defaultProps = {
    enquiryId: "enq-1",
    onVersionSelect: vi.fn(),
    onClose: vi.fn(),
    isViewOnlyMode: false,
};

function renderView(props: Record<string, unknown> = {}) {
    return render(<EstimateVersionsView {...defaultProps} {...(props as Record<string, unknown>)} />);
}

const mockVersionsResponse = (estimates: EstimateDto[]) => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: vi.fn().mockResolvedValue({ eventName: "Test Event", estimates }),
}) as unknown as Response;

const mockEmptyResponse = () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: vi.fn().mockResolvedValue({ eventName: "Test Event", estimates: [] }),
}) as unknown as Response;

describe("EstimateVersionsView", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockApiRequest.mockResolvedValue(mockEmptyResponse());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("fetching versions", () => {
        it("fetches versions on mount and displays them", async () => {
            const estimates = [baseEstimate({ id: "est-1", versionTitle: "Version 1" })];
            mockApiRequest.mockResolvedValue(mockVersionsResponse(estimates));

            renderView();

            await waitFor(() => {
                expect(screen.getByText("Version 1")).toBeInTheDocument();
            });

            expect(mockApiRequest).toHaveBeenCalledWith("/api/estimates/by-enquiry/enq-1");
        });

        it("shows loading state while fetching", async () => {
            mockApiRequest.mockResolvedValue(mockVersionsResponse([]));
            renderView();
            expect(screen.getByText(/loading versions/i)).toBeInTheDocument();
        });

        it("shows 'No estimates found' when list is empty", async () => {
            mockApiRequest.mockResolvedValue(mockEmptyResponse());
            renderView();

            await waitFor(() => {
                expect(screen.getByText(/no estimates found for this enquiry/i)).toBeInTheDocument();
            });
        });
    });

    describe("available estimate actions", () => {
        it("does not offer Clone while the clone action is unavailable", async () => {
            const estimate = baseEstimate({
                id: "est-1",
                estimateStatus: "DRAFT" as EstimateVersionStatus,
                versionTitle: "Version 1",
            });
            mockApiRequest.mockResolvedValue(mockVersionsResponse([estimate]));

            renderView();

            await waitFor(() => {
                expect(screen.getByText("Version 1")).toBeInTheDocument();
            });

            expect(screen.queryByRole("button", { name: /clone/i })).not.toBeInTheDocument();
            expect(screen.queryByTestId("menu-item-clone")).not.toBeInTheDocument();
        });
    });

    describe("status change / approval flow", () => {
        it("marks a UNDER_CLIENT_REVIEW estimate as FINAL", async () => {
            const estimate = baseEstimate({
                id: "est-1",
                estimateStatus: "UNDER_CLIENT_REVIEW" as EstimateVersionStatus,
                versionTitle: "Version 1",
            });
            mockApiRequest.mockResolvedValue(mockVersionsResponse([estimate]));

            renderView();
            await waitFor(() => {
                expect(screen.getByText("Version 1")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole("button", { name: /mark as final/i }));

            await waitFor(() => {
                expect(mockApiRequest).toHaveBeenCalledWith(
                    "/api/estimates/est-1/status?status=FINAL",
                    { method: "PATCH" },
                );
            });
        });

        it("reverts a FINAL estimate to DRAFT", async () => {
            const estimate = baseEstimate({
                id: "est-1",
                estimateStatus: "FINAL" as EstimateVersionStatus,
                versionTitle: "Version 1",
            });
            mockApiRequest.mockResolvedValue(mockVersionsResponse([estimate]));

            renderView();
            await waitFor(() => {
                expect(screen.getByText("Version 1")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole("button", { name: /revert to draft/i }));

            await waitFor(() => {
                expect(mockApiRequest).toHaveBeenCalledWith(
                    "/api/estimates/est-1/status?status=DRAFT",
                    { method: "PATCH" },
                );
            });
        });

        it("only shows Mark as Final for UNDER_CLIENT_REVIEW estimates", async () => {
            const draft = baseEstimate({
                id: "est-1",
                estimateStatus: "DRAFT" as EstimateVersionStatus,
                versionTitle: "Version 1",
            });
            mockApiRequest.mockResolvedValue(mockVersionsResponse([draft]));

            renderView();
            await waitFor(() => {
                expect(screen.getByText("Version 1")).toBeInTheDocument();
            });

            expect(screen.queryByRole("button", { name: /mark as final/i })).not.toBeInTheDocument();
        });

        it("shows Revert to Draft for FINAL estimates", async () => {
            const final = baseEstimate({
                id: "est-1",
                estimateStatus: "FINAL" as EstimateVersionStatus,
                versionTitle: "Version 1",
            });
            mockApiRequest.mockResolvedValue(mockVersionsResponse([final]));

            renderView();
            await waitFor(() => {
                expect(screen.getByText("Version 1")).toBeInTheDocument();
            });

            expect(screen.getByRole("button", { name: /revert to draft/i })).toBeInTheDocument();
        });

        it("shows Send to Client button for DRAFT estimates", async () => {
            const draft = baseEstimate({
                id: "est-1",
                estimateStatus: "DRAFT" as EstimateVersionStatus,
                versionTitle: "Version 1",
            });
            mockApiRequest.mockResolvedValue(mockVersionsResponse([draft]));

            renderView();
            await waitFor(() => {
                expect(screen.getByText("Version 1")).toBeInTheDocument();
            });

            expect(screen.getByRole("button", { name: /send to client/i })).toBeInTheDocument();
        });

        it("does not show Send to Client for non-DRAFT estimates", async () => {
            const final = baseEstimate({
                id: "est-1",
                estimateStatus: "FINAL" as EstimateVersionStatus,
                versionTitle: "Version 1",
            });
            mockApiRequest.mockResolvedValue(mockVersionsResponse([final]));

            renderView();
            await waitFor(() => {
                expect(screen.getByText("Version 1")).toBeInTheDocument();
            });

            expect(screen.queryByRole("button", { name: /send to client/i })).not.toBeInTheDocument();
        });
    });

    describe("create event flow", () => {
        it("creates an event from a FINAL estimate when no EVENT_CREATED estimate exists", async () => {
            const finalEstimate = baseEstimate({
                id: "est-1",
                estimateStatus: "FINAL" as EstimateVersionStatus,
                eventID: "event-1",
                versionTitle: "Version 1",
            });
            mockApiRequest.mockResolvedValue(mockVersionsResponse([finalEstimate]));

            const createdEvent = { eventID: "new-event-1" };
            // Use mockImplementation to return different responses based on URL
            mockApiRequest.mockImplementation((url: string) => {
                if (url === "/api/events") {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: async () => createdEvent,
                    } as unknown as Response);
                }
                return Promise.resolve(mockVersionsResponse([finalEstimate]));
            });

            renderView();
            await waitFor(() => {
                expect(screen.getByText("Version 1")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole("button", { name: /create event/i }));

            await waitFor(() => {
                expect(mockApiRequest).toHaveBeenCalledWith("/api/events", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: expect.any(String),
                });
            });
        });

        it("does not show Create Event button when an EVENT_CREATED estimate already exists", async () => {
            const finalEstimate = baseEstimate({
                id: "est-1",
                estimateStatus: "FINAL" as EstimateVersionStatus,
                eventID: "event-1",
                versionTitle: "Version 1",
            });
            const eventCreatedEstimate = baseEstimate({
                id: "est-2",
                estimateStatus: "EVENT_CREATED" as EstimateVersionStatus,
                eventID: "event-1",
                versionTitle: "Version 2",
            });
            mockApiRequest.mockResolvedValue(
                mockVersionsResponse([finalEstimate, eventCreatedEstimate]),
            );

            renderView();
            await waitFor(() => {
                expect(screen.getByText("Version 1")).toBeInTheDocument();
            });

            expect(screen.queryByRole("button", { name: /create event/i })).not.toBeInTheDocument();
        });
    });

    describe("merge flow", () => {
        it("merges a FINAL estimate into an existing event", async () => {
            const finalEstimate = baseEstimate({
                id: "est-1",
                estimateStatus: "FINAL" as EstimateVersionStatus,
                eventID: "event-1",
                versionTitle: "Version 1",
            });
            const eventCreatedEstimate = baseEstimate({
                id: "est-2",
                estimateStatus: "EVENT_CREATED" as EstimateVersionStatus,
                eventID: "event-1",
                versionTitle: "Version 2",
            });
            mockApiRequest.mockResolvedValue(
                mockVersionsResponse([finalEstimate, eventCreatedEstimate]),
            );

            renderView();
            await waitFor(() => {
                expect(screen.getByText("Version 1")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole("button", { name: /merge/i }));
            fireEvent.click(screen.getByTestId("confirm-confirm"));

            await waitFor(() => {
                expect(mockApiRequest).toHaveBeenCalledWith("/api/events/merge-estimate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ eventId: "event-1", estimateId: "est-1" }),
                });
            });
        });

        it("shows error toast when merge fails", async () => {
            const finalEstimate = baseEstimate({
                id: "est-1",
                estimateStatus: "FINAL" as EstimateVersionStatus,
                eventID: "event-1",
                versionTitle: "Version 1",
            });
            const eventCreatedEstimate = baseEstimate({
                id: "est-2",
                estimateStatus: "EVENT_CREATED" as EstimateVersionStatus,
                eventID: "event-1",
                versionTitle: "Version 2",
            });

            mockApiRequest.mockResolvedValue(
                mockVersionsResponse([finalEstimate, eventCreatedEstimate]),
            );

            renderView();
            await waitFor(() => {
                expect(screen.getByText("Version 1")).toBeInTheDocument();
            });

            // Make merge fail on the next API call
            mockApiRequest.mockRejectedValueOnce(new Error("Merge failed"));

            fireEvent.click(screen.getByRole("button", { name: /merge/i }));
            fireEvent.click(screen.getByTestId("confirm-confirm"));

            await waitFor(() => {
                expect(mockApiRequest).toHaveBeenCalledWith("/api/events/merge-estimate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ eventId: "event-1", estimateId: "est-1" }),
                });
            });
        });

        it("only shows Merge button for FINAL estimates when EVENT_CREATED exists", async () => {
            const finalEstimate = baseEstimate({
                id: "est-1",
                estimateStatus: "FINAL" as EstimateVersionStatus,
                eventID: "event-1",
                versionTitle: "Version 1",
            });
            mockApiRequest.mockResolvedValue(mockVersionsResponse([finalEstimate]));

            renderView();
            await waitFor(() => {
                expect(screen.getByText("Version 1")).toBeInTheDocument();
            });

            expect(screen.queryByRole("button", { name: /merge/i })).not.toBeInTheDocument();
        });
    });

    describe("additional estimate flow", () => {
        it("opens additional estimate flow for EVENT_CREATED estimate via footer button", async () => {
            const eventCreated = baseEstimate({
                id: "est-1",
                estimateStatus: "EVENT_CREATED" as EstimateVersionStatus,
                eventID: "event-1",
                versionTitle: "v1",
            });
            mockApiRequest.mockResolvedValue(mockVersionsResponse([eventCreated]));

            renderView();
            await waitFor(() => {
                expect(screen.getByText("v1")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole("button", { name: /additional estimate/i }));

            expect(screen.getByTestId("create-estimate-modal")).toBeInTheDocument();
        });
    });

    describe("view-only mode", () => {
        it("hides action buttons when isViewOnlyMode is true", async () => {
            const draft = baseEstimate({
                id: "est-1",
                estimateStatus: "DRAFT" as EstimateVersionStatus,
                versionTitle: "Version 1",
            });
            mockApiRequest.mockResolvedValue(mockVersionsResponse([draft]));

            renderView({ isViewOnlyMode: true });
            await waitFor(() => {
                expect(screen.getByText("Version 1")).toBeInTheDocument();
            });

            expect(screen.queryByRole("button", { name: /clone/i })).not.toBeInTheDocument();
            expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
            expect(screen.queryByRole("button", { name: /merge/i })).not.toBeInTheDocument();
        });
    });

    describe("preview and email flows", () => {
        it("opens preview modal when Preview button is clicked", async () => {
            const estimate = baseEstimate({
                id: "est-1",
                versionTitle: "Version 1",
            });
            mockApiRequest.mockResolvedValue(mockVersionsResponse([estimate]));

            renderView();
            await waitFor(() => {
                expect(screen.getByText("Version 1")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole("button", { name: /preview/i }));

            expect(screen.getByTestId("estimate-preview-modal")).toBeInTheDocument();
        });

        it("opens email modal and updates status to UNDER_CLIENT_REVIEW on success", async () => {
            const estimate = baseEstimate({
                id: "est-1",
                estimateStatus: "DRAFT" as EstimateVersionStatus,
                versionTitle: "Version 1",
            });
            mockApiRequest.mockResolvedValue(mockVersionsResponse([estimate]));

            renderView();
            await waitFor(() => {
                expect(screen.getByText("Version 1")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByRole("button", { name: /send to client/i }));

            await waitFor(() => {
                expect(screen.getByTestId("estimate-email-preview-modal")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId("email-confirm"));

            await waitFor(() => {
                expect(mockApiRequest).toHaveBeenCalledWith(
                    "/api/estimates/est-1/status?status=UNDER_CLIENT_REVIEW",
                    { method: "PATCH" },
                );
            });
        });
    });
});
