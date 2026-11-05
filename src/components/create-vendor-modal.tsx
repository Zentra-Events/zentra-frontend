"use client";

import React from "react";
import { Formik, Form, FormikHelpers, FieldArray } from "formik";
import * as Yup from "yup";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Table } from "@/components/ui/table";
import { FormikFieldInput } from "@/components/ui/formik-field-input";
import { VendorFormData, CreateVendorModalProps } from "@/types/vendor";
import { apiRequest } from "@/lib/api/api-client";
import { toast } from "sonner";
import { TrashIcon } from "@/components/ui/icons";
import { FormikFieldTextArea } from "./ui/formik-field-textarea";

const validationSchema = Yup.object({
    name: Yup.string().required("Vendor name is required"),
    billingAddress: Yup.string().required("Billing address is required"),
    gst: Yup.number()
        .min(0, "GST must be 0 or greater")
        .max(100, "GST cannot exceed 100%")
        .required("GST percentage is required"),
    tds: Yup.number()
        .min(0, "TDS must be 0 or greater")
        .max(100, "TDS cannot exceed 100%")
        .required("TDS percentage is required"),
    gstCertificate: Yup.string().optional(),
    phone: Yup.string()
        .matches(/^\d{10}$/, "Phone number must be exactly 10 digits")
        .required("Phone number is required"),
    items: Yup.array().of(
        Yup.object({
            item: Yup.string().required("Item name is required"),
            count: Yup.number().min(1, "Count must be at least 1").required("Count is required"),
            pricePerItem: Yup.number()
                .min(0, "Price must be 0 or greater")
                .required("Price per item is required"),
            description: Yup.string().optional(),
        }),
    ),
});

export default function CreateVendorModal({ isOpen, onClose, onSubmit }: CreateVendorModalProps) {
    const initialValues: VendorFormData = {
        name: "",
        billingAddress: "",
        gst: 0,
        tds: 0,
        gstCertificate: "",
        phone: "",
        items: [],
    };

    const handleSubmit = async (
        values: VendorFormData,
        { setSubmitting, setStatus }: FormikHelpers<VendorFormData>,
    ) => {
        try {
            setStatus(null);

            const payload = {
                name: values.name,
                billingAddress: values.billingAddress,
                gst: Number(values.gst),
                tds: Number(values.tds),
                gstCertificate: values.gstCertificate || "",
                phone: values.phone,
                items: (values.items || []).map(item => ({
                    item: item.item,
                    count: Number(item.count),
                    pricePerItem: Number(item.pricePerItem),
                    description: item.description || "",
                })),
            };

            const res = await apiRequest("/api/vendors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                await res.text().catch(() => "");
                throw new Error(`Failed to create vendor: ${res.status}`);
            }

            toast.success("Vendor created successfully");
            onSubmit();
            onClose();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to save vendor";
            setStatus(message);
            toast.error(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            title="Add New Vendor"
            description="Fill in the vendor details below"
            size="xxl"
        >
            <Formik
                initialValues={initialValues}
                enableReinitialize
                validationSchema={validationSchema}
                onSubmit={handleSubmit}
            >
                {({ isSubmitting, status, values }) => (
                    <Form>
                        <ModalBody className="grid gap-3 max-h-[70vh] overflow-y-auto">
                            {status && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                                    {status}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <FormikFieldInput
                                    name="name"
                                    label="Vendor Name"
                                    placeholder="Enter vendor name"
                                />
                                <FormikFieldInput
                                    name="phone"
                                    label="Phone Number"
                                    placeholder="1234567890 (10 digits)"
                                    maxLength={10}
                                />
                            </div>
                            <FormikFieldTextArea
                                name="billingAddress"
                                label="Billing Address"
                                placeholder="Enter complete billing address"
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <FormikFieldInput
                                    name="gst"
                                    label="GST (%)"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    placeholder="e.g., 18"
                                />
                                <FormikFieldInput
                                    name="tds"
                                    label="TDS (%)"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    placeholder="e.g., 2"
                                />
                            </div>

                            <FormikFieldInput
                                name="gstCertificate"
                                label="GST Certificate Number"
                                placeholder="e.g., 22AAAAA0000A1Z5"
                            />

                            {/* Vendor Items Section */}
                            <div className="border-t border-border pt-3 mt-2">
                                <FieldArray name="items">
                                    {({ push, remove }) => (
                                        <div className="space-y-3">
                                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                <div>
                                                    <h3 className="text-base font-semibold text-gray-900">
                                                        Vendor Items
                                                    </h3>
                                                    <p className="text-xs text-muted-foreground">
                                                        List the items provided by this vendor.
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        push({
                                                            item: "",
                                                            count: 1,
                                                            pricePerItem: 0,
                                                            description: "",
                                                        })
                                                    }
                                                >
                                                    Add Item
                                                </Button>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <Table
                                                    data={values.items || []}
                                                    showRowNumbers
                                                    emptyMessage='No vendor items added yet. Click "Add Item" to get started.'
                                                    columns={[
                                                        {
                                                            key: "item",
                                                            header: "Item",
                                                            render: (_, index) => (
                                                                <FormikFieldInput
                                                                    name={`items.${index}.item`}
                                                                    placeholder="Item name"
                                                                    inputClassName="w-full"
                                                                />
                                                            ),
                                                        },
                                                        {
                                                            key: "count",
                                                            header: "Count",
                                                            align: "center",
                                                            cellClassName: "w-24",
                                                            render: (_, index) => (
                                                                <FormikFieldInput
                                                                    name={`items.${index}.count`}
                                                                    type="number"
                                                                    min="1"
                                                                    placeholder="0"
                                                                    inputClassName="w-full text-center"
                                                                />
                                                            ),
                                                        },
                                                        {
                                                            key: "pricePerItem",
                                                            header: "Price/Item",
                                                            align: "right",
                                                            cellClassName: "w-32",
                                                            render: (_, index) => (
                                                                <FormikFieldInput
                                                                    name={`items.${index}.pricePerItem`}
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    placeholder="0.00"
                                                                    inputClassName="w-full text-right"
                                                                />
                                                            ),
                                                        },
                                                        {
                                                            key: "description",
                                                            header: "Description",
                                                            render: (_, index) => (
                                                                <FormikFieldInput
                                                                    name={`items.${index}.description`}
                                                                    placeholder="Description (optional)"
                                                                    inputClassName="w-full"
                                                                />
                                                            ),
                                                        },
                                                        {
                                                            key: "actions",
                                                            header: "",
                                                            align: "right",
                                                            cellClassName: "text-right",
                                                            render: (_, index) => (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0 text-muted-foreground text-destructive"
                                                                    onClick={() => remove(index)}
                                                                >
                                                                    <TrashIcon size={16} />
                                                                </Button>
                                                            ),
                                                        },
                                                    ]}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </FieldArray>
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button isLoading={isSubmitting} type="submit">
                                Add Vendor
                            </Button>
                        </ModalFooter>
                    </Form>
                )}
            </Formik>
        </Modal>
    );
}
