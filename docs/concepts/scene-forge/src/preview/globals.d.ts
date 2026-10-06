export {};
declare global {
  interface Window {
    __FORGE__: import('./contracts.js').PreviewPayload;
    forgeReady: boolean;
    forgeError?: string;
    forgeViewer: {
      setView(view: string): void;
      setGrid(visible: boolean): void;
      clearSelection(): void;
      render(): void;
      getCamera(): import('../domain/schema.js').CameraSnapshot;
      configureCapture(
        request: import('../domain/schema.js').CameraRequest,
        wireframe: boolean,
      ): void;
      stats: import('../application/compiler.js').SceneStats;
      getSource(): import('../domain/schema.js').SceneDocument;
      getEdits(): unknown;
      select(id?: string): void;
      addModel(id: string): string;
      undo(): void;
      redo(): void;
    };
  }
}
