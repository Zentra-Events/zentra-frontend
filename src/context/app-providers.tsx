"use client";

import { AuthProvider } from "@/context/auth";
import { UserProvider } from "@/context/users";
import type { ReactNode } from "react";
import { ThemeProvider } from "./theme-provider";

interface ProvidersProps {
    children: ReactNode;
}

export function AppProviders({ children }: ProvidersProps) {
    return (
        <ThemeProvider>
            <AuthProvider>
                <UserProvider>{children}</UserProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}
