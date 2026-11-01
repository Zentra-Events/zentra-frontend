"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, ExternalLink, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";

interface ReceiptViewerProps {
    open: boolean;
    onClose: () => void;
    receipt?: string | null;
    receiptFileName?: string | null;
    receiptContentType?: string | null;
}

export function ReceiptViewer({
    open,
    onClose,
    receipt,
    receiptFileName,
    receiptContentType,
}: ReceiptViewerProps) {
    const [dataUrl, setDataUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isImage = useCallback(
        (ct: string | null | undefined) =>
            !!ct && /^image\/(jpeg|jpg|png|gif|webp)$/i.test(ct),
        [],
    );

    const isPdf = useCallback(
        (ct: string | null | undefined) => !!ct && ct.toLowerCase() === "application/pdf",
        [],
    );

    const buildDataUrl = useCallback(() => {
        if (!receipt || !receiptContentType) return null;
        try {
            return `data:${receiptContentType};base64,${receipt}`;
        } catch {
            return null;
        }
    }, [receipt, receiptContentType]);

    useEffect(() => {
        const url = buildDataUrl();
        setDataUrl(url);
        if (!url && receipt) {
            setError("Unable to build receipt preview.");
        } else {
            setError(null);
        }
    }, [receipt, receiptContentType, buildDataUrl]);

    const handleDownload = useCallback(() => {
        if (!receipt || !receiptContentType) return;
        try {
            const byteCharacters = atob(receipt);
            const byteArrays: number[] = [];
            for (let i = 0; i < byteCharacters.length; i++) {
                byteArrays.push(byteCharacters.charCodeAt(i));
            }
            const blob = new Blob([new Uint8Array(byteArrays)], {
                type: receiptContentType,
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = receiptFileName || "receipt";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Failed to download receipt:", err);
        }
    }, [receipt, receiptContentType, receiptFileName]);

    if (!open) return null;

    const hasData = Boolean(receipt && receiptContentType);
    const showImage = hasData && isImage(receiptContentType);
    const showPdf = hasData && isPdf(receiptContentType);

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="View Receipt"
            description={receiptFileName || "Receipt / Bill"}
            size="xxl"
            showCloseIcon
        >
            <ModalBody className="flex flex-col items-center justify-center gap-4 p-6">
                {error && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                        <X size={14} /> {error}
                    </div>
                )}
                {!hasData && (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <FileText size={32} />
                        <p>No receipt data available.</p>
                    </div>
                )}
                {hasData && !error && !showImage && !showPdf && (
                    <div className="flex flex-col items-center gap-3">
                        <FileText size={32} />
                        <p className="text-sm text-muted-foreground">
                            Unsupported file type:{" "}
                            <span className="font-mono text-xs">{receiptContentType}</span>
                        </p>
                        {receiptFileName && (
                            <p className="text-xs text-muted-foreground">
                                {receiptFileName}
                            </p>
                        )}
                    </div>
                )}
                {showImage && dataUrl && (
                    <div className="max-w-full max-h-[60vh] overflow-auto bg-border rounded-lg border border-border p-2">
                        <img
                            src={dataUrl}
                            alt={receiptFileName || "Receipt"}
                            className="max-w-full max-h-[60vh] object-contain"
                        />
                    </div>
                )}
                {showPdf && dataUrl && (
                    <div className="max-w-full max-h-[70vh] bg-border rounded-lg border border-border p-2">
                        <embed
                            src={dataUrl}
                            type="application/pdf"
                            className="w-full h-full"
                        />
                    </div>
                )}
            </ModalBody>
            <ModalFooter className="flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText size={12} />
                    <span>{receiptFileName || "receipt"}</span>
                    <span className="text-[10px] text-muted-foreground">
                        | {receiptContentType || "unknown"}
                    </span>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Close
                    </Button>
                    {hasData && (
                        <Button type="button" onClick={handleDownload} icon={<Download size={14} />}>
                            Download
                        </Button>
                    )}
                </div>
            </ModalFooter>
        </Modal>
    );
}
