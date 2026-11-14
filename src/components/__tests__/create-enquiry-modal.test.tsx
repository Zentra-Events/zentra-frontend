import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiRequest } from "@/lib/api/api-client";
import CreateEnquiryModal from "@/components/create-enquiry-modal";

vi.mock("@/hooks/useClients", () => ({
    useClients: vi.fn(() => ({
        clients: [{ id: "client-1", name: "Test Client", email: "a@b.com", phone: null }],
        loading: false,
        error: null,
        refresh: vi.fn(),
    })),
}));

vi.mock("@/hooks/useSearchClients", () => ({
    useSearchClients: vi.fn(() => ({
        clients: [{ id: "client-1", name: "Test Client", email: "a@b.com", phone: null }],
        loading: false,
        error: null,
        setSearch: vi.fn(),
        hasMore: false,
        loadMore: vi.fn(),
        reset: vi.fn(),
    })),
}));

vi.mock("@/hooks/useUsers", () => ({
    useUsers: vi.fn(() => ({
        users: [],
        loading: false,
        error: null,
        refresh: vi.fn(),
        addUser: vi.fn(),
        updateUser: vi.fn(),
        deleteUser: vi.fn(),
        setUsers: vi.fn(),
    })),
}));

vi.mock("@/hooks/useSearchUsers", () => ({
    useSearchUsers: vi.fn(() => ({
        users: [],
        loading: false,
        error: null,
        search: "",
        setSearch: vi.fn(),
        hasMore: false,
        loadMore: vi.fn(),
        reset: vi.fn(),
    })),
}));

vi.mock("@/lib/api/api-client", () => ({
    apiRequest: vi.fn(),
}));

vi.mock("@/components/ui/formik-field-creatable-select", () => ({
    FormikFieldCreatableSelect: ({
        name,
        options,
        value,
        onChange,
    }: {
        name: string;
        options: { value: string; label: string }[];
        value: { value: string; label: string } | null;
        onChange: (v: unknown) => void;
    }) => (
        <select
            name={name}
            aria-label="Client"
            onChange={e => onChange((e.target as HTMLSelectElement).value)}
            defaultValue={value ? value.value : ""}
        >
            <option value="">Select a client</option>
            {options.map(o => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    ),
}));

const mockApiRequest = vi.mocked(apiRequest);

function mockJsonResponse(body: unknown, ok = true, status = 200) {
    return {
        ok,
        status,
        statusText: ok ? "OK" : "Error",
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue(body),
    } as unknown as Response;
}

const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    onSaveSuccess: vi.fn(),
};

beforeEach(() => {
    vi.clearAllMocks();
    mockApiRequest.mockResolvedValue(
        mockJsonResponse({ id: "enq-1", title: "Saved Enquiry", clientName: "Test Client" }),
    );
});

function renderModal(props: Partial<Parameters<typeof CreateEnquiryModal>[0]> = {}) {
    return render(<CreateEnquiryModal {...baseProps} {...props} />);
}

const submitButtonName = (isEdit?: boolean) =>
    isEdit ? /save changes/i : /create enquiry/i;

describe("CreateEnquiryModal - create flow", () => {
    it("submits a new enquiry, POSTs to API, and invokes callbacks", async () => {
        const user = userEvent.setup();
        renderModal({ mode: "create" });

        await user.type(screen.getByLabelText(/event title/i), "Annual Day Celebration");
        await user.type(screen.getByLabelText(/location/i), "Hyderabad");
        await user.type(screen.getByLabelText(/venue/i), "Grand Ballroom");
        await user.type(
            screen.getByRole("textbox", { name: /requirements/i }),
            "Catering for 200 guests",
        );
        await user.type(screen.getByLabelText(/contact mobile number/i), "9876543210");

        // Select existing client from mocked creatable select (now a native select)
        await user.selectOptions(screen.getByRole("combobox", { name: "Client" }), "client-1");

        await user.click(screen.getByRole("button", { name: submitButtonName() }));

        await waitFor(() => {
            expect(mockApiRequest).toHaveBeenCalled();
        });

        const postCall = mockApiRequest.mock.calls.find(
            ([url]) => url === "/api/enquiries",
        );
        expect(postCall).toBeDefined();
        const body = JSON.parse(postCall![1]!.body as string);
        expect(body.eventName).toBe("Annual Day Celebration");
        expect(body.location).toBe("Hyderabad");
        expect(body.venue).toBe("Grand Ballroom");
        expect(body.clientID).toBe("client-1");
        expect(body.ennquiryStatus).toBe("NEW_LEAD");

        expect(baseProps.onSubmit).toHaveBeenCalledTimes(1);
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
        expect(baseProps.onSaveSuccess).toHaveBeenCalled();
    });

    it("shows validation error and does not call API when required fields are missing", async () => {
        const user = userEvent.setup();
        renderModal({ mode: "create" });

        await user.click(screen.getByRole("button", { name: submitButtonName() }));

        // Formik blocks submission on validation errors; API must not be called.
        await waitFor(() => {
            expect(mockApiRequest).not.toHaveBeenCalled();
        });
    });
});

describe("CreateEnquiryModal - edit flow", () => {
    const editData = {
        id: "enq-1",
        client: "client-1",
        clientName: "Test Client",
        title: "Old Title",
        venue: "Old Venue",
        location: "Old Location",
        highlvelRequirement: "Old requirements",
        eventType: "CORPORATE" as const,
        enquiryPoCNumber: "9123456789",
        clientPoC: "Jane Doe",
        status: "OPEN",
        ennquiryStatus: "PROSPECT",
        priority: "LOW" as const,
    };

    it("submits an updated enquiry with the enquiry id and invokes callbacks", async () => {
        const user = userEvent.setup();
        renderModal({ mode: "edit", editData });

        await waitFor(() => {
            expect(screen.getByLabelText(/event title/i)).toHaveAttribute("value", "Old Title");
        });

        await user.clear(screen.getByLabelText(/event title/i));
        await user.type(screen.getByLabelText(/event title/i), "New Title");
        await user.click(screen.getByRole("button", { name: submitButtonName(true) }));

        await waitFor(() => {
            expect(mockApiRequest).toHaveBeenCalled();
        });

        const postCall = mockApiRequest.mock.calls.find(
            ([url]) => url === "/api/enquiries",
        );
        expect(postCall).toBeDefined();
        const body = JSON.parse(postCall![1]!.body as string);
        expect(body.id).toBe("enq-1");
        expect(body.eventName).toBe("New Title");
        expect(body.status).toBe("OPEN");
        expect(body.ennquiryStatus).toBe("PROSPECT");

        expect(baseProps.onSubmit).toHaveBeenCalledTimes(1);
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
        expect(baseProps.onSaveSuccess).toHaveBeenCalled();
    });

    it("handles update failure and shows error", async () => {
        const user = userEvent.setup();
        mockApiRequest.mockResolvedValueOnce(mockJsonResponse({ message: "fail" }, false, 500));
        renderModal({ mode: "edit", editData });

        await user.clear(screen.getByLabelText(/event title/i));
        await user.type(screen.getByLabelText(/event title/i), "New Title");
        await user.click(screen.getByRole("button", { name: submitButtonName(true) }));

        await waitFor(() => {
            expect(screen.getByText(/Unable to update enquiry/i)).toBeInTheDocument();
        });
        expect(baseProps.onClose).not.toHaveBeenCalled();
    });
});
