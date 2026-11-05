import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppProviders } from "@/context/app-providers";

describe("Render component test", () => {
    it("should render a simple component with AppProviders", () => {
        const TestComponent = () => (
            <div data-testid="test-component">
                <h1>Hello World</h1>
                <button data-testid="click-btn">Click me</button>
            </div>
        );

        render(<TestComponent />, { wrapper: AppProviders });

        expect(screen.getByTestId("test-component")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Hello World" })).toBeInTheDocument();
        expect(screen.getByTestId("click-btn")).toBeInTheDocument();
    });

    it("should handle user interaction (button click)", () => {
        const handleClick = vi.fn();
        const TestComponent = () => (
            <div>
                <button data-testid="click-btn" onClick={handleClick}>
                    Click me
                </button>
                <span data-testid="click-count">0</span>
            </div>
        );

        render(<TestComponent />, { wrapper: AppProviders });

        fireEvent.click(screen.getByTestId("click-btn"));
        expect(handleClick).toHaveBeenCalledTimes(1);
    });
});
