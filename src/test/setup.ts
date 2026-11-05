import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, beforeAll, afterAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import indexedDBFactory from "fake-indexeddb";

// Global IndexedDB setup
beforeAll(() => {
    (globalThis as any).indexedDB = indexedDBFactory;
    (globalThis as any).IDBRange = (indexedDBFactory as any).IDBRange;
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

// Mock matchMedia for jsdom
Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Mock scrollTo
Object.defineProperty(window, "scrollTo", {
    writable: true,
    value: vi.fn(),
});

// Suppress console errors/warnings during tests unless explicitly tested
const originalError = console.error;
const originalWarn = console.warn;

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    vi.spyOn(console, "error").mockRestore();
    vi.spyOn(console, "warn").mockRestore();
});
