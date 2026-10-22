"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { apiRequest } from "@/lib/api/api-client";
import { EventResponse } from "@/types/event";

interface BillingExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventData: EventResponse;
    onSave: () => void;
}

/**
 * Editor for the billing details of an event (billing address, tax
 * configuration, service charge, advance and discount).
 *
 * These values are the source of truth for the client bill, so they are
 * edited from the manage billing modal.
 */
export function BillingExpenseModal({
    isOpen,
    onClose,
    eventData,
    onSave,
}: BillingExpenseModalProps) {
    const [billingAddress, setBillingAddress] = useState("");
    const [pan, setPan] = useState("");
    const [clientGst, setClientGst] = useState("");
    const [gst, setGst] = useState(0);
    const [tds, setTds] = useState(0);
    const [serviceCharge, setServiceCharge] = useState(0);
    const [advanceAmt, setAdvanceAmt] = useState(0);
    const [discounts, setDiscounts] = useState(0);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setBillingAddress(eventData?.billingAddress || "");
        setPan(eventData?.pan || "");
        setGst(eventData?.gst || 0);
        setTds(eventData?.tds || 0);
        setServiceCharge(eventData?.serviceCharge || 0);
        setAdvanceAmt(eventData?.advanceAmt || 0);
        setDiscounts(eventData?.discounts || 0);
    }, [isOpen, eventData]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const updatedEvent = {
                ...eventData,
                billingAddress,
                pan,
                gst,
                tds,
                serviceCharge,
                advanceAmt,
                discounts,
            };

            const res = await apiRequest(API_ENDPOINTS.events.list, {
                method: "POST",
                body: JSON.stringify(updatedEvent),
            });

            if (res.ok) {
                toast.success("Billing details saved successfully");
                onSave();
                onClose();
            } else {
                toast.error("Failed to save billing details");
            }
        } catch (err) {
            console.error("Error saving billing details:", err);
            toast.error("Error saving billing details");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            size="lg"
            title="Billing &amp; Expenses"
            description="Manage billing address, tax details, and financial information."
            showCloseIcon
            closeOnEscape
            icon={
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
                    <Receipt size={20} aria-hidden="true" />
                </span>
            }
        >
            <ModalBody className="space-y-5">
                <div>
                    <Textarea
                        id="billing-address"
                        label="Billing Address"
                        value={billingAddress}
                        onChange={e => setBillingAddress(e.target.value)}
                        placeholder="Enter billing address"
                        rows={3}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        id="billing-pan"
                        label="PAN"
                        type="text"
                        value={pan}
                        onChange={e => setPan(e.target.value.toUpperCase())}
                        placeholder="e.g., ABCDE1234F"
                        maxLength={10}
                    />
                    <Input
                        id="billing-client-gst"
                        label="Client GST"
                        type="text"
                        value={clientGst}
                        onChange={e => setClientGst(e.target.value.toUpperCase())}
                        placeholder="e.g., 29ABCDE1234F1ZK"
                        maxLength={15}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        id="billing-gst"
                        label="GST %"
                        type="number"
                        value={gst}
                        onChange={e => setGst(parseFloat(e.target.value) || 0)}
                        min={0}
                        max={100}
                        step={0.5}
                    />
                    <Input
                        id="billing-tds"
                        label="TDS %"
                        type="number"
                        value={tds}
                        onChange={e => setTds(parseFloat(e.target.value) || 0)}
                        min={0}
                        max={100}
                        step={0.5}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                        id="billing-service-charge"
                        label="Service Charge (%)"
                        type="number"
                        value={serviceCharge}
                        onChange={e => setServiceCharge(parseFloat(e.target.value) || 0)}
                        min={0}
                        step={0.01}
                    />
                    <Input
                        id="billing-advance"
                        label="Advance Amount (₹)"
                        type="number"
                        value={advanceAmt}
                        onChange={e => setAdvanceAmt(parseFloat(e.target.value) || 0)}
                        min={0}
                        step={0.01}
                    />
                    <Input
                        id="billing-discounts"
                        label="Discounts (₹)"
                        type="number"
                        value={discounts}
                        onChange={e => setDiscounts(parseFloat(e.target.value) || 0)}
                        min={0}
                        step={0.01}
                    />
                </div>
            </ModalBody>

            <ModalFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="button" onClick={handleSave} isLoading={saving} disabled={saving}>
                    {saving ? "Saving..." : "Save Billing Details"}
                </Button>
            </ModalFooter>
        </Modal>
    );
}
