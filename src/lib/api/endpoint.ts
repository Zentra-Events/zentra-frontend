// Centralized API endpoint definitions for Zentra

export const API_ENDPOINTS = {
    enquiries: {
        list: "/api/enquiries",
        detail: (id: string | number) => `/api/enquiries/${id}`,
        clientSummary: "/api/enquiries/client-enquiry-summary",
        clone: "/api/enquiries/clone",
    },
    events: {
        list: "/api/events",
        // Event detail now queried via /by-eventid?eventID=<id>
        detail: (id: string | number) => `/api/events/by-eventid?eventID=${id}`,
        update: (id: string | number) => `/api/events/${id}`,
        versions: (eventID: string | number) => `/api/events/versions?eventID=${eventID}`,
        updateStatus: (eventID: string | number, versionID: string | number, status: string) =>
            `/api/events/updateStatus?eventID=${eventID}&versionID=${versionID}&status=${status}`,
        mergeEstimate: "/api/events/merge-estimate",
        sendInvoice: "/api/events/send-invoice",
        clone: "/api/events/clone",
    },
    clients: {
        list: "/api/clients",
        detail: (id: string | number) => `/api/clients/${id}`,
        get: (id: string | number) => `/api/clients/get?id=${id}`,
    },
    checklists: {
        list: "/api/checklists",
        detail: (id: string | number) => `/api/checklists/${id}`,
    },
    inventory: {
        list: "/api/inventory",
        detail: (id: string | number) => `/api/inventory/${id}`,
        checkUsage: (id: string | number) => `/api/inventory/check-usage/${id}`,
        dropdown: "/api/inventory",
    },
    vendors: {
        list: "/api/vendors",
    },
    estimates: {
        list: "/api/estimates",
        detail: (id: string | number) => `/api/estimates/${id}`,
        byEnquiry: (id: string | number) => `/api/estimates/by-enquiry/${id}`,
        netTotal: (eventId: string | number) => `/api/estimates/net-total/${eventId}`,
    },
    auth: {
        login: "/api/login",
        forgotPassword: "/api/forgot-password",
    },
    notifications: {
        list: "/api/notifications",
    },
    users: "/api/users",
    dashboard: {
        summary: "/api/dashboard/summary",
        calendarEvents: "/api/dashboard/calendar-events",
        upcomingEvents: "/api/dashboard/upcoming-events",
        recentClients: "/api/dashboard/recent-clients",
        recentEstimates: "/api/dashboard/recent-estimates",
        recentEnquiries: "/api/dashboard/recent-enquiries",
    },
    bills: {
        list: "/api/bills",
        detail: (id: string | number) => `/api/bills/${id}`,
    },
    expenses: {
        list: "/api/expenses",
        detail: (id: string | number) => `/api/expenses/${id}`,
    },
    reports: {
        summary: "/api/reports/summary",
    },
    notificationsList: {
        list: "/api/notifications",
        markRead: (id: string | number) => `/api/notifications/${id}/read`,
        markAllRead: "/api/notifications/read-all",
    },
};
