import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DetailSideBottom } from "../detail-side-bottom";
import { Enquiry } from "@/types/enquiry";

const enquiry = {
    id: "enq-1",
    eventID: "evt-1",
    client: "client-1",
    clientName: "Client One",
    date: "2026-01-01",
    poc: "poc-1",
    status: "OPEN",
    assignee: "Rahul",
} as Enquiry;

function renderBottom(props: Partial<Parameters<typeof DetailSideBottom>[0]> = {}) {
    const base = {
        e: enquiry,
        canWrite: true,
        canDelete: false,
        cloning: false,
        onClone: vi.fn(),
        onDelete: vi.fn(),
        onPDF: vi.fn(),
    };
    return render(<DetailSideBottom {...base} {...props} />);
}

describe("DetailSideBottom - delete access control", () => {
    it("shows Clone but hides Delete for a write user who is not super_admin", () => {
        renderBottom({ canWrite: true, canDelete: false });

        expect(screen.getByRole("button", { name: /clone enquiry/i })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument();
    });

    it("shows Delete only when canDelete is true (super_admin)", () => {
        renderBottom({ canWrite: true, canDelete: true });

        expect(screen.getByRole("button", { name: /clone enquiry/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
    });

    it("shows Delete without Clone when only canDelete is true", () => {
        renderBottom({ canWrite: false, canDelete: true });

        expect(screen.getByRole("button", { name: /^delete$/i })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /clone enquiry/i })).not.toBeInTheDocument();
    });

    it("hides both Clone and Delete when neither canWrite nor canDelete", () => {
        renderBottom({ canWrite: false, canDelete: false });

        expect(screen.queryByRole("button", { name: /clone enquiry/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument();
    });

    it("calls onDelete when Delete is clicked", () => {
        const onDelete = vi.fn();
        renderBottom({ canWrite: true, canDelete: true, onDelete });

        fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
        expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it("does not call onDelete when Delete is not rendered", () => {
        const onDelete = vi.fn();
        renderBottom({ canWrite: true, canDelete: false, onDelete });

        expect(screen.queryByRole("button", { name: /^delete$/i })).not.toBeInTheDocument();
        expect(onDelete).not.toHaveBeenCalled();
    });
});
