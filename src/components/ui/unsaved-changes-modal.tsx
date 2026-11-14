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
    canSaveDraft?: boolean;
}

export function UnsavedChangesModal({
    open,
    onClose,
    onAction,
    entityLabel = "this estimate",
    loading = false,
    canSaveDraft = true,
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
                    {canSaveDraft ? (
                        <>
                            Changes to <b>{entityLabel}</b> are saved automatically as a local
                            draft while you edit. You can continue editing or discard your changes.
                        </>
                    ) : (
                        <span className="mt-2 block">
                            Select a client and enquiry first to enable draft recovery.
                        </span>
                    )}
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
