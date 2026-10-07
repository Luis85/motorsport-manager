/** Packaged runtime assets: the offline viewer and the bundled example catalog. */
export type AssetName = 'viewer.js' | 'viewer.css' | `examples/${string}`;
/** Read a packaged asset from the executable itself, or from the package build directory. */
export declare function readAsset(name: AssetName): Promise<string>;
