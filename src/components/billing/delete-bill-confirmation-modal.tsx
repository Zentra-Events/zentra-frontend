"use client";

import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import { useNestedModalEscape } from "./bill-modal-escape";

interface DeleteBillConfirmationModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    description: string;
    isLoading?: boolean;
}

/**
 * Confirmation modal shown before a generated bill is deleted.
 *
 * The modal is nested in the manage billing modal, so it keeps the Escape key
 * for itself instead of letting the parent modal close as well.
 */
export function DeleteBillConfirmationModal({
    open,
    onClose,
    onConfirm,
    title,
    description,
    isLoading = false,
}: DeleteBillConfirmationModalProps) {
    useNestedModalEscape(open, onClose);

    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onConfirm={onConfirm}
            title={title}
            description={description}
            confirmText="Delete bill"
            isLoading={isLoading}
        />
    );
}
