import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from "vitest";
import { HttpResponse, http } from "msw";
import { server } from "@/test/mocks/server";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { useEnquiryDetail } from "@/hooks/useEnquiryDetail";
import { API_ENDPOINTS } from "@/lib/api/endpoint";

const DETAIL_ID = "enq-1";

const detailEnquiry = {
    id: DETAIL_ID,
    title: "Annual Day Celebration",
    clientName: "Test Client",
    status: "pending",
    ennquiryStatus: "NEW_LEAD",
    priority: "HIGH",
    eventID: "event-1",
    fromDate: "2024-01-02",
    toDate: "2024-01-03",
    venue: "Grand Ballroom",
};

function DetailHarness({ id }: { id: string | undefined }) {
    const { enquiry, priority, loading, error, updateFields, updating, refresh, workflowState } =
        useEnquiryDetail(id);

    return (
        <div>
            {loading && <span data-testid="loading">loading</span>}
            {error && <span data-testid="error">{error}</span>}
            {enquiry && (
                <>
                    <span data-testid="enquiry-id">{String(enquiry.id)}</span>
                    <span data-testid="enquiry-title">{enquiry.title}</span>
                    <span data-testid="enquiry-status">{enquiry.ennquiryStatus ?? ""}</span>
                </>
            )}
            {priority !== null && <span data-testid="priority">{priority}</span>}
            <span data-testid="workflow-state">{workflowState}</span>
            <button data-testid="refresh" onClick={() => void refresh()}>
                refresh
            </button>
            <button data-testid="update" onClick={() => void updateFields({ priority: "MEDIUM" })}>
                update
            </button>
            {updating && <span data-testid="updating">updating</span>}
        </div>
    );
}

beforeAll(() => {
    server.listen();
});

afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
});

afterAll(() => {
    server.close();
});

describe("useEnquiryDetail - fetch detail", () => {
    beforeEach(() => {
        server.use(
            http.get(`${API_ENDPOINTS.enquiries.detail(DETAIL_ID)}`, () =>
                HttpResponse.json(detailEnquiry),
            ),
        );
    });

    it("loads enquiry detail on mount and sets loading false", async () => {
        render(<DetailHarness id={DETAIL_ID} />);

        expect(screen.getByTestId("loading")).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
        });

        await waitFor(() => {
            expect(screen.getByTestId("enquiry-id")).toHaveTextContent(DETAIL_ID);
        });
        expect(screen.getByTestId("enquiry-title")).toHaveTextContent("Annual Day Celebration");
        expect(screen.getByTestId("enquiry-status")).toHaveTextContent("NEW_LEAD");
        expect(screen.getByTestId("priority")).toHaveTextContent("HIGH");
    });

    it("merges pipeline status from response wrapper", async () => {
        server.use(
            http.get(`${API_ENDPOINTS.enquiries.detail(DETAIL_ID)}`, () =>
                HttpResponse.json({
                    data: { ...detailEnquiry, ennquiryStatus: undefined },
                    ennquiryStatus: "PROSPECT",
                }),
            ),
        );

        render(<DetailHarness id={DETAIL_ID} />);

        await waitFor(() => {
            expect(screen.getByTestId("enquiry-status")).toHaveTextContent("PROSPECT");
        });
    });

    it("returns 404 error when enquiry not found", async () => {
        server.use(
            http.get(`${API_ENDPOINTS.enquiries.detail(DETAIL_ID)}`, () =>
                HttpResponse.json({ message: "not found" }, { status: 404 }),
            ),
        );

        render(<DetailHarness id={DETAIL_ID} />);

        await waitFor(() => {
            expect(screen.getByTestId("error")).toHaveTextContent("Enquiry not found");
        });
        expect(screen.queryByTestId("enquiry-title")).not.toBeInTheDocument();
    });

    it("returns generic error on 500", async () => {
        server.use(
            http.get(`${API_ENDPOINTS.enquiries.detail(DETAIL_ID)}`, () =>
                HttpResponse.json({ message: "boom" }, { status: 500 }),
            ),
        );

        render(<DetailHarness id={DETAIL_ID} />);

        await waitFor(() => {
            expect(screen.getByTestId("error")).toBeInTheDocument();
        });
    });

    it("sets loading false and error null when id is undefined", () => {
        render(<DetailHarness id={undefined} />);

        expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
        expect(screen.getByTestId("error")).toHaveTextContent("Missing enquiry id");
    });
});

describe("useEnquiryDetail - updateFields", () => {
    let lastRequestBody: string | null = null;

    beforeEach(() => {
        lastRequestBody = null;
        server.use(
            http.get(`${API_ENDPOINTS.enquiries.detail(DETAIL_ID)}`, () =>
                HttpResponse.json(detailEnquiry),
            ),
            http.post(`${API_ENDPOINTS.enquiries.list}`, async ({ request }) => {
                lastRequestBody = await request.text();
                return HttpResponse.json({ ...detailEnquiry, id: DETAIL_ID }, { status: 200 });
            }),
        );
    });

    it("POSTs full object on updateFields and merges patch", async () => {
        render(<DetailHarness id={DETAIL_ID} />);

        await waitFor(() => {
            expect(screen.getByTestId("enquiry-id")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("update"));

        await waitFor(() => {
            expect(screen.queryByTestId("updating")).not.toBeInTheDocument();
        });

        expect(lastRequestBody).not.toBeNull();
        const body = JSON.parse(lastRequestBody!);
        expect(body.id).toBe(DETAIL_ID);
        expect(body.priority).toBe("MEDIUM");
        expect(body.title).toBe(detailEnquiry.title);
    });

    it("returns false and does not throw on update failure", async () => {
        server.use(
            http.post(`${API_ENDPOINTS.enquiries.list}`, () =>
                HttpResponse.json({ message: "fail" }, { status: 500 }),
            ),
        );

        render(<DetailHarness id={DETAIL_ID} />);

        await waitFor(() => {
            expect(screen.getByTestId("enquiry-id")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTestId("update"));

        await waitFor(() => {
            expect(screen.queryByTestId("updating")).not.toBeInTheDocument();
        });
    });
});

describe("useEnquiryDetail - refresh", () => {
    it("refetches detail when refresh is clicked", async () => {
        let callCount = 0;
        server.use(
            http.get(`${API_ENDPOINTS.enquiries.detail(DETAIL_ID)}`, () => {
                callCount++;
                return HttpResponse.json({ ...detailEnquiry, title: `Updated ${callCount}` });
            }),
        );

        render(<DetailHarness id={DETAIL_ID} />);

        await waitFor(() => {
            expect(screen.getByTestId("enquiry-title")).toHaveTextContent("Updated 1");
        });

        fireEvent.click(screen.getByTestId("refresh"));

        await waitFor(() => {
            expect(screen.getByTestId("enquiry-title")).toHaveTextContent("Updated 2");
        });
    });
});

describe("useEnquiryDetail - workflow state derivation", () => {
    it("sets EVENT_CREATED when event detail API succeeds", async () => {
        server.use(
            http.get(`${API_ENDPOINTS.enquiries.detail(DETAIL_ID)}`, () =>
                HttpResponse.json(detailEnquiry),
            ),
            http.get(`${API_ENDPOINTS.events.detail("event-1")}`, () =>
                HttpResponse.json({ priority: "URGENT" }),
            ),
        );

        render(<DetailHarness id={DETAIL_ID} />);

        await waitFor(() => {
            expect(screen.getByTestId("workflow-state")).toHaveTextContent("EVENT_CREATED");
        });
        expect(screen.getByTestId("priority")).toHaveTextContent("URGENT");
    });

    it("sets ESTIMATE_CREATED when estimates exist and event fails", async () => {
        server.use(
            http.get(`${API_ENDPOINTS.enquiries.detail(DETAIL_ID)}`, () =>
                HttpResponse.json(detailEnquiry),
            ),
            http.get(`${API_ENDPOINTS.events.detail("event-1")}`, () =>
                HttpResponse.json({ message: "not found" }, { status: 404 }),
            ),
            http.get(`${API_ENDPOINTS.estimates.byEnquiry(DETAIL_ID)}`, () =>
                HttpResponse.json({ estimates: [{ id: "est-1" }] }),
            ),
        );

        render(<DetailHarness id={DETAIL_ID} />);

        await waitFor(() => {
            expect(screen.getByTestId("workflow-state")).toHaveTextContent("ESTIMATE_CREATED");
        });
    });

    it("sets empty workflow state when neither event nor estimate succeeds", async () => {
        server.use(
            http.get(`${API_ENDPOINTS.enquiries.detail(DETAIL_ID)}`, () =>
                HttpResponse.json(detailEnquiry),
            ),
            http.get(`${API_ENDPOINTS.events.detail("event-1")}`, () =>
                HttpResponse.json({ message: "not found" }, { status: 404 }),
            ),
            http.get(`${API_ENDPOINTS.estimates.byEnquiry(DETAIL_ID)}`, () =>
                HttpResponse.json({ estimates: [] }),
            ),
        );

        render(<DetailHarness id={DETAIL_ID} />);

        await waitFor(() => {
            expect(screen.getByTestId("workflow-state")).toHaveTextContent("");
        });
    });
});
