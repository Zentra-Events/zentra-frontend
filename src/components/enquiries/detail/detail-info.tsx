"use client";
import { BadgeCheck, CalendarDays, FileText, MapPin } from "lucide-react";
import { Enquiry } from "@/types/enquiry";
import { cn } from "@/lib/utils/cn";
import { formatScheduleRange } from "@/lib/utils/date";
import { Badge } from "@/components/ui";
export function DetailInfo({ e }: { e: Enquiry }) {
    const s = formatScheduleRange(e.fromDate, e.toDate);
    const et = (e.eventType || "PERSONAL").toString();
    const per = et.toUpperCase() === "PERSONAL";
    const req =
        e.highlvelRequirement ||
        "Entrance Arch, Welcome Board, Stage Decor, Sound & Lights, Cold Pyro Sparks for Entry and Full 4-Course Catering except arrangement. Client requested a grand floral setup for the outdoor lawn area with warm ambient lighting.";
    return (
        <>
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
            <section className="rounded-lg border border-border bg-white">
                <header className="flex items-center gap-1.5 border-b border-border/70 px-4 py-2.5">
                    <CalendarDays size={13} aria-hidden className="text-[#ab3857]" />
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#7d2844]">
                        Event Details
                    </h2>
                </header>
                <div className="grid grid-cols-1 gap-x-6 gap-y-3 px-4 py-3 sm:grid-cols-2">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                            Event Type
                        </p>
                        <p className="mt-1">
                            <Badge variant="info">{per ? "Personal" : "Corporate"}</Badge>
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                            Venue Name
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">
                            <MapPin size={13} aria-hidden className="shrink-0 text-[#ab3857]" />
                            {e.venue || "Uday Palace Convention Center"}
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                            Location
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-medium text-foreground">
                            <MapPin
                                size={13}
                                aria-hidden
                                className="shrink-0 text-muted-foreground"
                            />
                            {e.location || "Trivandrum, Kerala"}
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                            Schedule & Timings
                        </p>
                        <p className="mt-1 flex items-start gap-1.5 text-[12.5px] font-medium text-foreground">
                            <CalendarDays
                                size={13}
                                aria-hidden
                                className="mt-0.5 shrink-0 text-muted-foreground"
                            />
                            {s || "15 Dec 2026, 04:00 AM – 17 Dec 2026, 11:30 PM"}
                        </p>
                    </div>
                </div>
            </section>
        </>
    );
}
