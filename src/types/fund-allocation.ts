/**
 * Fund Allocation types aligned with the `/fund-allocations` backend contract
 * (see swagger `FundAllocation` schema).
 */
export interface FundAllocation {
    id: string;
    assigneeUserId: string;
    eventId: string;
    eventName: string;
    assignedAmount: number;
    expenseAmount: number;
    allocatedDate: string | null;
    assignedUserId: string;
    balanceToPay: number;
}

export interface FundAllocationFormValues {
    eventId: string;
    eventName?: string;
    assigneeUserId: string;
    assignedAmount: string;
    allocatedDate: string | null;
}

export interface FundAllocationFilters {
    search: string;
    assignee: string;
}

export interface FundAllocationSummary {
    totalAllocated: number;
    totalExpenseAmount: number;
    totalBalanceToPay: number;
}
