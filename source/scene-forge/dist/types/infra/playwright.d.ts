/**
 * Playwright is an optional runtime dependency. The package build lists it, but the
 * standalone executable never bundles it, so browser commands resolve it lazily.
 */
export type PlaywrightModule = typeof import('playwright');
export interface PlaywrightLocation {
    /** `default`: the running module's own resolution; otherwise the resolved entry file. */
    resolvedFrom: string;
    module: PlaywrightModule;
}
export interface PlaywrightEnvironment {
    cwd: string;
    entry?: string;
    execPath: string;
    platform: NodeJS.Platform;
}
/**
 * Fallback directories, in order: the working directory, the Scene Forge package beside
 * a repository-level `bin/scene-forge`, and the global npm module root of this Node.
 * NODE_PATH is honored by every lookup.
 */
export declare function playwrightSearchRoots(environment: PlaywrightEnvironment): string[];
export declare const playwrightRemedies: string[];
/** Resolve Playwright or fail with PLAYWRIGHT_UNAVAILABLE and the searched locations. */
export declare function loadPlaywright(environment?: PlaywrightEnvironment, importDefault?: () => Promise<PlaywrightModule>): Promise<PlaywrightLocation>;
