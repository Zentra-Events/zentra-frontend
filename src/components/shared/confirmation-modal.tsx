"use client";

import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface ConfirmationModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "destructive" | "primary";
    isLoading?: boolean;
    className?: string;
}

export function ConfirmationModal({
    open,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "destructive",
    isLoading = false,
    className,
}: ConfirmationModalProps) {
    const handleConfirm = async () => {
        await onConfirm();
    };

    return (
        <Modal open={open} onClose={onClose} title={title} size="sm" className={className}>
            <ModalBody>
                {description && (
                    <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                        {description}
                    </p>
                )}
            </ModalBody>
            <ModalFooter>
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                    {cancelText}
                </Button>
                <Button
                    type="button"
                    variant={variant}
                    onClick={handleConfirm}
                    isLoading={isLoading}
                >
                    {confirmText}
                </Button>
            </ModalFooter>
        </Modal>
    );
}

ConfirmationModal.displayName = "ConfirmationModal";
