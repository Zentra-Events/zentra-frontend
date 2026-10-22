"use client";
import { Enquiry } from "@/types/enquiry";
import { cn } from "@/lib/utils/cn";
import { avatarBg, initials } from "./detail-design";
export function DetailContacts({ e }: { e: Enquiry }) {
    const poc = (e as unknown as { poc?: string }).poc;
    const list = [
        {
            name: e.clientPoC || e.clientName || e.client || "",
            role: "Client-Contact",
            sub: "Primary Decision Maker",
            phone: e.enquiryPoCNumber || poc || "",
        },
        {
            name: e.alternateClientPoC || "",
            role: "Alternate Client Contact",
            sub: "Secondary Decision Maker",
            phone: e.alternateEnquiryPocNumber || "",
        },
        {
            name: e.eventPoC || "",
            role: "Event POC",
            sub: "On-ground Coordinator",
            phone: e.eventPoCNumber || "",
        },
    ];
    return (
        <section className="rounded-lg border border-border bg-white">
            <header className="flex items-center gap-1.5 border-b border-border/70 px-4 py-2.5">
                <span aria-hidden className="text-[13px]">
                    📞
                </span>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#7d2844]">
                    Contacts
                </h2>
                <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f1f5f9] px-1 text-[10px] font-bold text-muted-foreground">
                    3
                </span>
            </header>
            <ul className="divide-y divide-border/60 px-4">
                {list.map(c => (
                    <li key={c.role} className="flex items-center gap-3 py-2.5">
                        <span
                            className={cn(
                                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold",
                                avatarBg(c.name),
                            )}
                            aria-hidden
                        >
                            {initials(c.name).charAt(0)}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span className="text-[12.5px] font-bold text-foreground">
                                    {c.name}
                                </span>
                                <span className="rounded bg-[#f1f5f9] px-1.5 py-px text-[10px] font-semibold text-[#475569]">
                                    {c.role}
                                </span>
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                                {c.sub}
                            </span>
                        </span>
                        <a
                            href={`tel:${String(c.phone).replace(/\D/g, "")}`}
                            className="shrink-0 text-[12px] font-semibold text-foreground hover:text-primary hover:underline"
                        >
                            {c.phone}
                        </a>
                    </li>
                ))}
            </ul>
        </section>
    );
}
