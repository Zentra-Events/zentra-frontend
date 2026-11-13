"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated, isLoading, sessionExpired } = useAuth();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            const returnTo = typeof window === "undefined"
                ? pathname
                : `${pathname}${window.location.search}${window.location.hash}`;
            const query = new URLSearchParams({ returnTo });
            if (sessionExpired) query.set("reason", "expired");
            router.replace(`/login?${query.toString()}`);
        }
    }, [isAuthenticated, isLoading, pathname, router, sessionExpired]);

    // Show loading state while checking authentication
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    // Don't render children if not authenticated
    if (!isAuthenticated) {
        return null;
    }

    return <>{children}</>;
}
