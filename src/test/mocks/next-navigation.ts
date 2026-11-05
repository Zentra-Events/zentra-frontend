"use client";

import { vi } from "vitest";

// Mock for next/navigation in Vitest (jsdom) environment
export const useRouter = vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    pathname: "/",
    query: {},
    asPath: "/",
    route: "/",
    isLocaleDomain: false,
    isReady: true,
    isFallback: false,
    fallback: false,
    isPreview: false,
}));

export const usePathname = vi.fn(() => "/");

export const useSearchParams = vi.fn(() => new URLSearchParams());

export const useParams = vi.fn(() => ({}));

export const redirect = vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
});

export const permanentRedirect = vi.fn(() => {
    throw new Error("NEXT_PERMANENT_REDIRECT");
});

export const unstable_reload = vi.fn(() => {
    throw new Error("NEXT_RELOAD");
});

export const serverHooks = {};

export const dynamicParams = "error";

export const defaultMetadataBubble = false;

// Re-export real types for type safety
export type { NextRouter } from "next/router";
