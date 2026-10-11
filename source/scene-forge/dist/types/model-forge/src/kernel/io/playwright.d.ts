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
    /**
     * Repository-relative package directory searched beside a repository-level executable.
     * Defaults to `source/scene-forge`, whose lockfile installs Playwright.
     */
    packageDirectory?: string;
}
/**
 * Fallback directories, in order: the working directory, the tool package beside a
 * repository-level executable (default: Scene Forge beside `bin/scene-forge`), and the
 * global npm module root of this Node.
 * NODE_PATH is honored by every lookup.
 */
export declare function playwrightSearchRoots(environment: PlaywrightEnvironment): string[];
export declare const playwrightRemedies: string[];
/** The running process's environment, optionally naming the tool's package directory. */
export declare const playwrightEnvironment: (packageDirectory?: string) => PlaywrightEnvironment;
/** Resolve Playwright or fail with PLAYWRIGHT_UNAVAILABLE and the searched locations. */
export declare function loadPlaywright(environment?: PlaywrightEnvironment, importDefault?: () => Promise<PlaywrightModule>): Promise<PlaywrightLocation>;
