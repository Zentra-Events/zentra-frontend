"use client";

import { Field, FieldProps } from "formik";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

export interface FormikFieldInputProps extends Omit<
    React.ComponentProps<"input">,
    "name" | "value" | "onChange" | "onBlur"
> {
    name: string;
    label?: React.ReactNode;
    inputClassName?: string;
    wrapperClassName?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Reusable Formik-connected input with optional label and error message.
 * Use inside <Formik><Form>...</Form></Formik>.
 */
export function FormikFieldInput({
    name,
    label,
    inputClassName,
    wrapperClassName,
    id,
    onChange,
    ...inputProps
}: FormikFieldInputProps) {
    const inputId = id ?? name;

    return (
        <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
            <Field name={name}>
                {({ field, meta }: FieldProps<string>) => {
                    const showError = !!meta.touched && !!meta.error;

                    return (
                        <>
                            <Input
                                label={label}
                                id={inputId}
                                {...inputProps}
                                {...field}
                                onChange={e => {
                                    field.onChange(e);
                                    onChange?.(e);
                                }}
                                className={inputClassName}
                                error={showError ? meta.error : undefined}
                                aria-invalid={showError}
                            />
                        </>
                    );
                }}
            </Field>
        </div>
    );
}
