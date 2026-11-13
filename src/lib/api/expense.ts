"use client";

import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { toList } from "@/lib/utils";
import type { Expense, ExpenseSummary } from "@/types/expense";

/* ------------------------------------------------------------------ */
/*  Expense API service                                               */
/* ------------------------------------------------------------------ */

/**
 * Normalize a list payload into an array of expenses.
 *
 * The backend may return the collection directly as an array, or wrap it in a
 * common envelope (`data` / `content` / `items` / `expenses`). We support both
 * so the UI keeps working regardless of the deployment.
 */
function toExpenseList(payload: unknown): Expense[] {
    return toList<Expense>(payload, ["expenses"]);
}

type ExpensePayload = Omit<Expense, "id" | "receipt" | "receiptFileName" | "receiptContentType">;

/** Fetch expenses across all events (global listing). */
export async function fetchAllExpenses(): Promise<Expense[]> {
    const res = await apiRequest(API_ENDPOINTS.expenses.list);
    if (!res.ok) {
        throw new Error(`Failed to fetch expenses (status ${res.status})`);
    }
    const data = (await res.json()) as unknown;
    return toExpenseList(data);
}

/** Fetch expenses for a specific event. */
export async function fetchEventExpenses(eventID: string): Promise<Expense[]> {
    const res = await apiRequest(API_ENDPOINTS.expenses.byEvent(eventID));
    if (!res.ok) {
        throw new Error(`Failed to fetch expenses (status ${res.status})`);
    }
    const data = (await res.json()) as unknown;
    return toExpenseList(data);
}

/** Fetch the aggregated total expense for an event and point of contact. */
export async function fetchExpenseTotal(
    eventID: string,
    poc: string,
): Promise<ExpenseSummary[]> {
    const res = await apiRequest(API_ENDPOINTS.expenses.total(eventID, poc));
    if (!res.ok) {
        throw new Error(`Failed to fetch expense total (status ${res.status})`);
    }
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as ExpenseSummary[]) : [];
}

/** Create a new expense. */
export async function createExpense(body: ExpensePayload): Promise<Response> {
    return apiRequest(API_ENDPOINTS.expenses.list, {
        method: "POST",
        body: JSON.stringify(body),
    });
}

/** Update an existing expense. */
export async function updateExpense(
    id: string | number,
    body: ExpensePayload,
): Promise<Response> {
    return apiRequest(API_ENDPOINTS.expenses.update(id), {
        method: "PUT",
        body: JSON.stringify(body),
    });
}

/** Upload or replace an expense receipt. */
export async function uploadExpenseReceipt(
    id: string | number,
    file: File,
): Promise<Response> {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest(API_ENDPOINTS.expenses.receipt(id), {
        method: "POST",
        body: formData,
    });
}

/** Fetch an expense receipt as raw bytes from the backend. */
export async function fetchExpenseReceipt(id: string | number): Promise<Response> {
    return apiRequest(API_ENDPOINTS.expenses.receipt(id), {
        method: "GET",
    });
}

/** Remove an expense receipt without changing the expense details. */
export async function deleteExpenseReceipt(id: string | number): Promise<Response> {
    return apiRequest(API_ENDPOINTS.expenses.receipt(id), {
        method: "DELETE",
    });
}

/** Delete an expense by ID. */
export async function deleteExpense(id: string | number): Promise<Response> {
    return apiRequest(API_ENDPOINTS.expenses.delete(id), {
        method: "DELETE",
    });
}