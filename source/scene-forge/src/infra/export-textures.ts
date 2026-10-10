import { deflateSync } from 'node:zlib';
import { DataTexture, RGBAFormat, type Texture } from 'three';
import type { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { fail } from '../domain/errors.js';

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name: string, bytes: Uint8Array) {
  const body = Buffer.concat([Buffer.from(name), bytes]);
  const header = Buffer.alloc(4),
    tail = Buffer.alloc(4);
  header.writeUInt32BE(bytes.length);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([header, body, tail]);
}
/** The only accepted textures are bounded compiler-produced RGBA data; no URL/image I/O. */
function png(image: { width: number; height: number; data: Uint8Array }, flipY: boolean) {
  const { width, height, data } = image;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const sourceY = flipY ? height - y - 1 : y;
    rows.set(
      data.subarray(sourceY * width * 4, (sourceY + 1) * width * 4),
      y * (width * 4 + 1) + 1,
    );
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', new Uint8Array()),
  ]);
}
interface ImageWriter {
  json: { images?: { mimeType: string; bufferView?: number; uri?: string }[] };
  options: { binary?: boolean };
  pending: Promise<unknown>[];
  buildNormalMapTextureAsync(map: Texture, flipX: boolean, flipY: boolean): Promise<Texture>;
  processImage(image: unknown, format: number, flipY: boolean): number;
  processBufferViewImage(blob: Blob): Promise<number>;
}
/** Per-export adapter, never a global DOM shim. Keeps headless CLI texture export browser-free. */
export function installTextureExport(exporter: GLTFExporter) {
  exporter.register((writer) => {
    const target = writer as unknown as ImageWriter;
    const cache = new Map<unknown, Map<boolean, number>>();
    // Three r186 bakes the no-tangent normal convention into the green channel.
    // Preserve that conversion for data textures without requiring a DOM canvas.
    target.buildNormalMapTextureAsync = async (map, flipX, flipY) => {
      if (
        !(map instanceof DataTexture) ||
        !(map.image.data instanceof Uint8Array) ||
        map.image.width !== 128 ||
        map.image.height !== 128
      )
        fail(
          'EXPORT_INVALID',
          'Normal texture conversion requires compiler-generated surface data.',
        );
      const pixels = new Uint8Array(map.image.data);
      for (let i = 0; i < pixels.length; i += 4) {
        if (flipX) pixels[i] = 255 - pixels[i];
        if (flipY) pixels[i + 1] = 255 - pixels[i + 1];
      }
      const converted = map.clone();
      converted.source = new DataTexture(pixels, 128, 128).source;
      return converted;
    };
    target.processImage = (input, format, flipY) => {
      const found = cache.get(input)?.get(flipY);
      if (found !== undefined) return found;
      const image = input as { width: number; height: number; data: Uint8Array };
      if (
        !image ||
        format !== RGBAFormat ||
        !(image.data instanceof Uint8Array) ||
        image.width !== 128 ||
        image.height !== 128 ||
        image.data.length !== 128 * 128 * 4
      )
        fail(
          'EXPORT_INVALID',
          'Texture export requires compiler-generated 128×128 RGBA surface data.',
        );
      const encoded = png(image, flipY);
      const definition: { mimeType: string; bufferView?: number; uri?: string } = {
        mimeType: 'image/png',
      };
      if (target.options.binary) {
        target.pending.push(
          target
            .processBufferViewImage(new Blob([new Uint8Array(encoded)], { type: 'image/png' }))
            .then((index) => {
              definition.bufferView = index;
            }),
        );
      } else definition.uri = `data:image/png;base64,${encoded.toString('base64')}`;
      const index = (target.json.images ??= []).push(definition) - 1;
      if (!cache.has(input)) cache.set(input, new Map());
      cache.get(input)!.set(flipY, index);
      return index;
    };
    return {};
  });
  return exporter;
}
