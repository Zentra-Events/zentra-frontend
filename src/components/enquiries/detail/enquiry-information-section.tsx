"use client";

import { ReactNode } from "react";

import { InfoCard } from "@/components/ui/info-card";

interface EnquiryInformationSectionProps {
    title: string;
    icon?: ReactNode;
    children: ReactNode;
}

/**
 * Thin domain wrapper over the shared InfoCard so enquiry sections share
 * one import + consistent header styling. No new card styling introduced.
 */
export function EnquiryInformationSection({ title, icon, children }: EnquiryInformationSectionProps) {
    return (
        <InfoCard title={title} icon={icon}>
            {children}
        </InfoCard>
    );
}
