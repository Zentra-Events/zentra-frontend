"use client";
import { EnquiriesProvider } from "@/context/enquiries";
import NavigationLoader from "@/components/navigation-loader";
import { EstimatePrefillProvider } from "@/context/estimate-prefill";
import { EventPrefillProvider } from "@/context/event-prefill";
import ProtectedRoute from "@/components/protected-route";
import { ReactNode } from "react";
import { AppShellHeader, AppShellSidebar } from "@/components/layout";
import { Access } from "@/components/access";
import { usePathname } from "next/navigation";
import { matchRoutePermission } from "@/lib/utils/permissions";
import { DraftProvider } from "@/lib/draft/provider";

export default function AppShellLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();

    // Get permissions for current route
    const currentRoutePermissions = matchRoutePermission(pathname);

    return (
        <ProtectedRoute>
            <div className="flex h-screen flex-col overflow-hidden">
                <AppShellHeader />
                <div className="flex min-h-0 flex-1">
                    <NavigationLoader />
                    <AppShellSidebar />
                    <main className="flex-1 overflow-y-auto bg-background">
                        <EventPrefillProvider>
                            <EstimatePrefillProvider>
                                <EnquiriesProvider>
                                    <DraftProvider>
                                        <div className="relative mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 min-h-full">
                                        <Access
                                            roles={currentRoutePermissions?.roles}
                                            scopes={currentRoutePermissions?.scopes}
                                        >
                                            {hasAccess => {
                                                if (!hasAccess) {
                                                    return (
                                                        <div
                                                            className="absolute inset-0 flex items-center justify-center"
                                                            style={{
                                                                top: "50%",
                                                                zIndex: 10,
                                                                transform: "translateY(-50%)",
                                                            }}
                                                        >
                                                            <div className="text-center">
                                                                <h1 className="text-2xl font-bold text-red-600 mb-4">
                                                                    Unauthorized Access
                                                                </h1>
                                                                <p className="text-muted-foreground">
                                                                    You don&apos;t have permission
                                                                    to access this page.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return children;
                                            }}
                                        </Access>
                                    </div>
                                </DraftProvider>
                                </EnquiriesProvider>
                            </EstimatePrefillProvider>
                        </EventPrefillProvider>
                    </main>
                </div>
            </div>
        </ProtectedRoute>
    );
}
