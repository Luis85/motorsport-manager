/**
 * Test support: disposable game folders for game-build, CLI and browser suites.
 *
 * Every fixture is a real data-only game folder under a fresh temporary games root: a copy of the
 * repository's own folder (docs/concepts/<id>, or WILDLANDS_GAMES_DIR) — Littlewild for colony
 * fixtures, RTS Frontier and Pocket Pet for template fixtures — optionally renamed.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gamesRoot} from '../tools/game-folder.cjs';

type Plain = Record<string, unknown>;
const read = (file: string): Plain => JSON.parse(fs.readFileSync(file, 'utf8')) as Plain;
const write = (file: string, value: unknown): void => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

/** A fresh games root; remove it with `fs.rmSync(root, {recursive: true, force: true})`. */
export function gamesFixtureRoot(prefix = 'wildlands-games-'): string {
 return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}
/** Rename a copied folder's game: id, storage namespace and demo output follow the folder name. */
function rename(directory: string, id: string, change?: (manifest: Plain) => void): string {
 const file = path.join(directory, 'game.json'), manifest = read(file);
 manifest.id = id; manifest.storage = {namespace: id === 'littlewild' ? 'littlewild' : 'wildlands.' + id};
 (manifest.targets as {html: Plain}).html.output = `demos/${id}.html`;
 change?.(manifest);
 write(file, manifest);
 return directory;
}
/** A copy of the Littlewild folder, optionally renamed and with its manifest changed. */
export function colonyGame(root: string, id = 'littlewild', change?: (manifest: Plain) => void): string {
 const directory = path.join(root, id);
 fs.cpSync(path.join(gamesRoot(), 'littlewild'), directory, {recursive: true});
 return rename(directory, id, change);
}
/** A copy of the RTS Frontier or Pocket Pet folder (`rts-frontier` / `pocket-pet` unless renamed). */
export function templateGame(kind: 'rts' | 'pet', root: string, id = kind === 'rts' ? 'rts-frontier' : 'pocket-pet', change?: (manifest: Plain) => void): string {
 const directory = path.join(root, id);
 fs.cpSync(path.join(gamesRoot(), kind === 'rts' ? 'rts-frontier' : 'pocket-pet'), directory, {recursive: true});
 return rename(directory, id, change);
}
