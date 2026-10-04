"use client";

import { ClipboardList, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChecklistSummary } from "./types";

export interface ChecklistFooterProps {
    summary: ChecklistSummary;
    saving: boolean;
    onCancel: () => void;
    onSave: () => void;
}

/**
 * Sticky footer for the Execution Checklist modal.
 *
 * Shows Total Items / Done / Remaining with icons on the left and Cancel /
 * Save Checklist on the right. Rendered outside the scrolling panel so it stays
 * pinned to the bottom of the modal.
 */
export function ChecklistFooter({
    summary,
    saving,
    onCancel,
    onSave,
}: ChecklistFooterProps) {
    return (
        <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-surface px-5 py-3 sm:h-auto sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground">
                <span className="flex items-center gap-2">
                    <ClipboardList size={17} />
                    Total Items:{" "}
                    <b className="text-foreground tabular-nums">{summary.total}</b>
                </span>
                <span className="flex items-center gap-2 text-success">
                    <CheckCircle2 size={17} />
                    Done:{" "}
                    <b className="text-foreground tabular-nums">
                        {summary.completed}
                    </b>
                </span>
                <span className="flex items-center gap-2">
                    <Clock size={17} />
                    Remaining:{" "}
                    <b className="text-foreground tabular-nums">
                        {summary.remaining}
                    </b>
                </span>
            </div>

            <div className="flex items-center gap-3">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onCancel}
                    disabled={saving}
                >
                    Cancel
                </Button>
                <Button
                    size="sm"
                    variant="primary"
                    onClick={onSave}
                    disabled={saving}
                    isLoading={saving}
                >
                    {saving ? "Saving..." : "Save Checklist"}
                </Button>
            </div>
        </div>
    );
}
