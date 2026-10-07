import type { Command } from 'commander';
export declare const integer: (value: string) => number;
export declare const at: (text: string) => [number, number, number];
export declare const sourceOptions: (cmd: Command) => Command;
export declare const editOptions: (cmd: Command) => Command;
