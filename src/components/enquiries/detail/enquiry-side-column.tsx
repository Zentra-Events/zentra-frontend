"use client";

import { Enquiry } from "@/types/enquiry";
import { formatShortDateTime } from "@/lib/utils/date";
import { Card, CardContent } from "@/components/ui/card";
import { EnquiryField } from "@/components/enquiries/detail/enquiry-field";
import { EnquiryInformationSection } from "@/components/enquiries/detail/enquiry-information-section";
import { EnquiryPropertyPanel } from "@/components/enquiries/detail/enquiry-property-panel";
import { HashIcon } from "@/components/ui/icons";
import { CalendarIcon } from "@/components/ui/icons";
import type { EnquiryPriorityValue } from "@/constants/enquiry";

interface SideColumnProps {
    enquiry: Enquiry;
    priority: EnquiryPriorityValue;
    onPriorityChange: (p: EnquiryPriorityValue) => void;
    onStatusChange: (status: string) => Promise<boolean>;
    onAssigneeChange: (name: string) => Promise<boolean>;
    onDateChange: (field: "fromDate" | "toDate", iso: string) => Promise<boolean>;
    canWrite: boolean;
}

/** Secondary column: quick-edit panel + reference info. */
export function EnquirySideColumn(props: SideColumnProps) {
    const { enquiry } = props;
    const title = enquiry.eventName || enquiry.title || "Untitled Enquiry";
    return (
        <div className="min-w-0 space-y-4">
            <EnquiryPropertyPanel {...props} />
            <EnquiryInformationSection title="Reference Information" icon={<HashIcon size={16} />}>
                <EnquiryField
                    spanFull
                    label="Enquiry ID"
                    value={String(enquiry.id)}
                    copyValue={enquiry.id}
                    icon={<HashIcon size={14} />}
                />
                <EnquiryField
                    spanFull
                    label="Event ID"
                    value={enquiry.eventID}
                    copyValue={enquiry.eventID}
                    icon={<HashIcon size={14} />}
                />
                {enquiry.date && (
                    <EnquiryField
                        label="Enquiry Date"
                        value={formatShortDateTime(enquiry.date)}
                        icon={<CalendarIcon size={14} />}
                    />
                )}
            </EnquiryInformationSection>
            <Card variant="bordered">
                <CardContent className="px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:px-5">
                    {title}. Status and assignee edits save immediately via the existing
                    enquiry API. Priority and notes are kept on this device until the
                    backend adds dedicated fields.
                </CardContent>
            </Card>
        </div>
    );
}
