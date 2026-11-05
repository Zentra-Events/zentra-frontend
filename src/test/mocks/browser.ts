import { HttpResponse, http } from "msw";
import { setupWorker } from "msw/browser";

export const browserHandlers = [
    http.post("http://localhost:3000/api/login", () => {
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
    http.get("http://localhost:3000/api/enquiries", () => {
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
        });
    }),
];

export const worker = setupWorker(...browserHandlers);
