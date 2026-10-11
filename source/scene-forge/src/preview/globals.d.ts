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
      getCamera(): import('../kernel-render.js').CameraSnapshot;
      configureCapture(
        request: import('../kernel-render.js').CameraRequest,
        wireframe: boolean,
      ): void;
      stats: import('../kernel-render.js').SceneStats;
      getSource(): import('../kernel-render.js').SceneDocument;
      getEdits(): unknown;
      select(id?: string): void;
      addModel(id: string): string;
      undo(): void;
      redo(): void;
    };
  }
}
