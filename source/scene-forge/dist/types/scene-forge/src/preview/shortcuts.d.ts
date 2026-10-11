export declare function setupShortcuts({ editable, canvas, travel, clearSelection, frame, setMode, remove, }: {
    editable: boolean;
    canvas: HTMLCanvasElement;
    travel(direction: 'undo' | 'redo'): void;
    clearSelection(): void;
    frame(selectionOnly: boolean): void;
    setMode(mode: string): void;
    remove(): void;
}): void;
