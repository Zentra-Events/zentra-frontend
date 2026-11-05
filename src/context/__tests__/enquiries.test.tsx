import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { HttpResponse, http } from "msw";
import { server } from "@/test/mocks/server";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { EnquiriesProvider, useEnquiries } from "@/context/enquiries";

const listEnquiries = [
    {
        id: "enq-1",
        _id: "legacy-1",
        title: "Enquiry One",
        clientName: "Alpha Corp",
        status: "pending",
        createdAt: "2024-01-01T00:00:00Z",
        enquiryDate: "2024-01-01",
        clientPoC: "John Doe",
        poc: "John Doe",
        assignee: "user-1",
        venue: "Hall A",
        eventType: "CORPORATE",
        priority: "HIGH",
    },
    {
        enquiryId: "enq-2",
        client: "Beta LLC",
        name: "Beta LLC",
        date: "2024-02-01",
        state: "IN_PROGRESS",
        owner: "user-2",
        customer_name: "Beta LLC",
        pointOfContact: "Jane Doe",
    },
];

function EnquiriesTestHarness() {
    const { enquiries, loading, error, refresh } = useEnquiries();
    return (
        <div>
            {loading && <span data-testid="loading">loading</span>}
            {error && <span data-testid="error">{error}</span>}
            <span data-testid="count">{enquiries.length}</span>
            {enquiries.map(e => (
                <div key={e.id} data-testid={`enquiry-${e.id}`}>
                    <span data-testid={`id-${e.id}`}>{String(e.id)}</span>
                    <span data-testid={`client-${e.id}`}>{e.client}</span>
                    <span data-testid={`date-${e.id}`}>{e.date}</span>
                    <span data-testid={`poc-${e.id}`}>{e.poc}</span>
                    <span data-testid={`status-${e.id}`}>{e.status}</span>
                    <span data-testid={`assignee-${e.id}`}>{e.assignee}</span>
                </div>
            ))}
            <button data-testid="refresh" onClick={() => void refresh()}>
                refresh
            </button>
        </div>
    );
}

function wrapper({ children }: { children: React.ReactNode }) {
    return <EnquiriesProvider>{children}</EnquiriesProvider>;
}

beforeAll(() => {
    server.listen();
});

afterEach(() => {
    server.resetHandlers();
});

afterAll(() => {
    server.close();
});

describe("EnquiriesProvider - fetch list", () => {
    beforeEach(() => {
        server.use(
            http.get("http://localhost:3000/api/enquiries", () =>
                HttpResponse.json({ data: listEnquiries, total: 2 }),
            ),
        );
    });

    it("loads enquiries and normalizes fields on mount", async () => {
        render(<EnquiriesTestHarness />, { wrapper });

        expect(screen.getByTestId("loading")).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
        });

        expect(screen.getByTestId("count")).toHaveTextContent("2");

        await waitFor(() => {
            expect(screen.getByTestId("enquiry-enq-1")).toBeInTheDocument();
        });
        expect(screen.getByTestId("id-enq-1")).toHaveTextContent("enq-1");
        expect(screen.getByTestId("client-enq-1")).toHaveTextContent("Alpha Corp");
        expect(screen.getByTestId("status-enq-1")).toHaveTextContent("pending");

        // Second item uses legacy field names (enquiryId, name, date, state, owner)
        expect(screen.getByTestId("client-enq-2")).toHaveTextContent("Beta LLC");
    });

    it("normalizes direct array response", async () => {
        server.use(
            http.get("http://localhost:3000/api/enquiries", () =>
                HttpResponse.json([listEnquiries[0]]),
            ),
        );

        render(<EnquiriesTestHarness />, { wrapper });

        await waitFor(() => {
            expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
        });

        expect(screen.getByTestId("count")).toHaveTextContent("1");
    });

    it("normalizes response with enquiries key", async () => {
        server.use(
            http.get("http://localhost:3000/api/enquiries", () =>
                HttpResponse.json({ enquiries: [listEnquiries[0]] }),
            ),
        );

        render(<EnquiriesTestHarness />, { wrapper });

        await waitFor(() => {
            expect(screen.queryByTestId("loading")).not.toBeInTheDocument();
        });

        expect(screen.getByTestId("count")).toHaveTextContent("1");
    });

    it("sets error on 500", async () => {
        server.use(
            http.get("http://localhost:3000/api/enquiries", () =>
                HttpResponse.json({ message: "server error" }, { status: 500 }),
            ),
        );

        render(<EnquiriesTestHarness />, { wrapper });

        await waitFor(() => {
            expect(screen.getByTestId("error")).toBeInTheDocument();
        });
        expect(screen.getByTestId("count")).toHaveTextContent("0");
    });

    it("refetches on refresh", async () => {
        let calls = 0;
        server.use(
            http.get("http://localhost:3000/api/enquiries", () => {
                calls++;
                return HttpResponse.json({
                    data: listEnquiries.slice(0, calls),
                    total: calls,
                });
            }),
        );

        render(<EnquiriesTestHarness />, { wrapper });

        await waitFor(() => {
            expect(screen.getByTestId("count")).toHaveTextContent("1");
        });

        fireEvent.click(screen.getByTestId("refresh"));

        await waitFor(() => {
            expect(screen.getByTestId("count")).toHaveTextContent("2");
        });
    });
});
