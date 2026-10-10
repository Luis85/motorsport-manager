import { loadProjectScenes } from '../infra/project.js';
import { Option } from 'commander';
import type { AddressInfo } from 'node:net';
import { createServer } from 'node:http';
import {
  fail,
  viewNames,
  errorMessage,
  authoringTarget,
  exportScene,
  exportFormats,
  validateExport,
  type ExportFormat,
} from '../kernel.js';
import { atomicWrite } from '../infra/files.js';
import { createPreview, createProjectPreview, screenshot } from '../infra/preview.js';
import { integer } from './options.js';
import { parseParameters } from './input.js';
import type { CommandContext } from './context.js';
export function registerOutputsCommands(c: CommandContext) {
  const { program, snapshot, output, resolvePath, global } = c;
  program
    .command('export')
    .description('Export the current scene or one node subtree')
    .addOption(new Option('-f, --format <format>').choices([...exportFormats]).default('glb'))
    .requiredOption('-o, --out <path>', 'Output file')
    .option('--validate', 'Run Khronos validation; reject invalid glTF before writing')
    .option('--node <id>', 'Export one authored node at its world transform')
    .option('--model <id>', 'Export a standalone model')
    .option('--parameters <json>', 'Model parameter overrides')
    .action(async (opts) => {
      const s = await snapshot();
      const target = authoringTarget(s.scene, s.models, {
        model: opts.model,
        node: opts.node,
        parameters: opts.parameters ? parseParameters(opts.parameters) : undefined,
      });
      const result = await exportScene(target, s.models, opts.format as ExportFormat, opts.node);
      const validation = opts.validate ? await validateExport(result.data, opts.format) : undefined;
      if (validation && validation.numErrors)
        fail(
          'EXPORT_INVALID',
          'Khronos validation rejected the export; no output was written.',
          validation,
        );
      await atomicWrite(resolvePath(opts.out), result.data);
      output({
        path: resolvePath(opts.out),
        format: opts.format,
        bytes: Buffer.byteLength(result.data),
        stats: result.stats,
        warnings: result.warnings,
        validation,
      });
    });
  program
    .command('preview')
    .description('Generate an offline Three.js scene composer')
    .option('--all-scenes', 'Bundle all project scenes with an offline scene chooser')
    .option('--model <id>', 'Inspect one model without editing a scene')
    .option('--node <id>', 'Isolate a subtree')
    .option('--parameters <json>', 'Model parameter overrides')
    .option('-o, --out <path>', 'Output HTML', 'preview.html')
    .option('--serve', 'Serve on localhost and rebuild on page refresh')
    .option('--port <port>', 'Local port; 0 chooses an available port', integer, 0)
    .action(async (opts) => {
      if (opts.allScenes && (opts.model || opts.node || opts.parameters))
        fail(
          'INVALID_OPTION',
          '--all-scenes cannot be combined with a model, node or parameter target.',
        );
      const buildPage = async () => {
        if (opts.allScenes) {
          const project = await loadProjectScenes(global().project);
          return createProjectPreview(
            project.scenes,
            project.models,
            global().scene ?? project.manifest.activeScene,
          );
        }
        const s = await snapshot();
        return createPreview(
          authoringTarget(s.scene, s.models, {
            model: opts.model,
            node: opts.node,
            parameters: opts.parameters ? parseParameters(opts.parameters) : undefined,
          }),
          s.models,
          { stateHash: s.stateHash, editable: !opts.model && !opts.node },
        );
      };
      const html = await buildPage();
      await atomicWrite(resolvePath(opts.out), html);
      if (!opts.serve) {
        output({ path: resolvePath(opts.out), offline: true });
        return;
      }
      if (opts.port > 65535) fail('INVALID_OPTION', 'Port must be between 0 and 65535.');
      const server = createServer(async (req, res) => {
        if (!['/', '/index.html'].includes(new URL(req.url ?? '/', 'http://localhost').pathname)) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        try {
          const page = await buildPage();
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          });
          res.end(page);
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Scene build failed: ' + errorMessage(error));
        }
      });
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(opts.port, '127.0.0.1', () => resolve());
      });
      output({
        path: resolvePath(opts.out),
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        rebuild: 'Refresh the browser after editing the scene. Ctrl+C stops the server.',
      });
      process.once('SIGINT', () => server.close());
      process.once('SIGTERM', () => server.close());
    });
  program
    .command('screenshot')
    .description('Render a PNG through headless Chromium')
    .option('--model <id>', 'Capture a standalone model')
    .option('--node <id>', 'Isolate one authored subtree')
    .option('--parameters <json>', 'Model parameter overrides')
    .option('--azimuth <degrees>', 'Orbit camera azimuth, used with --view orbit', Number, 45)
    .option('--elevation <degrees>', 'Orbit camera elevation', Number, 30)
    .addOption(
      new Option('--projection <type>')
        .choices(['auto', 'perspective', 'orthographic'])
        .default('auto'),
    )
    .option('--padding <factor>', 'Framing margin', Number, 1.12)
    .option('--wireframe', 'Capture wireframe')
    .requiredOption('-o, --out <path>', 'PNG path')
    .option('--width <px>', 'Image width', integer, 1600)
    .option('--height <px>', 'Image height', integer, 1000)
    .addOption(new Option('--view <view>').choices([...viewNames]).default('iso'))
    .option('--grid', 'Include the ground grid')
    .option('--ui', 'Capture the full preview interface')
    .action(async (opts) => {
      if (opts.width < 64 || opts.height < 64 || opts.width > 4096 || opts.height > 4096)
        fail('INVALID_OPTION', 'Screenshot dimensions must be between 64 and 4096 pixels.');
      const s = await snapshot();
      const target = authoringTarget(s.scene, s.models, {
        model: opts.model,
        node: opts.node,
        parameters: opts.parameters ? parseParameters(opts.parameters) : undefined,
      });
      if (opts.view === 'authored' && !target.camera)
        fail('INVALID_CAMERA', 'No authored camera is defined.');
      const html = await createPreview(target, s.models, {
        stateHash: s.stateHash,
        editable: !opts.model && !opts.node,
        includeLibrary: !!opts.ui,
      });
      output(
        await screenshot(html, opts.out, {
          width: opts.width,
          height: opts.height,
          view: opts.view,
          grid: !!opts.grid,
          ui: !!opts.ui,
          camera: {
            azimuth: opts.azimuth,
            elevation: opts.elevation,
            projection: opts.projection,
            padding: opts.padding,
          },
          wireframe: !!opts.wireframe,
        }),
      );
    });
}
