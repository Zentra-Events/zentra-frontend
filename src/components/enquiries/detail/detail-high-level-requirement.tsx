"use client";
import { FileText, BadgeCheck } from "lucide-react";
import { Enquiry } from "@/types/enquiry";
export function DetailHighLevelRequirement({ e }: { e: Enquiry }) {
    const req =
        e.highlvelRequirement ||
        "Entrance Arch, Welcome Board, Stage Decor, Sound & Lights, Cold Pyro Sparks for Entry and Full 4-Course Catering except arrangement. Client requested a grand floral setup for the outdoor lawn area with warm ambient lighting.";
    return (
        <section className="rounded-lg border border-border bg-white">
            <header className="flex items-center gap-1.5 border-b border-border/70 px-4 py-2.5">
                <FileText size={13} aria-hidden className="text-[#ab3857]" />
                <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#7d2844]">
                    High-Level Requirement
                </h2>
            </header>
            <div className="px-3 py-2 mx-4 my-2 rounded-lg bg-[#edf0f2]">
                <p className="text-[12.5px] leading-relaxed text-[#334155]">{req}</p>
                <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    <BadgeCheck size={13} aria-hidden className="text-[#16a34a]" />
                    Scope verified during initial onboarding
                </p>
            </div>
        </section>
    );
}
