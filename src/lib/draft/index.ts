/**
 * Reusable draft management infrastructure barrel.
 *
 * Layer A: generic, domain-agnostic persistence, auto-save, recovery,
 * lifecycle, protection, and cleanup. Layer B (entity adapters) live in
 * ./adapters and are imported directly by the integrating module.
 */

export { draftStorage, DraftStorageService } from "./storage";
export {
    DraftLifecycleManager,
    createDraftLifecycleManager,
} from "./lifecycle";
export { useAutoSave } from "./hooks/use-auto-save";
export { useDraftProtection } from "./hooks/use-draft-protection";
export {
    DraftRecovery,
    createDraftRecovery,
} from "./recovery";
export { draftCleanup, DraftCleanup } from "./cleanup";

export type {
    DraftStatus,
    DraftIdentity,
    DraftRecord,
    DraftMetadata,
    DraftRelation,
    ComparisonResult,
    RecoveryInfo,
    DraftSaveOptions,
    DraftAdapter,
    DraftConfig,
    UseAutoSaveOptions,
    UseAutoSaveResult,
    UseDraftProtectionOptions,
    UseDraftProtectionResult,
} from "./types";
