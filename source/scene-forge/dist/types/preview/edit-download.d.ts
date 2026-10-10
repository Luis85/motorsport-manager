import type { SceneDocument } from '../domain/schema.js';
import type { Toast } from './toast.js';
export declare function setupEditDownload({ source, edits, toast, }: {
    source: SceneDocument;
    edits(): {
        operations: unknown[];
    };
    toast: Toast;
}): {
    markDownloaded: () => void;
};
