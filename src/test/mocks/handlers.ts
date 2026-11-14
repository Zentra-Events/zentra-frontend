import { HttpResponse, http } from "msw";

const API_BASE = "http://localhost:3000";

const USERS_DATA = [
    { id: "u-1", name: "Sujith", role: "admin", phone: "8765432112", email: "sujith@123.com", uid: "sujith_123", status: "active" },
    { id: "u-2", name: "Parvathi", role: "user", phone: "5525252525", email: "parutest@gmail.com", uid: "parvathi", status: "active" },
    { id: "u-3", name: "Ramesh Kumar", role: "customer", phone: "9988776655", email: "ramesh@example.com", uid: "ramesh", status: "inactive" },
    { id: "u-4", name: "Sita Sharma", role: "user", phone: "9123456780", email: "sita@example.com", uid: "sita", status: "active" },
    { id: "u-5", name: "Amit Singh", role: "admin", phone: "9911223344", email: "amit@example.com", uid: "amit", status: "active" },
    { id: "u-6", name: "Neha Patel", role: "customer", phone: "9876543210", email: "neha@example.com", uid: "neha", status: "inactive" },
    { id: "u-7", name: "Vikram Roy", role: "user", phone: "9012345678", email: "vikram@example.com", uid: "vikram", status: "active" },
    { id: "u-8", name: "Ananya Das", role: "user", phone: "9123334455", email: "ananya@example.com", uid: "ananya", status: "active" },
    { id: "u-9", name: "Karan Malhotra", role: "customer", phone: "9988771122", email: "karan@example.com", uid: "karan", status: "inactive" },
    { id: "u-10", name: "Pooja Nair", role: "user", phone: "9001122334", email: "pooja@example.com", uid: "pooja", status: "active" },
];

const CLIENTS_DATA = [
    { id: "c-1", name: "ust", email: null, phone: null, address: null, poc: null, gst: null, pan: null, clientType: null, gstCertificate: null },
    { id: "c-2", name: "tcs", email: null, phone: null, address: null, poc: null, gst: null, pan: null, clientType: null, gstCertificate: null },
    { id: "c-3", name: "Infosys", email: "contact@infosys.com", phone: "9988776655", address: "Bangalore", poc: "Ramesh", gst: "29AAAAA0000A1Z5", pan: "AAAAA0000A", clientType: "CORPORATE", gstCertificate: null },
    { id: "c-4", name: "Wipro", email: "hello@wipro.com", phone: "9123456780", address: "Pune", poc: "Sita", gst: null, pan: null, clientType: "CORPORATE", gstCertificate: null },
    { id: "c-5", name: "Acme Corp", email: "sales@acme.com", phone: "9911223344", address: "Delhi", poc: "Amit", gst: null, pan: null, clientType: "CORPORATE", gstCertificate: null },
    { id: "c-6", name: "Globex", email: "info@globex.com", phone: "9876543210", address: "Hyderabad", poc: "Neha", gst: null, pan: null, clientType: "OTHER", gstCertificate: null },
    { id: "c-7", name: "Stark Industries", email: "tony@stark.com", phone: "9012345678", address: "Mumbai", poc: "Vikram", gst: null, pan: null, clientType: "CORPORATE", gstCertificate: null },
    { id: "c-8", name: "Wayne Enterprises", email: "bruce@wayne.com", phone: "9123334455", address: "Gotham", poc: "Ananya", gst: null, pan: null, clientType: "OTHER", gstCertificate: null },
    { id: "c-9", name: "Oscorp", email: null, phone: "9988771122", address: "New York", poc: "Karan", gst: null, pan: null, clientType: "CORPORATE", gstCertificate: null },
    { id: "c-10", name: "BuyLarge", email: "help@buylarge.com", phone: "9001122334", address: "Chennai", poc: "Pooja", gst: null, pan: null, clientType: "PERSONAL", gstCertificate: null },
];

function filterUsers(search: string) {
    const q = search.toLowerCase();
    return USERS_DATA.filter(
        u =>
            !q ||
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            u.uid.toLowerCase().includes(q),
    );
}

function filterClients(search: string) {
    const q = search.toLowerCase();
    return CLIENTS_DATA.filter(
        c =>
            !q ||
            c.name.toLowerCase().includes(q) ||
            (c.email && c.email.toLowerCase().includes(q)) ||
            (c.phone && c.phone.includes(q)) ||
            (c.poc && c.poc.toLowerCase().includes(q)),
    );
}

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

    // Users - List (Spring Data page, zero-based page)
    http.get(`${API_BASE}/api/users`, ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get("page")) || 0;
        const size = Number(url.searchParams.get("size")) || 10;
        const search = url.searchParams.get("search") || "";
        const role = url.searchParams.get("role") || "";

        let results = filterUsers(search);
        if (role) {
            results = results.filter(u => u.role.toLowerCase() === role.toLowerCase());
        }

        const start = page * size;
        const content = results.slice(start, start + size);
        return HttpResponse.json({
            content,
            totalElements: results.length,
            totalPages: Math.max(1, Math.ceil(results.length / size)),
            pageable: { pageNumber: page, pageSize: size },
            size,
            number: page,
            numberOfElements: content.length,
            first: page === 0,
            last: start + size >= results.length,
        });
    }),

    // Clients - List (bare JSON array, zero-based page)
    http.get(`${API_BASE}/api/clients`, ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get("page")) || 0;
        const size = Number(url.searchParams.get("size")) || 10;
        const search = url.searchParams.get("search") || "";

        const results = filterClients(search);
        const start = page * size;
        return HttpResponse.json(results.slice(start, start + size));
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
