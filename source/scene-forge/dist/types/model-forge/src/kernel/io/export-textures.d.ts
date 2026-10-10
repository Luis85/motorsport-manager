import type { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
/** Per-export adapter, never a global DOM shim. Keeps headless CLI texture export browser-free. */
export declare function installTextureExport(exporter: GLTFExporter): GLTFExporter;
