/** Artifacts: `build` (one offline HTML file from the embedded engine kit) and `forge` (a Scene Forge project). */
import {catalog, writeForgeProject, writeTextFile} from '../kernel.cjs';
import {buildHtml} from '../assemble.cjs';
import {distribution} from '../kit.cjs';
import type {Context} from '../io.cjs';

export function build(ctx: Context): void {
 const file = ctx.required('--input'), definition = catalog.admit(ctx.read(file)), target = ctx.required('--output');
 if (!target.endsWith('.html')) throw Error('Build output must end in .html.');
 const result = buildHtml(definition, distribution().kit());
 ctx.success({output: writeTextFile(target, result.html, [file]), bytes: result.bytes, sha256: result.sha256});
}

export function forge(ctx: Context): void {
 const file = ctx.required('--input'), definition = catalog.admit(ctx.read(file));
 ctx.success(writeForgeProject(definition, ctx.required('--output')));
}
