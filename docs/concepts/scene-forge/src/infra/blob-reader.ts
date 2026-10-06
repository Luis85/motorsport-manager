// GLTFExporter needs the browser FileReader API for Blob packing, even without textures.
// This small Node adapter implements only the two operations the exporter uses.
class BlobReader {
  result: string | ArrayBuffer | null = null;
  onloadend: ((event?: unknown) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    blob
      .arrayBuffer()
      .then((value) => {
        this.result = value;
        this.onloadend?.();
      })
      .catch((error) => this.onerror?.(error));
  }
  readAsDataURL(blob: Blob) {
    blob
      .arrayBuffer()
      .then((value) => {
        this.result = `data:${blob.type};base64,${Buffer.from(value).toString('base64')}`;
        this.onloadend?.();
      })
      .catch((error) => this.onerror?.(error));
  }
}
export function installBlobReader() {
  if (!globalThis.FileReader)
    Object.defineProperty(globalThis, 'FileReader', {
      value: BlobReader,
      configurable: true,
      writable: true,
    });
}
