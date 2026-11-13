import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from "vitest";
import { HttpResponse, http } from "msw";
import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";

import { server } from "@/test/mocks/server";
import { useExpenses, EXPENSE_STATUS_META } from "@/hooks/useExpenses";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import type { Expense } from "@/types/expense";

const API_BASE = "http://localhost:3000";

const expenseA: Expense = {
    id: "exp-1",
    itemName: "Catering",
    eventID: "event-1",
    amount: 5000,
    comments: "Lunch",
    poc: "John",
    createdDate: "2026-11-01",
    expenseStatus: "APPROVED",
};

const expenseB: Expense = {
    id: "exp-2",
    itemName: "Decor",
    eventID: "event-1",
    amount: 3000,
    expenseStatus: "ESTIMATE_SUBMITTED",
};

const expenseNoId: Expense = {
    itemName: "Orphan expense",
    amount: 100,
    expenseStatus: "REJECTED",
};

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

describe("EXPENSE_STATUS_META", () => {
    it("defines label and variant for every known status", () => {
        expect(EXPENSE_STATUS_META.ESTIMATE_SUBMITTED).toEqual({
            label: "Submitted",
            variant: "warning",
        });
        expect(EXPENSE_STATUS_META.ESTIMATE_REVIEW).toEqual({
            label: "Under Review",
            variant: "warning",
        });
        expect(EXPENSE_STATUS_META.ESTIMATE_APPROVED).toEqual({
            label: "Approved",
            variant: "success",
        });
        expect(EXPENSE_STATUS_META.ESTIMATE_REJECTED).toEqual({
            label: "Rejected",
            variant: "danger",
        });
        expect(EXPENSE_STATUS_META.APPROVED).toEqual({
            label: "Approved",
            variant: "success",
        });
        expect(EXPENSE_STATUS_META.REJECTED).toEqual({
            label: "Rejected",
            variant: "danger",
        });
    });
});

describe("fetching expenses", () => {
    it("fetches all expenses on mount by default", async () => {
        server.use(
            http.get(
                `${API_BASE}${API_ENDPOINTS.expenses.list}`,
                () => HttpResponse.json([expenseA, expenseB]),
            ),
        );

        const { result } = renderHook(() => useExpenses());

        await waitFor(() => expect(result.current.expenses).toHaveLength(2));
        expect(result.current.expenses).toEqual([expenseA, expenseB]);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it("fetches event expenses when eventID is provided", async () => {
        let listCalled = false;
        server.use(
            http.get(`${API_BASE}/api/expenses`, () => {
                listCalled = true;
                return HttpResponse.json([]);
            }),
            http.get(
                `${API_BASE}${API_ENDPOINTS.expenses.byEvent("event-1")}`,
                () => HttpResponse.json([expenseA]),
            ),
        );

        const { result } = renderHook(() => useExpenses({ eventID: "event-1" }));

        await waitFor(() => expect(result.current.expenses).toHaveLength(1));
        expect(result.current.expenses).toEqual([expenseA]);
        expect(listCalled).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it("does not fetch on mount when fetchOnMount is false", async () => {
        server.use(
            http.get(`${API_BASE}${API_ENDPOINTS.expenses.list}`, () => {
                throw new Error("list endpoint must not be called");
            }),
        );

        const { result } = renderHook(() => useExpenses({ fetchOnMount: false }));

        expect(result.current.expenses).toEqual([]);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it("refetch reloads expenses and clears a previous error", async () => {
        let shouldFail = true;
        server.use(
            http.get(`${API_BASE}${API_ENDPOINTS.expenses.list}`, () => {
                if (shouldFail) {
                    return HttpResponse.json({ message: "down" }, { status: 500 });
                }
                return HttpResponse.json([expenseA]);
            }),
        );

        const { result } = renderHook(() => useExpenses());

        await waitFor(() => expect(result.current.error).toBeTruthy());
        expect(result.current.expenses).toEqual([]);

        shouldFail = false;
        await act(async () => {
            await result.current.refetch();
        });

        expect(result.current.expenses).toEqual([expenseA]);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it("sets error and clears expenses when the list API fails", async () => {
        server.use(
            http.get(`${API_BASE}${API_ENDPOINTS.expenses.list}`, () =>
                HttpResponse.json({ message: "down" }, { status: 500 }),
            ),
        );

        const { result } = renderHook(() => useExpenses());

        await waitFor(() => expect(result.current.error).toBeTruthy());
        expect(result.current.expenses).toEqual([]);
        expect(result.current.loading).toBe(false);
    });
});

describe("create / edit form", () => {
    it("openForm opens the form and optionally selects an expense to edit", () => {
        const { result } = renderHook(() => useExpenses());

        act(() => {
            result.current.openForm();
        });
        expect(result.current.formOpen).toBe(true);
        expect(result.current.editingExpense).toBeNull();

        act(() => {
            result.current.openForm(expenseA);
        });
        expect(result.current.formOpen).toBe(true);
        expect(result.current.editingExpense).toEqual(expenseA);
    });

    it("closeForm closes the form and clears the editing expense", () => {
        const { result } = renderHook(() => useExpenses());

        act(() => {
            result.current.openForm(expenseA);
        });
        act(() => {
            result.current.closeForm();
        });
        expect(result.current.formOpen).toBe(false);
        expect(result.current.editingExpense).toBeNull();
    });

    it("handleFormSaved closes the form, refetches, and invokes onSaved", async () => {
        const onSaved = vi.fn();
        server.use(
            http.get(
                `${API_BASE}${API_ENDPOINTS.expenses.list}`,
                () => HttpResponse.json([expenseA]),
            ),
        );

        const { result } = renderHook(() =>
            useExpenses({ fetchOnMount: false, onSaved }),
        );

        act(() => {
            result.current.openForm(expenseA);
        });

        await act(async () => {
            await result.current.handleFormSaved();
        });

        expect(result.current.formOpen).toBe(false);
        expect(result.current.editingExpense).toBeNull();
        expect(onSaved).toHaveBeenCalledTimes(1);
        expect(result.current.expenses).toEqual([expenseA]);
        expect(result.current.loading).toBe(false);
    });
});
describe("delete expense", () => {
    beforeEach(() => {
        vi.spyOn(toast, "success");
        vi.spyOn(toast, "error");
    });

    it("selectForDelete sets the delete target", () => {
        const { result } = renderHook(() => useExpenses());

        act(() => {
            result.current.selectForDelete(expenseA);
        });
        expect(result.current.deleteTarget).toEqual(expenseA);
    });

    it("cancelDelete clears the delete target and deleting flag", () => {
        const { result } = renderHook(() => useExpenses());

        act(() => {
            result.current.selectForDelete(expenseA);
        });
        act(() => {
            result.current.cancelDelete();
        });
        expect(result.current.deleteTarget).toBeNull();
        expect(result.current.deleting).toBe(false);
    });

    it("selectForDelete reports an error and keeps no target when the expense has no id", () => {
        const { result } = renderHook(() => useExpenses());

        act(() => {
            result.current.selectForDelete(expenseNoId);
        });
        expect(toast.error).toHaveBeenCalledWith(
            "This expense cannot be deleted because the API did not return an expense ID.",
        );
        expect(result.current.deleteTarget).toBeNull();
    });

    it("confirmDelete deletes the expense, refetches, and invokes onSaved", async () => {
        const onSaved = vi.fn();
        let deleteCalled = false;
        server.use(
            http.get(
                `${API_BASE}${API_ENDPOINTS.expenses.list}`,
                () => HttpResponse.json([expenseB]),
            ),
            http.delete(`${API_BASE}/api/expenses`, () => {
                deleteCalled = true;
                return HttpResponse.json({});
            }),
        );

        const { result } = renderHook(() => useExpenses({ onSaved }));

        act(() => {
            result.current.selectForDelete(expenseA);
        });

        await act(async () => {
            await result.current.confirmDelete();
        });

        expect(deleteCalled).toBe(true);
        expect(toast.success).toHaveBeenCalledWith("Expense deleted successfully");
        expect(result.current.deleteTarget).toBeNull();
        expect(result.current.deleting).toBe(false);
        expect(onSaved).toHaveBeenCalledTimes(1);
        expect(result.current.expenses).toEqual([expenseB]);
        expect(result.current.loading).toBe(false);
    });

    it("confirmDelete shows an error and keeps the target when deletion fails", async () => {
        server.use(
            http.get(
                `${API_BASE}${API_ENDPOINTS.expenses.list}`,
                () => HttpResponse.json([expenseA]),
            ),
            http.delete(`${API_BASE}/api/expenses`, () =>
                HttpResponse.json({ message: "gone" }, { status: 500 }),
            ),
        );

        const { result } = renderHook(() => useExpenses());

        act(() => {
            result.current.selectForDelete(expenseA);
        });

        await act(async () => {
            await result.current.confirmDelete();
        });

        expect(toast.error).toHaveBeenCalledWith(
            "Failed to delete expense. Please try again.",
        );
        expect(result.current.deleteTarget).toEqual(expenseA);
        expect(result.current.deleting).toBe(false);
        expect(result.current.expenses).toEqual([expenseA]);
    });

    it("confirmDelete does nothing when there is no delete target", async () => {
        server.use(
            http.get(
                `${API_BASE}${API_ENDPOINTS.expenses.list}`,
                () => HttpResponse.json([]),
            ),
            http.delete(`${API_BASE}/api/expenses`, () => {
                throw new Error("delete endpoint must not be called");
            }),
        );

        const { result } = renderHook(() => useExpenses());

        await act(async () => {
            await result.current.confirmDelete();
        });

        expect(result.current.deleteTarget).toBeNull();
        expect(result.current.deleting).toBe(false);
        expect(result.current.expenses).toEqual([]);
    });
});

describe("formatters and status metadata", () => {
    it("formatAmount formats numbers and numeric strings", () => {
        const { result } = renderHook(() => useExpenses());

        expect(result.current.formatAmount(5000)).toContain("5,000");
        expect(result.current.formatAmount("1234.5")).toContain("1,234");
        expect(result.current.formatAmount(0)).toContain("0");
    });

    it("formatAmount returns an em dash for invalid values", () => {
        const { result } = renderHook(() => useExpenses());

        expect(result.current.formatAmount(undefined)).toBe("—");
        expect(result.current.formatAmount(null)).toBe("—");
        expect(result.current.formatAmount("abc")).toBe("—");
        expect(result.current.formatAmount({})).toBe("—");
        expect(result.current.formatAmount(NaN)).toBe("—");
        expect(result.current.formatAmount(Infinity)).toBe("—");
    });

    it("formatDate formats dates and returns an em dash for empty values", () => {
        const { result } = renderHook(() => useExpenses());

        expect(result.current.formatDate("2026-11-01")).toContain("2026");
        expect(result.current.formatDate("2026-11-01")).toContain("Nov");
        expect(result.current.formatDate(undefined)).toBe("—");
        expect(result.current.formatDate("")).toBe("—");
    });

    it("getStatusMeta returns known labels and variants", () => {
        const { result } = renderHook(() => useExpenses());

        expect(result.current.getStatusMeta("APPROVED")).toEqual({
            label: "Approved",
            variant: "success",
        });
        expect(result.current.getStatusMeta("ESTIMATE_SUBMITTED")).toEqual({
            label: "Submitted",
            variant: "warning",
        });
        expect(result.current.getStatusMeta("ESTIMATE_REVIEW")).toEqual({
            label: "Under Review",
            variant: "warning",
        });
        expect(result.current.getStatusMeta("REJECTED")).toEqual({
            label: "Rejected",
            variant: "danger",
        });
        expect(result.current.getStatusMeta(undefined)).toEqual({
            label: "",
            variant: "default",
        });
        expect(result.current.getStatusMeta("UNKNOWN_STATUS")).toEqual({
            label: "UNKNOWN_STATUS",
            variant: "default",
        });
    });

    it("buildActionItems returns edit and delete items for an expense with an id", () => {
        const { result } = renderHook(() => useExpenses());

        const items = result.current.buildActionItems(expenseA);
        expect(items).toHaveLength(2);
        expect(items[0]).toMatchObject({
            key: "edit",
            label: "Edit",
            scopes: ["w:expenses", "a:expenses"],
        });
        expect(items[1]).toMatchObject({
            key: "delete",
            label: "Delete",
            scopes: ["w:expenses", "a:expenses"],
        });

        act(() => {
            items[0].onClick?.();
        });
        expect(result.current.formOpen).toBe(true);
        expect(result.current.editingExpense).toEqual(expenseA);

        act(() => {
            items[1].onClick?.();
        });
        expect(result.current.deleteTarget).toEqual(expenseA);
    });

    it("buildActionItems returns an empty array for an expense without an id", () => {
        const { result } = renderHook(() => useExpenses());

        expect(result.current.buildActionItems(expenseNoId)).toEqual([]);
    });
});

