"use client";
import { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import ReactSelect, {
    components,
    ControlProps,
    DropdownIndicatorProps,
    LoadingIndicatorProps,
    MenuProps,
    OptionProps,
    Props as ReactSelectProps,
} from "react-select";

interface SelectOption {
    label: string;
    value: string;
}

interface SelectComponentProps extends Omit<ReactSelectProps<SelectOption, false>, "components"> {
    label?: string | ReactNode;
    error?: string;
    hint?: string;
    options?: SelectOption[];
    placeholder?: string;
    className?: string;
    smallLabel?: boolean;
}

const CustomControl = ({ children, ...props }: ControlProps<SelectOption>) => (
    <components.Control {...props}>{children}</components.Control>
);

const CustomMenu = ({ children, ...props }: MenuProps<SelectOption>) => (
    <components.Menu {...props}>{children}</components.Menu>
);

const CustomOption = ({ children, ...props }: OptionProps<SelectOption>) => (
    <components.Option {...props}>{children}</components.Option>
);

// Spinner shown on the right side of the control while `isLoading` is true.
const CustomLoadingIndicator = (props: LoadingIndicatorProps<SelectOption>) => (
    <div
        {...props.innerProps}
        className="flex items-center pr-2.5 text-muted-foreground"
    >
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
    </div>
);

// The chevron is replaced by the loading spinner while a request is pending.
const CustomDropdownIndicator = (props: DropdownIndicatorProps<SelectOption>) => {
    if (props.selectProps.isLoading) return null;
    return <components.DropdownIndicator {...props} />;
};

export const Select = ({
    label,
    error,
    hint,
    options = [],
    placeholder,
    className,
    styles,
    smallLabel,
    ...props
}: SelectComponentProps) => {
    const customStyles: ReactSelectProps<SelectOption, false>["styles"] = {
        container: (provided, _state) => ({
            ...provided,
            width: "100%",
        }),
        control: (provided, state) => ({
            ...provided,
            minHeight: "40px",
            backgroundColor: "var(--surface)",
            borderColor: error
                ? "var(--error)"
                : state.isFocused
                  ? "var(--accent)"
                  : "var(--border)",
            boxShadow: state.isFocused
                ? `0 0 0 2px ${error ? "var(--input-error-ring)" : "var(--input-focus-ring)"}`
                : "none",
            borderRadius: "6px",
            cursor: state.isDisabled ? "not-allowed" : "pointer",
            opacity: state.isDisabled ? 0.6 : 1,
            "&:hover": {
                borderColor: error
                    ? "var(--error)"
                    : state.isFocused
                      ? "var(--accent)"
                      : "var(--border-hover)",
            },
        }),
        singleValue: (provided, state) => ({
            ...provided,
            color: state.isDisabled ? "var(--muted-foreground)" : "var(--foreground)",
            fontSize: "12px",
        }),
        placeholder: (provided, _state) => ({
            ...provided,
            color: "var(--muted-foreground)",
            fontSize: "12px",
        }),
        input: (provided, _state) => ({
            ...provided,
            color: "var(--foreground)",
            margin: 0,
            padding: 0,
        }),
        dropdownIndicator: (provided, _state) => ({
            ...provided,
            color: "var(--muted-foreground)",
            "&:hover": {
                color: "var(--accent)",
            },
        }),
        indicatorSeparator: (provided, _state) => ({
            ...provided,
            display: "none",
        }),
        menu: (provided, _state) => ({
            ...provided,
            backgroundColor: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            zIndex: 50,
        }),
        menuList: (provided, _state) => ({
            ...provided,
            padding: "4px",
        }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isSelected
                ? "var(--primary)"
                : state.isFocused
                  ? "var(--muted)"
                  : "var(--surface-elevated)",
            color: state.isSelected ? "var(--primary-foreground)" : "var(--foreground)",
            cursor: "pointer",
            fontSize: "14px",
            padding: "8px 12px",
            borderRadius: "4px",
            transition: "all 0.15s ease",
            "&:active": {
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
            },
        }),
        noOptionsMessage: (provided, _state) => ({
            ...provided,
            color: "var(--muted-foreground)",
            fontSize: "14px",
        }),
        ...styles,
    };

    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            {label && (
                <label
                    className={cn(
                        // Matches the label box used by CreatableSelectField so
                        // fields rendered side by side stay vertically aligned.
                        "flex min-h-5 flex-wrap items-center gap-1.5 font-medium text-foreground",
                        smallLabel ? "text-xs font-semibold text-muted-foreground" : "text-sm",
                    )}
                >
                    {typeof label === "string" && smallLabel ? label.toUpperCase() : label}
                </label>
            )}
            <ReactSelect<SelectOption, false>
                options={options}
                placeholder={placeholder}
                components={{
                    Control: CustomControl,
                    Menu: CustomMenu,
                    Option: CustomOption,
                    LoadingIndicator: CustomLoadingIndicator,
                    DropdownIndicator: CustomDropdownIndicator,
                }}
                menuPosition="fixed"
                styles={customStyles}
                theme={theme => ({
                    ...theme,
                    colors: {
                        ...theme.colors,
                        primary: "var(--primary)",
                        primary75: "var(--primary-hover)",
                        primary50: "var(--primary-light)",
                        primary25: "var(--primary-light)",
                        danger: "var(--error)",
                        dangerLight: "var(--error-light)",
                        neutral0: "var(--surface)",
                        neutral5: "var(--surface-elevated)",
                        neutral10: "var(--border)",
                        neutral20: "var(--border)",
                        neutral30: "var(--border-hover)",
                        neutral40: "var(--muted-foreground)",
                        neutral50: "var(--muted-foreground)",
                        neutral60: "var(--muted-foreground)",
                        neutral70: "var(--foreground)",
                        neutral80: "var(--foreground)",
                        neutral90: "var(--foreground)",
                    },
                })}
                aria-invalid={!!error}
                {...props}
            />
            {error && <p className="text-xs text-error">{error}</p>}
            {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
};

Select.displayName = "Select";
