"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./ui-old/button";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";

interface EstimateItem {
    item: string;
    quantity: number;
    pricePerItem: number;
    finalAmt: number;
    category: string;
    description?: string;
    days: number;
    startDate?: string | null;
    endDate?: string | null;
}

interface EstimateVersion {
    id: string;
    version: number;
    createdDate?: string | null;
    items?: EstimateItem[];
}

interface EstimateHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventTitle?: string;
    eventID?: string;
}

export function EstimateHistoryModal({
    isOpen,
    onClose,
    eventTitle,
    eventID,
}: EstimateHistoryModalProps) {
    const [versions, setVersions] = useState<EstimateVersion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && eventID) {
            fetchVersions();
            setExpandedVersionId(null);
        }
    }, [isOpen, eventID]);

    const fetchVersions = async () => {
        if (!eventID) return;

        setIsLoading(true);
        try {
            const response = await apiRequest(API_ENDPOINTS.events.versions(eventID));
            if (!response.ok) {
                throw new Error("Failed to fetch estimate versions");
            }
            const data = await response.json();
            setVersions(data);
        } catch (error) {
            console.error("Error fetching estimate versions:", error);
            toast.error("Failed to load estimate history");
        } finally {
            setIsLoading(false);
        }
    };

    const toggleDetails = (id: string) => {
        setExpandedVersionId(expandedVersionId === id ? null : id);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:!bg-gray-900 dark:border dark:border-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Estimate History</h2>
                        {eventTitle && <p className="text-sm text-gray-600 mt-1">{eventTitle}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="text-gray-500">Loading versions...</div>
                        </div>
                    ) : versions.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="text-gray-500">No estimate versions found</div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {versions.map(version => (
                                <div
                                    key={version.id}
                                    className={`border rounded-lg transition-all border-gray-200 bg-white hover:border-blue-300 ${
                                        expandedVersionId === version.id
                                            ? "ring-1 ring-blue-500 border-blue-500"
                                            : ""
                                    }`}
                                >
                                    <div className="p-5 flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-3">
                                                <h3 className="text-lg font-semibold text-gray-900">
                                                    Version {version.version}
                                                </h3>
                                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                                    {version.items?.length || 0} items
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">
                                                        Version ID
                                                    </label>
                                                    <p className="text-sm font-medium text-gray-900 font-mono text-ellipsis overflow-hidden">
                                                        {version.id}
                                                    </p>
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">
                                                        Created Date
                                                    </label>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {version.createdDate
                                                            ? new Date(
                                                                  version.createdDate
                                                              ).toLocaleDateString("en-IN", {
                                                                  year: "numeric",
                                                                  month: "short",
                                                                  day: "numeric",
                                                                  hour: "2-digit",
                                                                  minute: "2-digit",
                                                              })
                                                            : "Not available"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            onClick={() => toggleDetails(version.id)}
                                            variant="outline"
                                            className="ml-4 flex items-center gap-2"
                                        >
                                            {expandedVersionId === version.id
                                                ? "Hide Details"
                                                : "View Details"}
                                        </Button>
                                    </div>

                                    {/* Expanded Details Section */}
                                    {expandedVersionId === version.id && (
                                        <div className="border-t bg-gray-50 p-5 rounded-b-lg">
                                            <h4 className="font-semibold text-sm mb-3">
                                                Item Details
                                            </h4>
                                            {!version.items || version.items.length === 0 ? (
                                                <p className="text-sm text-gray-500 italic">
                                                    No items recorded for this version.
                                                </p>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm text-left">
                                                        <thead className="text-xs text-gray-500 uppercase bg-gray-100 border-b">
                                                            <tr>
                                                                <th className="px-3 py-2">
                                                                    Category
                                                                </th>
                                                                <th className="px-3 py-2">Item</th>
                                                                <th className="px-3 py-2 text-right">
                                                                    Qty
                                                                </th>
                                                                <th className="px-3 py-2 text-right">
                                                                    Price/Item
                                                                </th>
                                                                <th className="px-3 py-2 text-right">
                                                                    Days
                                                                </th>
                                                                <th className="px-3 py-2 text-right">
                                                                    Total
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-200">
                                                            {version.items.map((item, idx) => (
                                                                <tr
                                                                    key={idx}
                                                                    className="hover:bg-gray-100"
                                                                >
                                                                    <td className="px-3 py-2 font-medium">
                                                                        {item.category}
                                                                    </td>
                                                                    <td className="px-3 py-2">
                                                                        <div>{item.item}</div>
                                                                        {item.description && (
                                                                            <div className="text-xs text-gray-500">
                                                                                {item.description}
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right">
                                                                        {item.quantity}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right">
                                                                        {item.pricePerItem}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right">
                                                                        {item.days}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-right font-semibold">
                                                                        ₹
                                                                        {(
                                                                            item.finalAmt || 0
                                                                        ).toLocaleString()}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
                    <Button onClick={onClose} variant="outline" className="px-6">
                        Close
                    </Button>
                </div>
            </div>
        </div>
    );
}
