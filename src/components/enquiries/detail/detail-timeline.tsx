"use client";
import { useMemo, useState } from "react";
import { ArrowDownUp } from "lucide-react";
import { Loading } from "@/components/ui/loading";
import { cn } from "@/lib/utils/cn";
import { formatShortDateTime, parseApiDate } from "@/lib/utils/date";
import type { DetailNote } from "./detail-design";
import { avatarBg, initials } from "./detail-design";
import { NoteComposer } from "./detail-composer";
interface P {
    notes: DetailNote[];
    loading: boolean;
    err: string | null;
    canWrite: boolean;
    userName: string;
    body: string;
    setBody: (v: string) => void;
    submitting: boolean;
    onPost: () => void;
}
export function DetailNotes(p: P) {
    const [asc, setAsc] = useState(false);
    const sorted = useMemo(() => {
        return [...p.notes].sort((x, y) =>
            asc
                ? +parseApiDate(x.createdAt) - +parseApiDate(y.createdAt)
                : +parseApiDate(y.createdAt) - +parseApiDate(x.createdAt),
        );
    }, [p.notes, asc]);
    return (
        <section className="rounded-lg border border-border bg-white">
            <header className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#7d2844]">
                    Follow-up Notes
                </h2>
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f1f5f9] px-1 text-[10px] font-bold text-muted-foreground">
                    {p.notes.length}
                </span>
                <button
                    type="button"
                    onClick={() => setAsc(v => !v)}
                    aria-label={`Sort notes by created date and time, currently ${asc ? "oldest first" : "newest first"}`}
                    className={cn(
                        "ml-auto inline-flex items-center gap-1 text-[11px] font-semibold",
                        asc ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                >
                    <ArrowDownUp size={12} aria-hidden /> Sort:{" "}
                    {asc ? "Oldest First" : "Newest First"}
                </button>
            </header>
            <div className="space-y-3 px-4 py-3">
                <NoteComposer
                    canWrite={p.canWrite}
                    userName={p.userName}
                    body={p.body}
                    setBody={p.setBody}
                    submitting={p.submitting}
                    onPost={p.onPost}
                />
                {p.err && (
                    <p
                        className="rounded-lg bg-error-light/40 px-3 py-2 text-[12px] text-error"
                        role="alert"
                    >
                        {p.err}
                    </p>
                )}
                {p.loading ? (
                    <div className="py-6">
                        <Loading />
                    </div>
                ) : sorted.length === 0 ? (
                    <p className="rounded-lg bg-[#f8fafc] px-3 py-4 text-center text-[12px] text-muted-foreground">
                        No follow-up notes yet.
                    </p>
                ) : (
                    <ul className="space-y-3">
                        {sorted.map(n => (
                            <li key={n.id} className="flex gap-2.5">
                                <span
                                    className={cn(
                                        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                                        avatarBg(n.authorName),
                                    )}
                                    aria-hidden
                                >
                                    {initials(n.authorName).slice(0, 1)}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="flex flex-wrap items-center gap-x-1.5 text-[12px]">
                                        <span className="font-bold text-foreground">
                                            {n.authorName}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {formatShortDateTime(n.createdAt)}
                                        </span>
                                    </p>
                                    <p className="mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-[#334155]">
                                        {n.body}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}
