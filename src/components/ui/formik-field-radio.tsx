"use client";

import { Field, FieldProps } from "formik";
import { cn } from "@/lib/utils/cn";

export interface RadioOption {
    label: string;
    value: string;
}

export interface FormikFieldRadioProps {
    name: string;
    label?: React.ReactNode;
    options: RadioOption[];
    radioClassName?: string;
    wrapperClassName?: string;
    id?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
    orientation?: "horizontal" | "vertical";
}

/**
 * Reusable Formik-connected radio group with optional label and error message.
 * Use inside <Formik><Form>...</Form></Formik>.
 */
export function FormikFieldRadio({
    name,
    label,
    options = [],
    radioClassName,
    wrapperClassName,
    id,
    onChange,
    disabled = false,
    orientation = "horizontal",
}: FormikFieldRadioProps) {
    const radioId = id ?? name;

    return (
        <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
            {label && (
                <label className="flex min-h-5 flex-wrap items-center gap-1.5 text-sm font-medium leading-5 text-foreground">
                    {label}
                </label>
            )}
            <Field name={name}>
                {({ field, meta }: FieldProps<string>) => {
                    const showError = !!meta.touched && !!meta.error;

                    return (
                        <div
                            className={cn(
                                "flex gap-6",
                                orientation === "vertical"
                                    ? "flex-col gap-3"
                                    : "min-h-10 flex-row flex-wrap items-center",
                                radioClassName,
                            )}
                        >
                            {options.map(option => (
                                <label
                                    key={option.value}
                                    className="flex cursor-pointer items-center gap-2"
                                >
                                    <input
                                        type="radio"
                                        id={`${radioId}-${option.value}`}
                                        {...field}
                                        value={option.value}
                                        // Formik only computes `field.checked` when `type` is
                                        // forwarded to <Field>. This component renders <Field>
                                        // with just a name, so derive `checked` explicitly to
                                        // keep the selected option in sync with the form value
                                        // (e.g. when pre-populating on edit).
                                        checked={field.value === option.value}
                                        disabled={disabled}
                                        className={cn(
                                            "h-4 w-4 cursor-pointer",
                                            "accent-primary",
                                            "disabled:cursor-not-allowed disabled:opacity-50",
                                            showError &&
                                                "border-error focus:ring-error focus:ring-offset-1",
                                        )}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            field.onChange(e);
                                            onChange?.(e);
                                        }}
                                    />
                                    <span className="text-sm text-foreground">{option.label}</span>
                                </label>
                            ))}
                        </div>
                    );
                }}
            </Field>
        </div>
    );
}
