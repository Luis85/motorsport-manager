/**
 * Runtime assets compiled into the standalone executable (bin/scene-forge).
 *
 * Source and package builds keep this empty and read files beside the build. The
 * standalone build (scripts/standalone.mjs) substitutes this module with the
 * offline viewer, its stylesheet and the example catalog, keyed by asset name.
 */
export declare const embeddedAssets: Readonly<Record<string, string>> | undefined;
