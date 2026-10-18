import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// @ts-expect-error CSS imports are handled by Next.js.
import "./globals.css";
import { siteConfig } from "@/config/site";
import { ThemeScript } from "@/context/theme-provider";
import { AppProviders } from "@/context/app-providers";
import { Toaster } from "@/components/ui/toaster/sonner";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

const { name, description, ogImage, keywords, creator, url } = siteConfig;

export const metadata: Metadata = {
    title: name,
    icons: {
        icon: ogImage,
    },
    description: description,
    keywords: keywords,
    authors: [{ name: creator }],
    openGraph: {
        type: "website",
        locale: "en_US",
        url: url,
        title: name,
        description: description,
        siteName: name,
    },
    twitter: {
        card: "summary_large_image",
        title: name,
        description: description,
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html
            lang="en"
            data-theme="light"
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
            suppressHydrationWarning
        >
            <head>
                <ThemeScript />
            </head>
            <body className="min-h-full flex flex-col bg-background text-foreground">
                <AppProviders>
                    {children}
                    <Toaster />
                </AppProviders>
            </body>
        </html>
    );
}
