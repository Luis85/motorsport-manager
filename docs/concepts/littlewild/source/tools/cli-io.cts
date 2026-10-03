import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/** Bound the actual bytes read, not merely an earlier stat that can race a writer. */
export function readBytesFile(file: string, maxBytes: number): Uint8Array {
  const descriptor = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK ?? 0));
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size > maxBytes) throw new Error(`Choose a regular JSON file of at most ${maxBytes} bytes: ${file}`);
    const buffer = new Uint8Array(maxBytes + 1);
    let bytes = 0;
    while (bytes < buffer.length) {
      const count = fs.readSync(descriptor, buffer, bytes, buffer.length - bytes, null);
      if (!count) break;
      bytes += count;
    }
    if (bytes > maxBytes) throw new Error(`JSON file exceeds ${maxBytes} bytes: ${file}`);
    return buffer.subarray(0, bytes);
  } finally { fs.closeSync(descriptor); }
}

export function readJsonFile(file: string, maxBytes: number): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(readBytesFile(file, maxBytes));
}

/** Unique, exclusively created temporaries belong to this attempt; cleanup cannot delete another writer's file. */
export function writeJsonFile(file: string, value: unknown, inputs: readonly string[] = []): string {
  if (!file) throw new Error("Provide an output .json path.");
  const destination = path.resolve(file);
  for (const input of inputs) {
    if (destination === path.resolve(input)) throw new Error("Output must not overwrite an input file.");
    if (fs.existsSync(destination) && fs.existsSync(input)) {
      const target = fs.statSync(destination), source = fs.statSync(input);
      if (target.dev === source.dev && target.ino === source.ino) throw new Error("Output must not overwrite an input file through an alias.");
    }
  }
  const temporary = destination + "." + randomUUID() + ".tmp";
  let owned = false;
  try {
    const descriptor = fs.openSync(temporary, "wx");
    owned = true;
    try { fs.writeFileSync(descriptor, JSON.stringify(value, null, 2) + "\n", "utf8"); }
    finally { fs.closeSync(descriptor); }
    fs.renameSync(temporary, destination);
    owned = false;
  } finally { if (owned) fs.rmSync(temporary, { force: true }); }
  return destination;
}

export function helpRequested(args: readonly string[]): boolean {
  return args.length === 0 || (args.length === 1 && ["--help", "-h"].includes(args[0]!));
}
export function emit(value: unknown): void { process.stdout.write(JSON.stringify(value, null, 2) + "\n"); }
