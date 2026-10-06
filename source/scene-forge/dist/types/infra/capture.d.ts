import type { Browser, Page } from 'playwright';
import type { CameraRequest } from '../domain/schema.js';
export type CaptureBrowser = Pick<Browser, 'newPage' | 'close' | 'version'>;
export interface CaptureDependencies {
    createTemp(): Promise<string>;
    launch(): Promise<CaptureBrowser>;
}
export interface CaptureSession {
    temp: string;
    browser: CaptureBrowser;
    page: Page;
    capture(request: CameraRequest, grid: boolean, wireframe?: boolean): Promise<{
        bytes: Buffer;
        camera: import('../domain/schema.js').CameraSnapshot;
    }>;
}
/** A capture owns exactly one browser and workspace. Cleanup also runs on partial initialization. */
export declare function withCaptureSession<T>(html: string, options: {
    width: number;
    height: number;
    ui?: boolean;
}, action: (session: CaptureSession) => Promise<T>, ports?: CaptureDependencies): Promise<T>;
