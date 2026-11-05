import { render as rtlRender, RenderOptions } from "@testing-library/react";
import { ReactNode } from "react";
import { AppProviders } from "@/context/app-providers";

const customRender = (
    ui: ReactNode,
    options?: Omit<RenderOptions, "wrapper">,
) => {
    return rtlRender(ui, {
        wrapper: AppProviders,
        ...options,
    });
};

export * from "@testing-library/react";
export { customRender as render };
