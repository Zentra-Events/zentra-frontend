"use client";

import { useEffect, useMemo, useState } from "react";

import { CreatableSelectField } from "@/components/ui/creatable-select";
import { useUsers } from "@/hooks/useUsers";
import { useSearchUsers } from "@/hooks/useSearchUsers";

/**
 * UserSelectDropdown - a reusable searchable + creatable user dropdown.
 *
 * Built on the shared `CreatableSelectField` so the chevron, dropdown menu,
 * focus ring and error styling always match the rest of the app.
 *
 * By default (`enableApiSearch = false`) it lists users from the centralized
 * cached `useUsers()` store and filters them client-side, preserving existing
 * behaviour for all consumers.
 *
 * When `enableApiSearch` is true, typing triggers a backend search against
 * `GET /api/users?page=&size=&search=` with debounced input, zero-based
 * pagination and a "Load more" row for additional pages. The centralized
 * user cache is no longer the source of the option list in this mode.
 */
export function UserSelectDropdown({
    value = "",
    onChange,
    label,
    placeholder,
    isDisabled = false,
    isClearable = true,
    isCreatable = true,
    smallLabel,
    wrapperClassName,
    inputClassName,
    id,
    error,
    enableApiSearch = false,
    pageSize = 10,
}: {
    /** Current assignee name — an existing user name or custom typed text. */
    value?: string;
    /** Called on every keystroke (search text and field value stay in sync). */
    onChange: (value: string) => void;
    label?: React.ReactNode;
    placeholder?: string;
    isDisabled?: boolean;
    isClearable?: boolean;
    /** Whether typing a new name creates a custom option. Defaults to true. */
    isCreatable?: boolean;
    smallLabel?: boolean;
    wrapperClassName?: string;
    inputClassName?: string;
    id?: string;
    /** Optional validation error shown under the field. */
    error?: string;
    /** When true, search users via the backend API instead of the cached list. */
    enableApiSearch?: boolean;
    /** Page size for backend search. Defaults to 10. */
    pageSize?: number;
}) {
    const { users, loading: usersLoading, error: usersError } = useUsers();
    const {
        users: searchedUsers,
        loading: searchLoading,
        error: searchError,
        setSearch,
        hasMore,
        loadMore,
        reset,
    } = useSearchUsers(pageSize, enableApiSearch);
    const [inputValue, setInputValue] = useState(value ?? "");
    const [isFocused, setIsFocused] = useState(false);

    const isLoading = usersLoading || searchLoading;
    const dropdownError = searchError || usersError;

    const options = useMemo(() => {
        const list = enableApiSearch ? searchedUsers : users;
        if (dropdownError) return [{ value: "", label: "Failed to load users" }];
        return list.map(user => ({ value: user.name, label: user.name })).filter(o => o.value);
    }, [enableApiSearch, searchedUsers, users, dropdownError]);

    // Sync external value changes (edit mode, reset, clear) while the user
    // is not actively typing. In API search mode this also clears the current
    // search so the newly selected user's page loads fresh.
    useEffect(() => {
        if (!isFocused) {
            setInputValue(value ?? "");
            if (enableApiSearch) reset();
        }
    }, [value, isFocused, enableApiSearch, reset]);

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
                if (enableApiSearch) setSearch(newValue);
            }}
            onChange={selectedValue => {
                setInputValue(selectedValue);
                onChange(selectedValue);
            }}
            onCreateOption={isCreatable ? createdValue => {
                const trimmed = createdValue.trim();
                setInputValue(trimmed);
                onChange(trimmed);
            } : undefined}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
                setIsFocused(false);
                // Commit whatever was typed, even if the menu was dismissed
                // without an explicit selection.
                const trimmed = inputValue.trim();
                if (trimmed !== (value ?? "")) onChange(trimmed);
            }}
            placeholder={isLoading ? "Loading users..." : (placeholder ?? "Search or enter assignee name")}
            isLoading={isLoading}
            isDisabled={isDisabled}
            isClearable={isClearable}
            wrapperClassName={wrapperClassName}
            selectClassName={inputClassName}
            errorMessage={error}
            showError={!!error}
            loadMore={
                enableApiSearch && hasMore
                    ? { label: "Load more users", onLoad: loadMore }
                    : undefined
            }
        />
    );
}
