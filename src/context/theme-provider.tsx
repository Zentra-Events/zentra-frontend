"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useSyncExternalStore,
    useState,
    type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
    theme: Theme;
    resolvedTheme: "light" | "dark";
    setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyToDOM(resolved: "light" | "dark") {
    document.documentElement.setAttribute("data-theme", resolved);
}

function subscribeToSystemPreference(callback: () => void) {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    mql.addEventListener("change", callback);
    return () => mql.removeEventListener("change", callback);
}

function getSystemSnapshot(): boolean {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getServerSnapshot(): boolean {
    return false;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("light");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
        if (stored && stored !== theme) setThemeState(stored);
        setMounted(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const prefersDark = useSyncExternalStore(
        subscribeToSystemPreference,
        getSystemSnapshot,
        getServerSnapshot
    );

    const resolvedTheme = useMemo<"light" | "dark">(() => {
        if (theme === "system") return prefersDark ? "dark" : "light";
        return theme;
    }, [theme, prefersDark]);

    useEffect(() => {
        if (mounted) applyToDOM(resolvedTheme);
    }, [resolvedTheme, mounted]);

    const setTheme = useCallback((next: Theme) => {
        setThemeState(next);
        localStorage.setItem(STORAGE_KEY, next);
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
    return ctx;
}

/**
 * Inline script to prevent theme flash on initial load.
 * Rendered inside <head> so it executes before paint.
 */
export function ThemeScript() {
    const script = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");var r=t==="dark"?"dark":t==="system"?(window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"):"light";document.documentElement.setAttribute("data-theme",r)}catch(e){document.documentElement.setAttribute("data-theme","light")}})()`;
    return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
