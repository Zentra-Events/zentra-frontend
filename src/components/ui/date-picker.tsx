"use client";

import DatePicker from "react-datepicker";
import { cn } from "@/lib/utils/cn";
import { CalendarIcon } from "lucide-react";
import { forwardRef } from "react";

export interface DatePickerFieldProps {
    label?: React.ReactNode;
    inputClassName?: string;
    wrapperClassName?: string;
    id?: string;
    onChange?: (date: Date | null, value: string) => void;
    error?: string;
    placeholderText?: string;
    showTimeSelect?: boolean;
    timeIntervals?: number;
    dateFormat?: string;
    minDate?: Date;
    maxDate?: Date;
    isClearable?: boolean;
    disabled?: boolean;
    value?: Date | null;
    showError?: boolean;
    smallLabel?: boolean;
}

const DatePickerInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ className, ...props }, ref) => {
        return (
            <div className="relative">
                <input
                    ref={ref}
                    className={cn(
                        "flex h-10 w-full rounded-md border border-input bg-surface px-3 py-2 pr-10 text-sm text-foreground transition-colors",
                        "placeholder:text-muted-foreground text-xs",
                        "focus:border-accent focus:outline-none focus:ring-2 focus:ring-input-ring",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        className,
                    )}
                    {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
                />
                <CalendarIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
        );
    },
);

DatePickerInput.displayName = "DatePickerInput";

/**
 * Standalone DatePicker with time support and theme styling.
 * Matches the style of other input components.
 * Can be used with or without Formik.
 */
export function DatePickerField({
    label,
    inputClassName,
    wrapperClassName,
    id,
    onChange,
    error,
    placeholderText = "Select date & time",
    showTimeSelect = true,
    timeIntervals = 15,
    dateFormat = "MMM d, yyyy h:mm aa",
    minDate,
    maxDate,
    isClearable,
    disabled,
    value,
    showError: externalShowError,
    smallLabel,
}: DatePickerFieldProps) {
    const pickerId = id ?? "date-picker";
    const showError = externalShowError || !!error;

    const datePickerProps = {
        selected: value || null,
        onChange: (date: Date | null) => {
            const isoValue = date ? date.toISOString() : "";
            onChange?.(date, isoValue);
        },
        placeholderText,
        showTimeSelect,
        timeIntervals,
        dateFormat,
        minDate,
        maxDate,
        isClearable,
        disabled,
        customInput: (
            <DatePickerInput
                id={pickerId}
                placeholder={placeholderText}
                className={cn(
                    showError &&
                        "border-error focus:border-error focus:ring-[var(--input-error-ring)]",
                    inputClassName,
                )}
                aria-invalid={
                    showError as boolean | "true" | "false" | "grammar" | "spelling" | undefined
                }
                aria-describedby={showError ? `${pickerId}-error` : undefined}
            />
        ),
        popperClassName: "z-50",
    };

    return (
        <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
            {label && (
                <label
                    htmlFor={pickerId}
                    className={cn(
                        "flex min-h-5 flex-wrap items-center gap-1.5 font-medium text-foreground",
                        smallLabel ? "text-xs font-semibold text-muted-foreground" : "text-sm",
                    )}
                >
                    {typeof label === "string" && smallLabel ? label.toUpperCase() : label}
                </label>
            )}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <DatePicker {...(datePickerProps as any)} />
            {error && (
                <p id={`${pickerId}-error`} className="text-xs text-error">
                    {error}
                </p>
            )}
        </div>
    );
}
