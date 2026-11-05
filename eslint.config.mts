import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig({
    ignores: [
        "node_modules/",
        ".next/",
        "out/",
        "build/",
        "coverage/",
        "test-results/",
        "playwright-report/",
        "playwright/.cache/",
        ".netlify/",
        ".agents/",
        "*.tsbuildinfo",
        "next-env.d.ts",
    ],
}, [
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
        plugins: { js },
        extends: ["js/recommended"],
        languageOptions: { globals: globals.browser },
    },
    tseslint.configs.recommended,
    {
        rules: {
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
        },
    },
]);
