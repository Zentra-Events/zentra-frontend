"use client";

import { Enquiry } from "@/types/enquiry";
import { formatScheduleRange } from "@/lib/utils/date";
import { validateEnquiryField, type EnquiryEditableField } from "@/lib/validations/enquiry";
import { InlineEditableField } from "@/components/ui/inline-editable-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EnquiryField } from "@/components/enquiries/detail/enquiry-field";
import { EnquiryInformationSection } from "@/components/enquiries/detail/enquiry-information-section";
import { FollowUpSection } from "@/components/enquiries/detail/follow-up-section";
import { getEventTypeVariant } from "@/constants/enquiry";
import { BriefcaseIcon, CalendarDaysIcon } from "@/components/ui/icons";
import { FileTextIcon, MapPinIcon, PhoneIcon } from "@/components/ui/icons";
import { UserIcon, UsersIcon } from "@/components/ui/icons";

function getAssignee(e: Enquiry): string {
    const a = e.assignedTo?.trim() || "";
    if (a && a !== "Unassigned") return a;
    return e.assignee?.trim() || "";
}

export function TextEditor(props: {
    draft: string;
    setDraft: (v: string) => void;
    save: () => void;
    saving: boolean;
    inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
    multiline?: boolean;
    placeholder?: string;
}) {
    const { draft, setDraft, save, saving, inputRef, multiline, placeholder } = props;
    if (multiline) {
        return (
            <Textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                disabled={saving}
                placeholder={placeholder}
                rows={3}
                className="text-sm"
            />
        );
    }
    return (
        <Input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            disabled={saving}
            placeholder={placeholder}
            className="h-9 text-sm"
            onKeyDown={e => {
                if (e.key === "Enter") save();
            }}
        />
    );
}

interface MainColumnProps {
    enquiry: Enquiry;
    canWrite: boolean;
    saveField: (field: EnquiryEditableField) => (draft: string) => Promise<string | null | void>;
}
/** Primary column: customer, event, ownership + follow-up notes. */
export function EnquiryMainColumn({ enquiry, canWrite, saveField }: MainColumnProps) {
    const clientDisplay = enquiry.clientName || enquiry.client || "";
    const schedule = formatScheduleRange(enquiry.fromDate, enquiry.toDate);

    const wrap =
        (field: EnquiryEditableField) =>
        async (draft: string): Promise<string | null | void> => {
            const err = await validateEnquiryField(field, draft || null);
            if (err) return err;
            return saveField(field)(draft);
        };

    return (
        <div className="min-w-0 space-y-4">
            <EnquiryInformationSection title="Customer Information" icon={<UserIcon size={16} />}>
                <EnquiryField label="Client" icon={<BriefcaseIcon size={14} />} value={clientDisplay || undefined} />
                <EnquiryField label="Enquiry POC" icon={<UserIcon size={14} />}>
                    <InlineEditableField
                        value={enquiry.enquiryPoC || enquiry.poc || undefined}
                        editValue={enquiry.enquiryPoC || enquiry.poc || ""}
                        disabled={!canWrite}
                        ariaLabel="Edit enquiry POC"
                        renderEditor={p => <TextEditor {...p} placeholder="POC name" />}
                        onSave={wrap("enquiryPoC")}
                    />
                </EnquiryField>
                <EnquiryField
                    label="Enquiry POC Number"
                    icon={<PhoneIcon size={14} />}
                    isPhone={!canWrite}
                    value={canWrite ? undefined : enquiry.enquiryPoCNumber}
                >
                    {canWrite && (
                        <InlineEditableField
                            value={enquiry.enquiryPoCNumber || undefined}
                            editValue={enquiry.enquiryPoCNumber || ""}
                            ariaLabel="Edit enquiry POC number"
                            renderEditor={p => <TextEditor {...p} placeholder="Phone number" />}
                            onSave={wrap("enquiryPoCNumber")}
                        />
                    )}
                </EnquiryField>
            </EnquiryInformationSection>

            <EnquiryInformationSection title="Event Information" icon={<CalendarDaysIcon size={16} />}>
                <EnquiryField label="Event Type" icon={<BriefcaseIcon size={14} />}>
                    {enquiry.eventType ? (
                        <Badge variant={getEventTypeVariant(enquiry.eventType)}>
                            {enquiry.eventType}
                        </Badge>
                    ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                    )}
                </EnquiryField>
                <EnquiryField label="Venue" icon={<MapPinIcon size={14} />}>
                    <InlineEditableField
                        value={enquiry.venue || undefined}
                        editValue={enquiry.venue || ""}
                        disabled={!canWrite}
                        ariaLabel="Edit venue"
                        renderEditor={p => <TextEditor {...p} placeholder="Venue" />}
                        onSave={wrap("venue")}
                    />
                </EnquiryField>
                <EnquiryField label="Location" icon={<MapPinIcon size={14} />}>
                    <InlineEditableField
                        value={enquiry.location || undefined}
                        editValue={enquiry.location || ""}
                        disabled={!canWrite}
                        ariaLabel="Edit location"
                        renderEditor={p => <TextEditor {...p} placeholder="Location" />}
                        onSave={wrap("location")}
                    />
                </EnquiryField>
                <EnquiryField
                    label="Schedule"
                    icon={<CalendarDaysIcon size={14} />}
                    value={schedule || undefined}
                />
                <EnquiryField label="High-level Requirement" icon={<FileTextIcon size={14} />} spanFull>
                    <InlineEditableField
                        value={enquiry.highlvelRequirement || undefined}
                        editValue={enquiry.highlvelRequirement || ""}
                        disabled={!canWrite}
                        ariaLabel="Edit high-level requirement"
                        renderEditor={p => <TextEditor {...p} multiline placeholder="Requirements…" />}
                        onSave={wrap("highlvelRequirement")}
                    />
                </EnquiryField>
            </EnquiryInformationSection>

            <EnquiryInformationSection title="Ownership & Assignment" icon={<UsersIcon size={16} />}>
                <EnquiryField label="Event POC" icon={<UserIcon size={14} />}>
                    <InlineEditableField
                        value={enquiry.eventPoC || undefined}
                        editValue={enquiry.eventPoC || ""}
                        disabled={!canWrite}
                        ariaLabel="Edit event POC"
                        renderEditor={p => <TextEditor {...p} placeholder="Event POC" />}
                        onSave={wrap("eventPoC")}
                    />
                </EnquiryField>
                <EnquiryField
                    label="Event POC Number"
                    icon={<PhoneIcon size={14} />}
                    isPhone={!canWrite}
                    value={canWrite ? undefined : enquiry.eventPoCNumber}
                >
                    {canWrite && (
                        <InlineEditableField
                            value={enquiry.eventPoCNumber || undefined}
                            editValue={enquiry.eventPoCNumber || ""}
                            ariaLabel="Edit event POC number"
                            renderEditor={p => <TextEditor {...p} placeholder="Phone number" />}
                            onSave={wrap("eventPoCNumber")}
                        />
                    )}
                </EnquiryField>
                <EnquiryField
                    label="Assigned To"
                    icon={<BriefcaseIcon size={14} />}
                    value={getAssignee(enquiry) || undefined}
                />
            </EnquiryInformationSection>

            <FollowUpSection enquiryId={String(enquiry.id)} canWrite={canWrite} />
        </div>
    );
}


