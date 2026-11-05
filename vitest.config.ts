import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/test/setup.ts"],
        include: ["src/**/*.{test,spec}.{ts,tsx}"],
        exclude: ["node_modules", ".next", "dist", "tests/e2e"],
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "json"],
            include: ["src/**/*.{ts,tsx}"],
            exclude: [
                "src/test/**",
                "src/**/*.test.{ts,tsx}",
                "src/**/*.spec.{ts,tsx}",
                "src/app/**",
                "src/components/ui/**",
                "src/lib/**",
                "src/config/**",
                "src/constants/**",
                "src/types/**",
            ],
        },
        pool: "forks",
        maxWorkers: 2,
        deps: {
            optimizer: {
                client: {
                    enabled: true,
                },
            },
        },
    },
    resolve: {
        alias: {
            "@": import.meta.dirname + "/src",
            "next/navigation": import.meta.dirname +
                "/src/test/mocks/next-navigation.ts",
            "next/image": import.meta.dirname + "/src/test/mocks/next-image.tsx",
        },
    },
    define: {
        "process.env.NODE_ENV": JSON.stringify("test"),
    },
});
