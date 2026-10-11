import type { Command } from 'commander';
import type { ModelOperation } from '../domain/document.js';
import type { EditOptions } from '../application/edit.js';
import type { LoadedDocument, commitEdit } from '../infra/store.js';

export interface CliRuntime {
  cwd: string;
  stdin: AsyncIterable<string | Uint8Array> & { isTTY?: boolean };
  writeOut: (text: string) => void;
  writeErr: (text: string) => void;
}
/** What every command registration receives. There is no other shared state. */
export interface CommandContext {
  program: Command;
  /** Print `{"ok":true,"data":...}`. */
  output: (value: unknown) => void;
  writeOut: (text: string) => void;
  /** Read JSON from exactly one of --file <path|-> or --data <json>. */
  input: (options: { data?: string; file?: string }) => Promise<unknown>;
  resolvePath: (value: string) => string;
  /** The explicit -d, --document path, resolved; fails when absent. */
  documentPath: () => string;
  load: () => Promise<LoadedDocument>;
  commit: (operations: ModelOperation[], options: EditOptions) => ReturnType<typeof commitEdit>;
}
