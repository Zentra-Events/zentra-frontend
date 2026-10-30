"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DatePickerField } from "@/components/ui/date-picker";
import { UserSelectDropdown } from "@/components/user-select-dropdown";
import { Enquiry } from "@/types/enquiry";
import { parseApiDate, formatShortDateTime } from "@/lib/utils/date";
import { getEnquiryStatusLabel, getEventTypeVariant } from "@/constants/enquiry";
import { EnquiryStatusSelect } from "@/components/enquiries/detail/enquiry-status-select";
import { PrioritySelect } from "@/components/enquiries/detail/priority-select";
import type { EnquiryPriorityValue } from "@/constants/enquiry";

interface EnquiryPropertyPanelProps {
    enquiry: Enquiry;
    priority: EnquiryPriorityValue;
    onPriorityChange: (p: EnquiryPriorityValue) => void;
    onStatusChange: (status: string) => Promise<boolean>;
    onAssigneeChange: (name: string) => Promise<boolean>;
    onDateChange: (field: "fromDate" | "toDate", iso: string) => Promise<boolean>;
    canWrite: boolean;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
            <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
            <span className="min-w-0 text-right text-sm font-medium text-foreground">{children}</span>
        </div>
    );
}

/** Sticky contextual sidebar: quick-edits + workflow summary. */
export function EnquiryPropertyPanel({
    enquiry,
    priority,
    onPriorityChange,
    onStatusChange,
    onAssigneeChange,
    onDateChange,
    canWrite,
}: EnquiryPropertyPanelProps) {
    return (
        <div className="space-y-4 lg:sticky lg:top-4">
            <Card variant="bordered">
                <CardHeader className="px-4 py-2.5 sm:px-5">
                    <h3 className="text-sm font-semibold text-foreground">Details</h3>
                </CardHeader>
                <CardContent className="px-4 py-3 sm:px-5">
                    <div className="divide-y divide-border/60">
                        <Row label="Status">
                            <EnquiryStatusSelect
                                value={enquiry.status}
                                onChange={onStatusChange}
                                disabled={!canWrite}
                            />
                        </Row>
                        <Row label="Priority">
                            <PrioritySelect value={priority} onChange={onPriorityChange} />
                        </Row>
                        <Row label="Type">
                            {enquiry.eventType ? (
                                <Badge variant={getEventTypeVariant(enquiry.eventType)}>
                                    {enquiry.eventType}
                                </Badge>
                            ) : (
                                <span className="text-muted-foreground">—</span>
                            )}
                        </Row>
                        <div className="py-2 first:pt-0 last:pb-0">
                            <span className="mb-1 block text-xs text-muted-foreground">
                                Assigned to
                            </span>
                            {canWrite ? (
                                <UserSelectDropdown
                                    value={enquiry.assignedTo || enquiry.assignee || ""}
                                    onChange={v => void onAssigneeChange(v)}
                                    placeholder="Search or enter assignee name"
                                />
                            ) : (
                                <span className="text-sm font-medium">
                                    {enquiry.assignedTo || enquiry.assignee || "—"}
                                </span>
                            )}
                        </div>
                        <div className="space-y-2 py-2 first:pt-0 last:pb-0">
                            <span className="block text-xs text-muted-foreground">Event dates</span>
                            {canWrite ? (
                                <div className="grid grid-cols-1 gap-2">
                                    <DatePickerField
                                        value={enquiry.fromDate ? parseApiDate(enquiry.fromDate) : null}
                                        onChange={(_d, iso) => void onDateChange("fromDate", iso)}
                                        placeholderText="Start date & time"
                                    />
                                    <DatePickerField
                                        value={enquiry.toDate ? parseApiDate(enquiry.toDate) : null}
                                        onChange={(_d, iso) => void onDateChange("toDate", iso)}
                                        placeholderText="End date & time"
                                        minDate={enquiry.fromDate ? parseApiDate(enquiry.fromDate) : undefined}
                                    />
                                </div>
                            ) : (
                                <span className="text-sm font-medium">
                                    {[enquiry.fromDate, enquiry.toDate]
                                        .filter(Boolean)
                                        .map(d => formatShortDateTime(d as string))
                                        .join(" – ") || "—"}
                                </span>
                            )}
                        </div>
                        <Row label="Enquiry status">
                            <span className="text-xs">{getEnquiryStatusLabel(enquiry.status)}</span>
                        </Row>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
