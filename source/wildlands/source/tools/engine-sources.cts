/// <reference path="../engine-export-contracts.d.ts" />
/**
 * Pure transforms of the trusted engine-source bundle, shared by the build (engine-export-bundle.cts)
 * and engine distributions (the bundled CLI and game builder) that run without a compiler.
 *
 * - `engineOnlySources` removes the bundled game folders (`games/<id>/`) the build composes for its
 *   own fixtures: engine distributions carry no game, so the payload a Godot project or a studio
 *   artifact receives from them is the engine alone (its identity is recomputed the same way).
 * - `sourceLoader` encodes a bundle as the browser engine-source loader with the pinned pure
 *   JavaScript pako encoder, so the bytes do not depend on the Node release.
 */
import {createHash} from 'node:crypto';
import {INSERTS} from './build-inserts.cjs';
// pako ships no declarations; the pinned pure-JS encoder keeps payload bytes independent of Node's zlib.
const pako=require('pako') as {gzip(data:string|Uint8Array,options:{level:number}):Uint8Array};
const digest=(text:string|Uint8Array):string=>createHash('sha256').update(text).digest('hex');
/** Inventory note recorded when engine distributions drop the build's bundled game folders. */
export const GAMES_EXCLUDED='games/ (game folders are data distributed separately; build them with wildlands build-game --game DIR)';

/**
 * Vendor scripts the HTML artifacts inline verbatim. Profiles that declare the loader must inline
 * them unminified (artifact-profiles.cts checks this), so the browser loader stores them empty and
 * restores each from its identical inline script by length and SHA-256. Text the HTML parser would
 * normalize (CR, NUL) is never deduplicated.
 */
export function inlineVendorScripts(bundle:LWEngineExport.SourceBundle):LWEngineExport.InlineSource[]{
 const inlined=new Set(INSERTS.filter(insert=>insert[2]==='script'&&insert[1].startsWith('../vendor/')).map(insert=>insert[1].slice(3)));
 return bundle.files.filter(file=>inlined.has(file.path)&&file.encoding==='utf8'&&!/[\r\0]/.test(file.text)).map(file=>({path:file.path,bytes:file.bytes,sha256:file.sha256}));
}

/** The browser loader of a bundle: vendor scripts stored empty, the rest gzip level 9. */
export function sourceLoader(bundle:LWEngineExport.SourceBundle):LWEngineExport.SourceLoader{
 const inlineScripts=inlineVendorScripts(bundle),shared=new Set(inlineScripts.map(entry=>entry.path));
 const stored=JSON.stringify({...bundle,files:bundle.files.map(file=>shared.has(file.path)?{...file,text:''}:file)}),compressed=Buffer.from(pako.gzip(stored,{level:9}));
 return {format:'littlewild-engine-source-loader',schemaVersion:1,identity:bundle.identity,decodedBytes:Buffer.byteLength(stored),compressedBytes:compressed.byteLength,encoding:'gzip-base64',data:compressed.toString('base64'),inlineScripts};
}

/**
 * The exact engine-source bundle text without game content: the build's bundled game folders
 * (`games/<id>/`). Engine directories under `source/` hold only engine data (the architecture
 * check enforces architecture/engine-data.json), so nothing else is game data. Text without such
 * entries is returned unchanged, so the transform is idempotent.
 */
export function engineOnlySources(text:string):string{
 const bundle=JSON.parse(text) as LWEngineExport.SourceBundle;
 if(bundle.format!=='littlewild-engine-sources'||!Array.isArray(bundle.files))throw Error('Trusted engine-source bundle is invalid. Rebuild Wildlands.');
 const game=(file:string):boolean=>file.startsWith('games/');
 if(!bundle.files.some(file=>game(file.path)))return text;
 const files=bundle.files.filter(file=>!game(file.path));
 const inventory={...bundle.inventory,included:files.map(file=>file.path),excluded:[...bundle.inventory.excluded,GAMES_EXCLUDED].sort()};
 return JSON.stringify({...bundle,identity:digest(files.map(file=>file.path+'\0'+file.sha256+'\n').join('')),files,inventory});
}
