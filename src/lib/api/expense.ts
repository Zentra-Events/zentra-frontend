"use client";

import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { toList } from "@/lib/utils";
import type { Expense } from "@/types/expense";

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

/** Create a new expense. */
export async function createExpense(body: unknown): Promise<Response> {
    return apiRequest(API_ENDPOINTS.expenses.list, {
        method: "POST",
        body: typeof body === "string" ? body : JSON.stringify(body),
    });
}

/** Update an existing expense. */
export async function updateExpense(
    id: string | number,
    body: unknown
): Promise<Response> {
    return apiRequest(API_ENDPOINTS.expenses.update(id), {
        method: "PUT",
        body: typeof body === "string" ? body : JSON.stringify(body),
    });
}

/** Delete an expense by ID. */
export async function deleteExpense(id: string | number): Promise<Response> {
    return apiRequest(API_ENDPOINTS.expenses.delete(id), {
        method: "DELETE",
    });
}