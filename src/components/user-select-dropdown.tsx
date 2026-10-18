"use client";

import { useEffect, useMemo, useState } from "react";

import { CreatableSelectField } from "@/components/ui/creatable-select";
import { useUsers } from "@/hooks/useUsers";

/**
 * UserSelectDropdown - a reusable searchable + creatable user dropdown.
 *
 * Built on the shared `CreatableSelectField` so the chevron, dropdown menu,
 * focus ring and error styling always match the rest of the app.
 *
 * Lists user names from the users GET API while also allowing a custom
 * assignee name: typing filters the options, and the typed text is always
 * kept as the field value — no option selection required.
 */
export function UserSelectDropdown({
    value = "",
    onChange,
    label,
    placeholder,
    isDisabled = false,
    isClearable = true,
    smallLabel,
    wrapperClassName,
    inputClassName,
    id,
    error,
}: {
    /** Current assignee name — an existing user name or custom typed text. */
    value?: string;
    /** Called on every keystroke (search text and field value stay in sync). */
    onChange: (value: string) => void;
    label?: React.ReactNode;
    placeholder?: string;
    isDisabled?: boolean;
    isClearable?: boolean;
    smallLabel?: boolean;
    wrapperClassName?: string;
    inputClassName?: string;
    id?: string;
    /** Optional validation error shown under the field. */
    error?: string;
}) {
    const { users, loading } = useUsers();
    const [inputValue, setInputValue] = useState(value ?? "");
    const [isFocused, setIsFocused] = useState(false);

    // Sync external value changes (edit mode, reset, clear) while the user
    // is not actively typing.
    useEffect(() => {
        if (!isFocused) setInputValue(value ?? "");
    }, [value, isFocused]);

    // Display user names only.
    const options = useMemo(
        () => users.map(user => ({ value: user.name, label: user.name })).filter(o => o.value),
        [users],
    );

    // While typing, show only the search text (no selected chip) so keystrokes
    // never get hidden behind a stale selection. When blurred, show the
    // committed value — including custom names not present in the options.
    const selectedOption =
        !isFocused && value ? { value, label: value } : null;

    return (
        <CreatableSelectField
            id={id ?? "assignee"}
            label={label}
            smallLabel={smallLabel}
            options={options}
            value={selectedOption}
            inputValue={inputValue}
            onInputChange={newValue => {
                setInputValue(newValue);
                // Keep the field value synchronized with the search keyword so a
                // manually typed assignee is retained without picking an option.
                if (newValue !== value) onChange(newValue);
            }}
            onChange={selectedValue => {
                setInputValue(selectedValue);
                onChange(selectedValue);
            }}
            onCreateOption={createdValue => {
                const trimmed = createdValue.trim();
                setInputValue(trimmed);
                onChange(trimmed);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
                setIsFocused(false);
                // Commit whatever was typed, even if the menu was dismissed
                // without an explicit selection.
                const trimmed = inputValue.trim();
                if (trimmed !== (value ?? "")) onChange(trimmed);
            }}
            placeholder={loading ? "Loading users..." : (placeholder ?? "Search or enter assignee name")}
            isLoading={loading}
            isDisabled={isDisabled}
            isClearable={isClearable}
            wrapperClassName={wrapperClassName}
            selectClassName={inputClassName}
            errorMessage={error}
            showError={!!error}
        />
    );
}

