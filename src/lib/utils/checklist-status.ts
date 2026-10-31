import { statusOptions } from "@/components/checklist-modal/types";

export function getChecklistStatusLabel(
    status?: string,
): string {
    const statusLabel = statusOptions.find(({value})=>value === status)?.label
    if (!statusLabel) return "Pending";
    return statusLabel
}