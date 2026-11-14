import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CreateEstimateModal from "@/components/create-estimate-modal";
import { apiRequest } from "@/lib/api/api-client";

vi.mock("@/lib/api/api-client", () => ({
    apiRequest: vi.fn(),
}));
vi.mock("@/components/artifacts-section", () => ({
    ArtifactsSection: ({
        lines,
        onLinesChange,
        disabled,
    }: {
        lines: TestLine[];
        onLinesChange: (lines: TestLine[]) => void;
        disabled?: boolean;
    }) => (
        <div data-testid="artifacts-section">
            {lines.map((line) => (
                <div key={line.id} data-testid="artifact-line">
                    {line.item} - {line.rate}
                </div>
            ))}
            <button
                data-testid="add-item"
                onClick={() =>
                    onLinesChange([
                        ...lines,
                        {
                            id: "new-line",
                            item: "New Item",
                            category: "General",
                            subCategory: "",
                            specification: "",
                            days: 1,
                            sqft: 1,
                            rate: 100,
                            vendor: "",
                            unit: "nos",
                        },
                    ])
                }
                disabled={disabled}
            >
                Add Item
            </button>
        </div>
    ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

interface TestLine {
    id: string;
    item: string;
    category: string;
    subCategory: string;
    specification: string;
    days: number;
    sqft: number;
    rate: number;
    vendor: string;
    unit: string;
}

const mockApiRequest = vi.mocked(apiRequest);

const mockClientSummaryResponse = () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-type": "application/json" }),
    json: vi.fn().mockResolvedValue([
        {
            clientId: "client-1",
            clientName: "Test Client",
            enquiries: [
                { enquiryId: "enq-1", title: "Wedding Event" },
                { enquiryId: "enq-2", title: "Corporate Event" },
            ],
        },
    ]),
}) as unknown as Response;

const mockEstimateSaveResponse = (body: unknown = { id: "est-1" }) => ({
    ok: true,
    status: 200,
    statusText: "OK",
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
}) as unknown as Response;

const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSaved: vi.fn(),
};

function renderModal(props: Record<string, unknown> = {}) {
    return render(<CreateEstimateModal {...baseProps} {...props} />);
}

describe("CreateEstimateModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockApiRequest.mockResolvedValue(mockClientSummaryResponse());
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("rendering", () => {
        it("renders create modal with title", () => {
            renderModal();
            expect(screen.getByRole("dialog")).toBeInTheDocument();
            expect(screen.getByText(/create estimate/i)).toBeInTheDocument();
        });

        it("renders edit modal with title when initialData has id", () => {
            renderModal({
                initialData: {
                    id: "est-1",
                    client: "Test Client",
                    title: "Old Event",
                    enquiryId: "enq-1",
                },
            });
            expect(screen.getByText(/edit estimate/i)).toBeInTheDocument();
        });

        it("renders additional estimate modal title", () => {
            renderModal({
                isAdditionalEstimate: true,
                initialData: {
                    id: "est-1",
                    client: "Test Client",
                    title: "Old Event",
                    enquiryId: "enq-1",
                },
            });
            expect(screen.getByText(/create additional estimate/i)).toBeInTheDocument();
        });

        it("does not render when isOpen is false", () => {
            renderModal({ isOpen: false });
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
    });

    describe("edit flow", () => {
        it("prefills form fields from initialData", async () => {
            renderModal({
                initialData: {
                    id: "est-1",
                    client: "Test Client",
                    title: "Old Event",
                    enquiryId: "enq-1",
                    highlvelRequirement: "Old requirements",
                    venue: "Old Venue",
                    location: "Old Location",
                    status: "ENQUIRY_CREATED",
                    gst: 18,
                    serviceCharge: 10,
                    discounts: 0,
                },
            });

            await waitFor(() => {
                expect(screen.getByLabelText(/event title/i)).toHaveValue("Old Event");
            });
            expect(screen.getByLabelText(/project summary/i)).toHaveValue("Old requirements");
            expect(screen.getByLabelText(/venue/i)).toHaveValue("Old Venue");
            expect(screen.getByLabelText(/location/i)).toHaveValue("Old Location");
        });

        it("submits updated estimate with id and version", async () => {
            mockApiRequest.mockResolvedValue(mockEstimateSaveResponse({ id: "est-1", version: "v2" }));

            renderModal({
                initialData: {
                    id: "est-1",
                    version: "v1",
                    client: "Test Client",
                    title: "Old Event",
                    enquiryId: "enq-1",
                    highlvelRequirement: "Old requirements",
                    venue: "Old Venue",
                    location: "Old Location",
                    status: "ENQUIRY_CREATED",
                    gst: 0,
                    serviceCharge: 0,
                    discounts: 0,
                    items: {},
                },
            });

            await waitFor(() => {
                expect(screen.getByLabelText(/event title/i)).toHaveValue("Old Event");
            });

            await userEvent.clear(screen.getByLabelText(/event title/i));
            await userEvent.type(screen.getByLabelText(/event title/i), "New Event");

            fireEvent.click(screen.getByRole("button", { name: /update estimate/i }));

            await waitFor(() => {
                expect(mockApiRequest).toHaveBeenCalledWith("/api/estimates", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: expect.stringContaining(
                        '"id":"est-1","version":"v1"',
                    ),
                });
            });

            expect(baseProps.onSaved).toHaveBeenCalled();
            expect(baseProps.onClose).toHaveBeenCalled();
        });

        it("creates a DRAFT estimate without the source identifiers from an under-review edit", async () => {
            mockApiRequest.mockResolvedValue(mockEstimateSaveResponse({ id: "new-estimate" }));

            const sourceEstimate = {
                id: "est-review",
                version: "v3",
                estimateStatus: "UNDER_CLIENT_REVIEW",
                client: "Test Client",
                clientID: "client-1",
                title: "Review Event",
                enquiryId: "enq-1",
                eventID: "event-1",
                highlvelRequirement: "Requirements",
                venue: "Venue",
                location: "Location",
                status: "ENQUIRY_CREATED",
                fromDate: "2025-07-01T00:00:00.000Z",
                toDate: "2025-07-02T00:00:00.000Z",
                enquiryDate: "2025-06-25T00:00:00.000Z",
                clientPoC: "Client Contact",
                pocContactNumber: "1234567890",
                enquiryPoC: "Internal Contact",
                gst: 18,
                gstType: "CGST_SGST",
                serviceCharge: 10,
                discounts: 25,
                billingAddress: "123 Example Street",
                items: {
                    Audio: [
                        {
                            id: "original-line-id",
                            item: "Speakers",
                            description: "Two way speakers",
                            category: "Audio",
                            subCategory: "Rental",
                            days: 2,
                            quantity: 3,
                            sqft: 3,
                            rate: 50,
                            unitCost: 50,
                            total: 300,
                            vendor: "Sound Vendor",
                            unit: "sets",
                        },
                    ],
                },
            };
            const sourceEstimateBeforeSave = JSON.stringify(sourceEstimate);

            renderModal({
                createNewVersionOnSave: true,
                initialData: sourceEstimate,
            });

            await waitFor(() => {
                expect(screen.getByLabelText(/event title/i)).toHaveValue("Review Event");
                expect(screen.getByTestId("artifacts-section")).toHaveTextContent(
                    "Speakers - 50",
                );
            });

            fireEvent.click(screen.getByRole("button", { name: /save as new estimate/i }));

            await waitFor(() => {
                const [, request] = mockApiRequest.mock.calls.find(
                    ([url]) => url === "/api/estimates",
                ) ?? [];
                expect(request).toBeDefined();
                const payload = JSON.parse(String(request?.body));
                expect(payload).toMatchObject({
                    estimateStatus: "DRAFT",
                    title: "Review Event",
                    highlvelRequirement: "Requirements",
                    enquiryId: "enq-1",
                    client: "Test Client",
                    clientID: "client-1",
                    eventID: "event-1",
                    venue: "Venue",
                    location: "Location",
                    clientPoC: "Client Contact",
                    pocContactNumber: "1234567890",
                    enquiryPoC: "Internal Contact",
                    gst: 18,
                    gstType: "CGST_SGST",
                    serviceCharge: 10,
                    discounts: 25,
                    billingAddress: "123 Example Street",
                });
                expect(payload).not.toHaveProperty("id");
                expect(payload).not.toHaveProperty("version");
                expect(payload.items.Audio).toEqual([
                    expect.objectContaining({
                        item: "Speakers",
                        description: "Two way speakers",
                        category: "Audio",
                        subCategory: "Rental",
                        days: 2,
                        quantity: 3,
                        pricePerItem: 50,
                        finalAmt: 300,
                        vendor: "Sound Vendor",
                        unit: "sets",
                    }),
                ]);
                expect(payload.items.Audio[0]).not.toHaveProperty("id");
                expect(JSON.stringify(sourceEstimate)).toBe(sourceEstimateBeforeSave);
            });
        });
    });

    describe("validation edge cases", () => {
        it.each(["OPEN", "CLOSED", "CANCELLED"])(
            "allows status %s in edit mode",
            async (status) => {
                mockApiRequest.mockResolvedValue(mockEstimateSaveResponse({ id: "est-1" }));

                renderModal({
                    initialData: {
                        id: "est-1",
                        client: "Test Client",
                        title: "Event",
                        enquiryId: "enq-1",
                        highlvelRequirement: "Requirement",
                        venue: "Venue",
                        location: "Location",
                        status,
                        gst: 0,
                        serviceCharge: 0,
                        discounts: 0,
                        items: {},
                    },
                });

                await waitFor(() => {
                    expect(screen.getByLabelText(/event title/i)).toBeInTheDocument();
                });

                fireEvent.click(screen.getAllByRole("button", { name: /update estimate/i })[0]);

                await waitFor(() => {
                    expect(mockApiRequest).toHaveBeenCalledWith("/api/estimates", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: expect.stringContaining(`"status":"${status}"`),
                    });
                });

                vi.clearAllMocks();
            },
        );

        it("blocks submit when title is empty", async () => {
            renderModal({
                initialData: {
                    id: "est-1",
                    client: "Test Client",
                    title: "",
                    enquiryId: "enq-1",
                    highlvelRequirement: "Some requirement",
                    venue: "Venue",
                    location: "Location",
                    status: "ENQUIRY_CREATED",
                    gst: 0,
                    serviceCharge: 0,
                    discounts: 0,
                    items: {},
                },
            });

            await waitFor(() => {
                expect(screen.getByLabelText(/event title/i)).toBeInTheDocument();
            });

            fireEvent.click(screen.getAllByRole("button", { name: /update estimate/i })[0]);

            // API should not be called due to validation error
            await waitFor(() => {
                expect(mockApiRequest).not.toHaveBeenCalledWith(
                    "/api/estimates",
                    expect.objectContaining({ method: "POST" }),
                );
            });
        });

        it("blocks submit when venue is empty", async () => {
            renderModal({
                initialData: {
                    id: "est-1",
                    client: "Test Client",
                    title: "Event",
                    enquiryId: "enq-1",
                    highlvelRequirement: "Some requirement",
                    venue: "",
                    location: "Location",
                    status: "ENQUIRY_CREATED",
                    gst: 0,
                    serviceCharge: 0,
                    discounts: 0,
                    items: {},
                },
            });

            await waitFor(() => {
                expect(screen.getByLabelText(/venue/i)).toBeInTheDocument();
            });

            fireEvent.click(screen.getAllByRole("button", { name: /update estimate/i })[0]);

            expect(mockApiRequest).not.toHaveBeenCalledWith(
                "/api/estimates",
                expect.objectContaining({ method: "POST" }),
            );
        });

        it("blocks submit when highlvelRequirement is empty", async () => {
            renderModal({
                initialData: {
                    id: "est-1",
                    client: "Test Client",
                    title: "Event",
                    enquiryId: "enq-1",
                    highlvelRequirement: "",
                    venue: "Venue",
                    location: "Location",
                    status: "ENQUIRY_CREATED",
                    gst: 0,
                    serviceCharge: 0,
                    discounts: 0,
                    items: {},
                },
            });

            await waitFor(() => {
                expect(screen.getByLabelText(/project summary/i)).toBeInTheDocument();
            });

            fireEvent.click(screen.getAllByRole("button", { name: /update estimate/i })[0]);

            expect(mockApiRequest).not.toHaveBeenCalledWith(
                "/api/estimates",
                expect.objectContaining({ method: "POST" }),
            );
        });

        it("rejects negative item rate", async () => {
            renderModal({
                initialData: {
                    id: "est-1",
                    client: "Test Client",
                    title: "Event",
                    enquiryId: "enq-1",
                    highlvelRequirement: "Requirement",
                    venue: "Venue",
                    location: "Location",
                    status: "ENQUIRY_CREATED",
                    gst: 0,
                    serviceCharge: 0,
                    discounts: 0,
                    items: {},
                },
            });

            await waitFor(() => {
                expect(screen.getByTestId("artifacts-section")).toBeInTheDocument();
            });

            fireEvent.click(screen.getByTestId("add-item"));

            fireEvent.click(screen.getAllByRole("button", { name: /update estimate/i })[0]);

            // Negative rate should be blocked by validation
            expect(mockApiRequest).not.toHaveBeenCalledWith(
                "/api/estimates",
                expect.objectContaining({ method: "POST" }),
            );
        });
    });

    describe("error handling", () => {
        it("does not call onClose when save fails", async () => {
            mockApiRequest.mockResolvedValueOnce(mockClientSummaryResponse());
            mockApiRequest.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: "Error",
                text: vi.fn().mockResolvedValue("Server error"),
            } as unknown as Response);

            renderModal({
                initialData: {
                    id: "est-1",
                    client: "Test Client",
                    title: "Event",
                    enquiryId: "enq-1",
                    highlvelRequirement: "Requirement",
                    venue: "Venue",
                    location: "Location",
                    status: "ENQUIRY_CREATED",
                    gst: 0,
                    serviceCharge: 0,
                    discounts: 0,
                    items: {},
                },
            });

            await waitFor(() => {
                expect(screen.getByLabelText(/event title/i)).toBeInTheDocument();
            });

            fireEvent.click(screen.getAllByRole("button", { name: /update estimate/i })[0]);

            await waitFor(() => {
                expect(baseProps.onClose).not.toHaveBeenCalled();
            });
        });
    });

    describe("cancel flow", () => {
        it("calls onClose when Cancel is clicked without submitting", async () => {
            renderModal();

            fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

            expect(baseProps.onClose).toHaveBeenCalledTimes(1);
            expect(mockApiRequest).not.toHaveBeenCalledWith(
                "/api/estimates",
                expect.objectContaining({ method: "POST" }),
            );
        });
    });
});
