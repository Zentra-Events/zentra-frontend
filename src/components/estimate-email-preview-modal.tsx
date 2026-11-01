"use client";

import { useState, useCallback } from "react";
import { FileText, Eye } from "lucide-react";
import type { EstimateDto } from "@/types/estimate";
import { Button, Modal, ModalBody, ModalFooter, Input, Textarea, EmailTagInput } from "./ui";
import { generateEstimatePdfBlob } from "@/lib/estimate-export/estimate-pdf";
import { buildEstimateDocumentModel } from "@/lib/estimate-export/estimate-document";
import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { toast } from "sonner";
import { EstimatePreviewModal } from "./estimate-preview-modal";

interface EstimateEmailPreviewModalProps {
    estimate: EstimateDto;
    eventName?: string;
    clientEmail?: string;
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmailList(value: string): string[] {
    return value
        .split(/[,;]/)
        .map(e => e.trim().replace(/^mailto:/i, ""))
        .filter(e => e.length > 0);
}

function validateEmailList(emails: string[], fieldLabel: string): string | null {
    if (emails.length === 0) return null;
    for (const email of emails) {
        if (!EMAIL_REGEX.test(email)) {
            return `${fieldLabel}: "${email}" is not a valid email address`;
        }
    }
    return null;
}

function formatSendEmailError(raw: string, status: number): string {
    const trimmed = raw.trim();
    if (!trimmed) {
        return status === 404
            ? "Email service is unavailable. Please try again later."
            : "Failed to send email";
    }
    if (trimmed.startsWith("{")) {
        try {
            const parsed = JSON.parse(trimmed) as { message?: string; error?: string };
            return parsed.message || parsed.error || "Failed to send email";
        } catch {
            // Fall through to HTML / plain-text handling
        }
    }
    if (/<html|<!doctype/i.test(trimmed)) {
        return "Failed to send email. The email service could not be reached.";
    }
    return trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed;
}

export function EstimateEmailPreviewModal({
    estimate,
    eventName,
    clientEmail = "",
    open,
    onClose,
    onSuccess,
}: EstimateEmailPreviewModalProps) {
    const model = buildEstimateDocumentModel(estimate, eventName);
    const [to, setTo] = useState(clientEmail);
    const [cc, setCc] = useState("");
    const [subject, setSubject] = useState(`Estimate: ${model.filenameBase.replace(/_/g, " ")}`);
    const [body, setBody] = useState(
        `Dear Client,\n\nPlease find attached the estimate for your event.\n\nEstimate Number: ${model.filenameBase}\n\nIf you have any questions or require further clarification, please feel free to reach out.\n\nBest regards,\nZentra Team`,
    );
    const [sending, setSending] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    // Validation errors
    const [toError, setToError] = useState<string | null>(null);
    const [ccError, setCcError] = useState<string | null>(null);
    const [subjectError, setSubjectError] = useState<string | null>(null);
    const [bodyError, setBodyError] = useState<string | null>(null);

    const validate = useCallback((): boolean => {
        let valid = true;

        // To field
        const toList = parseEmailList(to);
        if (toList.length === 0) {
            setToError("To field is required");
            valid = false;
        } else {
            const err = validateEmailList(toList, "To");
            if (err) {
                setToError(err);
                valid = false;
            } else {
                setToError(null);
            }
        }

        // CC field (optional but validate if provided)
        const ccList = parseEmailList(cc);
        if (ccList.length > 0) {
            const err = validateEmailList(ccList, "CC");
            if (err) {
                setCcError(err);
                valid = false;
            } else {
                setCcError(null);
            }
        } else {
            setCcError(null);
        }

        // Subject field
        if (!subject.trim()) {
            setSubjectError("Subject is required");
            valid = false;
        } else {
            setSubjectError(null);
        }

        // Body field
        if (!body.trim()) {
            setBodyError("Body is required");
            valid = false;
        } else {
            setBodyError(null);
        }

        return valid;
    }, [to, cc, subject, body]);

    const handleSend = useCallback(async () => {
        if (sending) return;
        if (!validate()) return;

        setSending(true);
        try {
            let pdfBlob: Blob;
            try {
                pdfBlob = await generateEstimatePdfBlob(estimate, eventName);
            } catch (pdfError) {
                console.error("Failed to generate estimate PDF:", pdfError);
                throw new Error("Failed to generate the estimate PDF. Please try again.");
            }

            if (!pdfBlob || pdfBlob.size === 0) {
                throw new Error("Generated estimate PDF is empty");
            }

            const pdfFile = new File([pdfBlob], `${model.filenameBase}.pdf`, {
                type: pdfBlob.type || "application/pdf",
            });

            const formData = new FormData();
            const toList = parseEmailList(to);
            const ccList = parseEmailList(cc);

            // One address per part. Do not join with commas: Spring's mail helper
            // treats a comma-separated string as an illegal single address.
            toList.forEach(email => formData.append("to", email));
            ccList.forEach(email => formData.append("cc", email));
            formData.append("subject", subject.trim());
            formData.append("body", body.trim());
            formData.append("pdfFile", pdfFile);

            const res = await apiRequest(API_ENDPOINTS.notifications.sendEmail, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const errorText = await res.text().catch(() => "");
                throw new Error(formatSendEmailError(errorText, res.status));
            }

            toast.success("Estimate sent to client successfully");
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Failed to send estimate email:", error);
            const message = error instanceof Error ? error.message : "Failed to send email";
            toast.error(message);
        } finally {
            setSending(false);
        }
    }, [
        estimate,
        eventName,
        to,
        cc,
        subject,
        body,
        model.filenameBase,
        validate,
        sending,
        onSuccess,
        onClose,
    ]);

    const handleMarkUnderReview = useCallback(async () => {
        try {
            await onSuccess();
            onClose();
        } catch {
            // Error already handled by handleEmailSuccess / handleStatusChange
            // Keep modal open on failure so user can retry
        }
    }, [onSuccess, onClose]);

    const handleCancel = useCallback(() => {
        if (sending) return; // Prevent closing while sending
        onClose();
    }, [sending, onClose]);

    return (
        <>
            {showPreview && (
                <EstimatePreviewModal
                    estimate={estimate}
                    eventName={eventName}
                    onClose={() => setShowPreview(false)}
                />
            )}
            <Modal
                open={open}
                onClose={handleCancel}
                size="xl"
                title="Send Estimate to Client"
                description={`${model.filenameBase.replace(/_/g, " ")}`}
                showCloseIcon
                closeOnBackdrop={!sending}
            >
                <ModalBody>
                    <div className="space-y-4">
                        {/* To field */}
                        <EmailTagInput
                            label="To"
                            placeholder="client@example.com"
                            value={parseEmailList(to)}
                            onChange={tags => {
                                setTo(tags.join(", "));
                                if (toError) setToError(null);
                            }}
                            error={toError ?? undefined}
                            disabled={sending}
                            required
                        />

                        {/* CC field */}
                        <EmailTagInput
                            label="CC"
                            placeholder="cc@example.com"
                            value={parseEmailList(cc)}
                            onChange={tags => {
                                setCc(tags.join(", "));
                                if (ccError) setCcError(null);
                            }}
                            error={ccError ?? undefined}
                            disabled={sending}
                        />

                        {/* Subject field */}
                        <Input
                            label={
                                <span>
                                    Subject <span className="text-error">*</span>
                                </span>
                            }
                            placeholder="Estimate subject"
                            value={subject}
                            onChange={e => {
                                setSubject(e.target.value);
                                if (subjectError) setSubjectError(null);
                            }}
                            error={subjectError ?? undefined}
                            disabled={sending}
                        />

                        {/* Body field */}
                        <Textarea
                            label={
                                <span>
                                    Body <span className="text-error">*</span>
                                </span>
                            }
                            placeholder="Email body"
                            value={body}
                            onChange={e => {
                                setBody(e.target.value);
                                if (bodyError) setBodyError(null);
                            }}
                            error={bodyError ?? undefined}
                            rows={8}
                            className="min-h-[180px]"
                            disabled={sending}
                        />

                        {/* PDF Attachment */}
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setShowPreview(true)}
                                className="inline-flex items-center gap-2 rounded-md border border-border-hover bg-muted/50 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-accent cursor-pointer"
                                disabled={sending}
                            >
                                <FileText size={16} className="text-primary" />
                                <span>{model.filenameBase}.pdf</span>
                                <Eye size={14} className="ml-1 text-muted-foreground" />
                            </button>
                            <span className="text-xs text-muted-foreground">
                                (Attached to email — click to preview)
                            </span>
                        </div>

                        {sending && (
                            <p className="text-xs text-muted-foreground">
                                Generating PDF and sending email...
                            </p>
                        )}
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant="outline" onClick={handleCancel} disabled={sending}>
                        Cancel
                    </Button>
                    <Button variant="outline" onClick={handleMarkUnderReview} disabled={sending}>
                        Mark Under Review
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSend}
                        isLoading={sending}
                        disabled={sending}
                    >
                        {sending ? "Sending..." : "Send"}
                    </Button>
                </ModalFooter>
            </Modal>
        </>
    );
}
