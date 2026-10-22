"use client";
import { Button } from "@/components/ui/button";
import { initials } from "./detail-design";
interface P {
    canWrite: boolean;
    userName: string;
    body: string;
    setBody: (v: string) => void;
    submitting: boolean;
    onPost: () => void;
}
export function NoteComposer(p: P) {
    return (
        <div className="flex gap-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7d2844] text-[11px] font-bold text-white">
                {initials(p.userName || "BA")}
            </span>
            <div className="min-w-0 flex-1">
                <textarea
                    value={p.body}
                    onChange={ev => p.setBody(ev.target.value)}
                    rows={2}
                    placeholder="Add a follow-up note... use @ to mention teammates or # for assets"
                    disabled={!p.canWrite || p.submitting}
                    className="w-full resize-none rounded-lg border border-border bg-[#f8fafc] px-3 py-2 text-[12.5px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-60"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="ml-auto flex items-center gap-2">
                        {/* <button
                            type="button"
                            aria-label="Attach"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                        >
                            <Plus size={14} aria-hidden />
                        </button> */}
                        <Button
                            size="sm"
                            onClick={p.onPost}
                            disabled={!p.canWrite || !p.body.trim() || p.submitting}
                            isLoading={p.submitting}
                            className="h-7 rounded-full bg-[#7d2844] px-3 text-[11px] font-bold text-white"
                        >
                            Post note
                        </Button>
                    </span>
                </div>
            </div>
        </div>
    );
}
