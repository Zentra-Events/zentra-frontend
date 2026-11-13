"use client";

import { useCallback } from "react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

type UnsavedChangesAction = "continue" | "discard-and-close";

interface UnsavedChangesModalProps {
    open: boolean;
    onClose: () => void;
    onAction: (action: UnsavedChangesAction) => void;
    entityLabel?: string;
    loading?: boolean;
}

export function UnsavedChangesModal({
    open,
    onClose,
    onAction,
    entityLabel = "this estimate",
    loading = false,
}: UnsavedChangesModalProps) {
    const handleContinue = useCallback(() => {
        onAction("continue");
    }, [onAction]);

    const handleDiscardAndClose = useCallback(() => {
        onAction("discard-and-close");
    }, [onAction]);

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="md"
            title="Unsaved Changes"
        >
            <ModalBody>
                <span className="text-sm ">
                    Discarding changes will lose your unsaved changes in <b>{entityLabel}</b>, including any local draft saved. 
                    <br />
                    Changes will only be visible to other users after they are saved.
                </span>
            </ModalBody>
            <ModalFooter className="gap-3">
                <Button 
                    type="button"
                    variant="outline"
                    onClick={handleContinue}
                    disabled={loading}
                >
                    Continue Editing
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleDiscardAndClose}
                    disabled={loading}
                >
                    Discard Changes
                </Button>
            </ModalFooter>
        </Modal>
    );
}
