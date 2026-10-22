"use client";

import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { toList } from "@/lib/utils";
import type { Vendor } from "@/types/vendor";

export async function fetchVendors(): Promise<Vendor[]> {
    const res = await apiRequest(API_ENDPOINTS.vendors.list);
    if (!res.ok) throw new Error(`Failed to fetch vendors (status ${res.status})`);
    return toList<Vendor>(await res.json());
}
