import { HttpResponse, http } from "msw";

const API_BASE = "http://localhost:3000";

export const handlers = [
    // Auth - Login success
    http.post(`${API_BASE}/api/login`, () => {
        return HttpResponse.json({
            token: "mock-jwt-token",
            tokenType: "Bearer",
            expiresIn: 86400000,
            user: {
                id: "test-user-1",
                name: "Test User",
                email: "test@example.com",
                uid: "uid-123",
                phone: null,
                role: "ADMIN",
                lastLoginTimestamp: null,
            },
        });
    }),

    // Auth - Login failure (invalid credentials)
    http.post(`${API_BASE}/api/login-fail`, () => {
        return HttpResponse.json(
            { message: "Invalid credentials" },
            { status: 401 },
        );
    }),

    // Enquiries - List success
    http.get(`${API_BASE}/api/enquiries`, () => {
        return HttpResponse.json({
            data: [
                {
                    id: "enq-1",
                    title: "Test Enquiry",
                    clientName: "Test Client",
                    status: "pending",
                    createdAt: "2024-01-01T00:00:00Z",
                },
            ],
            total: 1,
        });
    }),

    // Enquiries - Detail
    http.get(`${API_BASE}/api/enquiries/:id`, ({ params }) => {
        return HttpResponse.json({
            id: params.id,
            title: "Test Enquiry",
            clientName: "Test Client",
            status: "pending",
        });
    }),

    // Clients - List
    http.get(`${API_BASE}/api/clients`, () => {
        return HttpResponse.json({
            data: [
                {
                    id: "client-1",
                    name: "Test Client",
                    email: "client@example.com",
                    phone: null,
                },
            ],
        });
    }),

    // Events - List
    http.get(`${API_BASE}/api/events`, () => {
        return HttpResponse.json({
            data: [
                {
                    id: "event-1",
                    title: "Test Event",
                    eventDate: "2024-06-01",
                    status: "confirmed",
                },
            ],
        });
    }),

    // Dashboard - Summary
    http.get(`${API_BASE}/api/dashboard/summary`, () => {
        return HttpResponse.json({
            totalEvents: 10,
            totalRevenue: 50000,
            pendingEnquiries: 3,
            upcomingEvents: 5,
        });
    }),

    // Auth - 401 Unauthorized
    http.get(`${API_BASE}/api/protected`, () => {
        return HttpResponse.json({ message: "Unauthorized" }, { status: 401 });
    }),

    // Validation error - 422
    http.post(`${API_BASE}/api/validation-error`, () => {
        return HttpResponse.json(
            {
                message: "Validation failed",
                errors: {
                    email: ["Invalid email format"],
                    password: ["Password too short"],
                },
            },
            { status: 422 },
        );
    }),

    // Server error - 500
    http.get(`${API_BASE}/api/server-error`, () => {
        return HttpResponse.json(
            { message: "Internal server error" },
            { status: 500 },
        );
    }),

    // Network failure handler (to be used with msw's network error)
    http.get(`${API_BASE}/api/network-error`, () => {
        return new HttpResponse(null, { status: 503, statusText: "Service Unavailable" });
    }),
];

export const errorHandlers = [
    http.post(`${API_BASE}/api/login`, () => {
        return HttpResponse.json(
            { message: "Invalid credentials" },
            { status: 401 },
        );
    }),
    http.get(`${API_BASE}/api/enquiries`, () => {
        return HttpResponse.json(
            { message: "Internal server error" },
            { status: 500 },
        );
    }),
];
