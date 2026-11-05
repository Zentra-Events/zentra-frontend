"use client";

import { useCallback } from "react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import type { RecoveryInfo } from "@/lib/draft/types";

interface DraftRecoveryModalProps {
    open: boolean;
    onClose: () => void;
    onRecover: (draftData: unknown) => void;
    onDiscard: () => void;
    recoveryInfo: RecoveryInfo;
    draftData: unknown;
    loading?: boolean;
}

export function DraftRecoveryModal({
    open,
    onClose,
    onRecover,
    onDiscard,
    recoveryInfo,
    draftData,
    loading = false,
}: DraftRecoveryModalProps) {
    const handleRecover = useCallback(() => {
        onRecover(draftData);
    }, [onRecover, draftData]);

    const handleDiscard = useCallback(() => {
        onDiscard();
    }, [onDiscard]);

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="md"
            title="Recover Unsaved Estimate?"
            description="We found an unsaved draft of this estimate from your previous session."
        >
            <ModalBody>
                <div className="space-y-1 text-sm text-muted-foreground">
                    <p>
                        <strong>Estimate:</strong> {recoveryInfo.title}
                    </p>
                    {recoveryInfo.subtitle && (
                        <p>
                            <strong>{recoveryInfo.subtitle}</strong>
                        </p>
                    )}
                    {recoveryInfo.eventId && (
                        <p>
                            <strong>Event ID:</strong> {recoveryInfo.eventId}
                        </p>
                    )}
                    <p>
                        <strong>Last modified:</strong> {recoveryInfo.lastModified}
                    </p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                    Recovering will restore the draft and let you continue editing.
                </p>
            </ModalBody>
            <ModalFooter>
                <Button type="button" variant="outline" onClick={handleDiscard} disabled={loading}>
                    Discard Draft
                </Button>
                <Button type="button" onClick={handleRecover} disabled={loading}>
                    Recover Draft
                </Button>
            </ModalFooter>
        </Modal>
    );
}
