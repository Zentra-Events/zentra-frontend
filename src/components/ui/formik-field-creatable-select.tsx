"use client";

import { Field } from "formik";
import type { FieldProps } from "formik";
import { CreatableSelectField } from "./creatable-select";
import type { SelectOption } from "./select-option";

export type { SelectOption } from "./select-option";

export interface FormikFieldCreatableSelectProps {
    name: string;
    label?: React.ReactNode;
    selectClassName?: string;
    wrapperClassName?: string;
    id?: string;
    onChange?: (value: string) => void;
    onCreateOption?: (value: string) => void;
    options?: SelectOption[];
    placeholder?: string;
    isDisabled?: boolean;
    isClearable?: boolean;
    value?: SelectOption | null;
}

/**
 * Formik-connected wrapper around CreatableSelectField.
 * Use inside <Formik><Form>...</Form></Formik>.
 */
export function FormikFieldCreatableSelect({
    name,
    label,
    selectClassName,
    wrapperClassName,
    id,
    onChange,
    onCreateOption,
    options = [],
    placeholder,
    isDisabled,
    isClearable,
    value,
}: FormikFieldCreatableSelectProps) {
    const selectId = id ?? name;

    return (
        <Field name={name}>
            {({ field, meta }: FieldProps<string>) => {
                const showError = !!meta.touched && !!meta.error;
                const errorMessage = meta.error;

                // Find the selected option from options list or use the value prop
                const selectedOption = value
                    ? value
                    : options.find(opt => opt.value === field.value);

                return (
                    <CreatableSelectField
                        id={selectId}
                        label={label}
                        wrapperClassName={wrapperClassName}
                        selectClassName={selectClassName}
                        value={selectedOption || null}
                        onChange={selectedValue => {
                            field.onChange({ target: { name, value: selectedValue } });
                            onChange?.(selectedValue);
                        }}
                        onCreateOption={inputValue => {
                            field.onChange({ target: { name, value: inputValue } });
                            onCreateOption?.(inputValue);
                        }}
                        options={options}
                        placeholder={placeholder}
                        isDisabled={isDisabled}
                        isClearable={isClearable}
                        showError={showError}
                        errorMessage={errorMessage}
                    />
                );
            }}
        </Field>
    );
}
