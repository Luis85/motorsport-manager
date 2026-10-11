/**
 * Runtime assets compiled into the standalone executable (bin/model-forge).
 *
 * Source and package builds keep this empty and read files from disk. The standalone build
 * (scripts/standalone.mjs) substitutes this module with the render-only page script and
 * the example models, keyed by asset name.
 */
export const embeddedAssets: Readonly<Record<string, string>> | undefined = undefined;
