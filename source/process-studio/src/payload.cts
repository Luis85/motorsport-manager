/** Compressed, integrity-checked text payloads embedded in bin/process-studio. */
import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';

/** Raw deflate of UTF-8 text, with the text's size in bytes and its SHA-256. */
export interface Payload {readonly bytes: number; readonly sha256: string; readonly data: string;}

export const sha256 = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex');

/** Inflate and verify one payload; `what` names it in the error. */
export function inflatePayload(item: Payload, what: string): string {
 const raw = inflateRawSync(Buffer.from(item.data, 'base64'), {maxOutputLength: item.bytes});
 if (raw.length !== item.bytes || sha256(raw) !== item.sha256) throw Error(`Embedded ${what} integrity failed. Rebuild bin/process-studio.`);
 return new TextDecoder('utf-8', {fatal: true}).decode(raw);
}
