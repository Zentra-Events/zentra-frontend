import * as Yup from "yup";

// Reuses the same rules as CreateEnquiryModal's validationSchema so inline
// edits and the full form can never disagree.

export const enquiryFieldSchemas = {
    title: Yup.string().required("Event title is required").min(3, "Add at least 3 characters"),
    location: Yup.string().required("Location is required"),
    venue: Yup.string().required("Venue is required"),
    highlvelRequirement: Yup.string().required("High level requirement is required"),
    enquiryPoCNumber: Yup.string().required("Contact number is required"),
    clientPoC: Yup.string().optional(),
    enquiryPoC: Yup.string().optional(),
    eventPoC: Yup.string().optional(),
    eventPoCNumber: Yup.string().optional(),
    assignedTo: Yup.string().optional(),
    status: Yup.string()
        .oneOf(["OPEN", "IN_PROGRESS", "CLOSED"], "Invalid status")
        .required("Status is required"),
    eventType: Yup.string()
        .oneOf(["PERSONAL", "CORPORATE", "OTHER"], "Invalid event type")
        .required("Event type is required"),
    fromDate: Yup.string().nullable().optional(),
    toDate: Yup.string()
        .nullable()
        .optional()
        .test("after-start", "End must be after start", function (value) {
            const { fromDate } = this.parent as { fromDate?: string | null };
            if (!value || !fromDate) return true;
            return new Date(value) >= new Date(fromDate);
        }),
} as const;

export type EnquiryEditableField = keyof typeof enquiryFieldSchemas;

export async function validateEnquiryField(
    field: EnquiryEditableField,
    value: unknown,
    context?: Record<string, unknown>,
): Promise<string | null> {
    try {
        await enquiryFieldSchemas[field].validate(value, { context });
        if (field === "toDate" && context?.fromDate) {
            await enquiryFieldSchemas.toDate.validate(value, { context });
        }
        return null;
    } catch (err) {
        return err instanceof Error ? err.message : "Invalid value";
    }
}
