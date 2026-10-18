import { forwardRef, ReactNode, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string | ReactNode;
    error?: string;
    hint?: string;
    smallLabel?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, hint, id, smallLabel, ...props }, ref) => {
        return (
            <div className="flex flex-col gap-1.5">
                {label && (
                    <label
                        htmlFor={id}
                        className={cn(
                            "flex min-h-5 flex-wrap items-center gap-1.5 font-medium text-foreground",
                            smallLabel ? "text-xs font-semibold text-muted-foreground" : "text-sm",
                        )}
                    >
                        {typeof label === "string" && smallLabel ? label.toUpperCase() : label}
                    </label>
                )}
                <input
                    ref={ref}
                    id={id}
                    className={cn(
                        "flex h-10 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground transition-colors",
                        "placeholder:text-muted-foreground text-xs",
                        "focus:border-accent focus:outline-none focus:ring-2 focus:ring-input-ring",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        error &&
                            "border-error focus:border-error focus:ring-[var(--input-error-ring)]",
                        className,
                    )}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-error` : undefined}
                    {...props}
                />
                {error && (
                    <p id={`${id}-error`} className="text-xs text-error">
                        {error}
                    </p>
                )}
                {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
            </div>
        );
    },
);

Input.displayName = "Input";
