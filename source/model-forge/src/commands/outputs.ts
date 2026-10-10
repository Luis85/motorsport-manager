import { Command, Option } from 'commander';
import {
  fail,
  parse,
  ReviewPlanSchema,
  QualityPolicySchema,
  type ReviewPlan,
} from '../kernel/index.js';
import { auditDocument } from '../application/inspect.js';
import { documentExportFormats, exportDocument } from '../infra/exporters.js';
import { previewDocument, reviewDocument } from '../infra/preview.js';
import { atomicWrite } from '../infra/files.js';
import { checkOutput } from '../infra/paths.js';
import { parseJson, parseParameters } from './input.js';
import { integer } from './options.js';
import type { CommandContext } from './context.js';

const reviewSettings = [
  'views',
  'turntable',
  'elevation',
  'width',
  'height',
  'projection',
  'padding',
  'grid',
  'wireframe',
  'contactSheet',
];
interface ReviewFlags {
  views?: string;
  turntable?: number;
  elevation: number;
  width: number;
  height: number;
  projection: string;
  padding: number;
  grid?: boolean;
  wireframe?: boolean;
  contactSheet: boolean;
}
/** A review plan from flags: named views, or an evenly spaced turntable. */
function planFromFlags(o: ReviewFlags): ReviewPlan {
  if (o.views && o.turntable !== undefined)
    fail('INVALID_OPTION', 'Choose --views or --turntable.');
  const turntable = o.turntable;
  if (turntable !== undefined && (turntable < 2 || turntable > 36))
    fail('INVALID_OPTION', 'Turntable count must be an integer from 2 to 36.');
  const camera = { projection: o.projection, padding: o.padding };
  const frames =
    turntable !== undefined
      ? Array.from({ length: turntable }, (_, i) => ({
          id: `orbit-${String(i).padStart(2, '0')}`,
          camera: {
            view: 'orbit',
            azimuth: (i * 360) / turntable,
            elevation: o.elevation,
            ...camera,
          },
        }))
      : (o.views ?? 'iso,front,right,back,left,top')
          .split(',')
          .map((view) => ({ id: view.trim(), camera: { view: view.trim(), ...camera } }));
  return parse(ReviewPlanSchema, {
    schemaVersion: 1,
    kind: 'review',
    width: o.width,
    height: o.height,
    grid: !!o.grid,
    wireframe: !!o.wireframe,
    contactSheet: o.contactSheet,
    frames,
  });
}

export function registerOutputCommands(c: CommandContext) {
  const { program, output, input, load, resolvePath } = c;
  program
    .command('review')
    .description('Render views, a contact sheet and review.json in one headless Chromium session')
    .requiredOption('-o, --out <directory>', 'New (or empty) output directory')
    .option('--file <path>', 'Review plan JSON (schema --kind review); - for stdin')
    .option('--views <names>', 'Comma-separated views; default iso,front,right,back,left,top')
    .option('--turntable <count>', 'Evenly spaced orbit views (2–36)', integer)
    .option('--elevation <degrees>', 'Turntable elevation', Number, 25)
    .option('--width <px>', 'Frame width (64–2048)', integer, 800)
    .option('--height <px>', 'Frame height (64–2048)', integer, 600)
    .addOption(
      new Option('--projection <type>')
        .choices(['auto', 'perspective', 'orthographic'])
        .default('auto'),
    )
    .option('--padding <factor>', 'Framing margin (1.02–3)', Number, 1.12)
    .option('--grid', 'Show the ground grid')
    .option('--wireframe', 'Render wireframes')
    .option('--no-contact-sheet', 'Skip contact-sheet.png')
    .option('--overwrite', 'Replace named outputs in an existing directory')
    .option('--parameters <json>', 'Parameter overrides')
    .option('--background <hex>', 'Background color, #rrggbb')
    .action(async (opts, command: Command) => {
      let plan: ReviewPlan;
      if (opts.file) {
        for (const name of reviewSettings)
          if (command.getOptionValueSource(name) === 'cli')
            fail('INVALID_OPTION', `--file cannot be combined with --${name}; set it in the plan.`);
        plan = parse(ReviewPlanSchema, await input({ file: opts.file }));
      } else plan = planFromFlags(opts);
      if (opts.background && !/^#[0-9a-fA-F]{6}$/.test(opts.background))
        fail('INVALID_OPTION', '--background must be #rrggbb.');
      const loaded = await load();
      const out = await checkOutput(resolvePath(opts.out), {
        directory: true,
        source: loaded.path,
      });
      output(
        await reviewDocument(loaded, out, plan, {
          parameters: parseParameters(opts.parameters),
          overwrite: opts.overwrite,
          background: opts.background,
        }),
      );
    });
  program
    .command('preview')
    .description('Write a self-contained, read-only orbit preview HTML file')
    .requiredOption('-o, --out <file>', 'New output .html file')
    .option('--overwrite', 'Replace an existing output file deliberately')
    .option('--parameters <json>', 'Parameter overrides')
    .action(async (opts) => {
      const loaded = await load();
      const out = resolvePath(opts.out);
      if (!out.endsWith('.html')) fail('INVALID_OPTION', 'Preview output must end with .html.');
      await checkOutput(out, { overwrite: opts.overwrite, source: loaded.path });
      const html = await previewDocument(loaded, parseParameters(opts.parameters));
      await atomicWrite(out, html);
      output({ path: out, bytes: Buffer.byteLength(html), offline: true, readOnly: true });
    });
  program
    .command('audit')
    .description('Check visible geometry and quality budgets (schema --kind quality-policy)')
    .option('--file <path>', 'Quality policy JSON; - for stdin')
    .option('--data <json>', 'Inline quality policy JSON')
    .option('--parameters <json>', 'Parameter overrides')
    .option('--strict', 'Treat quality warnings as failures')
    .action(async (opts) => {
      const policy = opts.file || opts.data ? parse(QualityPolicySchema, await input(opts)) : {};
      const loaded = await load();
      output(
        auditDocument(loaded.document, policy, {
          parameters: parseParameters(opts.parameters),
          strict: opts.strict,
        }),
      );
    });
  program
    .command('export')
    .description(
      'Write a deliverable: glb, gltf, obj, stl, three, model, model-bundle or littlewild',
    )
    .addOption(
      new Option('-f, --format <format>', 'Output format')
        .choices([...documentExportFormats])
        .default('glb'),
    )
    .requiredOption(
      '-o, --out <path>',
      'New output file; littlewild needs <family>/<id>/definition.json and merges into it',
    )
    .option('--overwrite', 'Replace an existing output file deliberately (not littlewild)')
    .option('--validate', 'Khronos glTF validation; rejects invalid output before writing')
    .option('--parameters <json>', 'Parameter overrides (rendered formats and littlewild)')
    .addOption(
      new Option(
        '--family <family>',
        'Littlewild family; defaults to the <family> directory of the --out path, else items',
      ).choices(['items', 'buildings', 'creatures', 'pets']),
    )
    .option('--variant <name>', 'Littlewild model variant (default world)')
    .option(
      '--name <name>',
      'Littlewild display name; defaults to the existing definition name, else the model name',
    )
    .option('--materials <json>', 'Littlewild inline material replacements by material ID')
    .option('--check', 'Littlewild: fail with LITTLEWILD_STALE when the definition differs')
    .option('--dry-run', 'Littlewild: compile and compare without writing')
    .action(async (opts) => {
      const littlewild = opts.format === 'littlewild';
      const littlewildFlags = {
        family: '--family',
        variant: '--variant',
        name: '--name',
        materials: '--materials',
        check: '--check',
        dryRun: '--dry-run',
      };
      const used = Object.entries(littlewildFlags).filter(([key]) => opts[key] !== undefined);
      if (!littlewild && used.length)
        fail(
          'INVALID_OPTION',
          `${used.map(([, flag]) => flag).join(', ')} apply to --format littlewild only (${Object.values(littlewildFlags).join(', ')}).`,
          { flags: used.map(([, flag]) => flag) },
        );
      if (littlewild && opts.overwrite)
        fail(
          'INVALID_OPTION',
          '--overwrite does not apply to littlewild: the export merges into an existing definition.json (use --dry-run or --check first).',
        );
      const loaded = await load();
      output(
        await exportDocument(loaded, {
          format: opts.format,
          out: resolvePath(opts.out),
          validate: opts.validate,
          overwrite: opts.overwrite,
          parameters: parseParameters(opts.parameters),
          littlewild: littlewild
            ? {
                family: opts.family,
                variant: opts.variant ?? 'world',
                name: opts.name,
                materials: opts.materials ? parseJson(opts.materials) : undefined,
                check: opts.check,
                dryRun: opts.dryRun,
              }
            : undefined,
        }),
      );
    });
}
