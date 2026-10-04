"use client";

import type { Ref, RefCallback } from "react";
import { CategoryEditor } from "@/components/category-editor";
import { QUANTITY_UNITS, type ArtifactLine } from "@/lib/utils/artifact-utils";

/**
 * Artifacts Section – domain adapter over the reusable category editor.
 *
 * All structure/editing behavior (add/edit/delete, ordering, auto-focus and
 * keyboard navigation) now lives in the generic `CategoryEditor` in
 * `@/components/category-editor`. This component only wires the Artifact
 * domain defaults (quantity units) on top of it.
 */
export interface ArtifactsSectionProps {
    lines: ArtifactLine[];
    onLinesChange: (lines: ArtifactLine[]) => void;
    disabled?: boolean;
    errorLineIds?: Set<string>;
    errorRowRef?: RefCallback<HTMLTableRowElement> | Ref<HTMLTableRowElement>;
}

export function ArtifactsSection({
    lines,
    onLinesChange,
    disabled = false,
    errorLineIds,
}: ArtifactsSectionProps) {
    return (
        <CategoryEditor
            lines={lines}
            onLinesChange={onLinesChange}
            disabled={disabled}
            errorLineIds={errorLineIds}
            unitOptions={QUANTITY_UNITS}
        />
    );
}
