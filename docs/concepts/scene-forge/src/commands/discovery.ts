import { Option } from 'commander';
import { jsonSchema, schemaKinds, viewNames, expressionOperators } from '../domain/schema.js';
import { exportFormats } from '../infra/export.js';
import { littlewildFamilies } from '../domain/schema.js';
import { littlewildLimits, littlewildPetRoles } from '../application/littlewild.js';
import { VERSION } from '../version.js';
import type { CommandContext } from './context.js';
export function registerDiscoveryCommands(c: CommandContext) {
  const { program, output, writeOut } = c;
  program
    .command('catalog')
    .description('Discover commands, geometry types, conventions and limits')
    .action(() =>
      output({
        version: VERSION,
        workflow: [
          'init',
          'apply',
          'model capture',
          'scene compose',
          'node transform',
          'validate',
          'inspect',
          'preview',
          'screenshot',
          'review',
          'audit',
          'scene pack',
          'export',
        ],
        schemas: schemaKinds,
        geometryTypes: [
          'box',
          'sphere',
          'cylinder',
          'cone',
          'torus',
          'capsule',
          'plane',
          'lathe',
          'extrude',
          'mesh',
          'boolean',
          'tube',
        ],
        composition: [
          'model capture',
          'model bundle import/export',
          'scene compose',
          'scene clone',
          'node patch/transform/duplicate/group/reparent/ground/place',
          'offline composer with guarded edit download',
        ],
        rigging: {
          commands: ['rig inspect', 'rig bind', 'rig pose', 'rig remove'],
          scope: 'model instance',
          joints: 64,
          clips: 16,
          interpolation: 'quaternion linear',
          bindings: ['nearest joint', 'two-joint blend', 'explicit mesh to joint'],
          export: 'glTF skins and rotation clips',
        },
        littlewild: {
          commands: ['littlewild sync', 'littlewild export', 'littlewild import'],
          manifest: 'littlewild-export (schema --kind littlewild-export)',
          families: Object.keys(littlewildFamilies),
          output: '<target>/<family>/<id>/definition.json visual facet; other facets are preserved',
          geometry:
            'boxes and unchanged lw-<primitive> geometries stay native; other meshes are baked',
          rig: 'pets only: tag nodes rig:<role>',
          rigRoles: littlewildPetRoles,
          limits: littlewildLimits,
          check: 'littlewild sync --check fails when a definition is stale',
        },
        lights: ['point', 'spot', 'directional'],
        materialShading: ['standard', 'unlit'],
        previewLooks: ['filmic', 'neutral', 'linear'],
        patterns: ['linear', 'radial', 'grid', 'path'],
        expressions: {
          operators: expressionOperators,
          maxDepth: 16,
          trigonometry: 'degrees',
          execution: 'bounded data AST; no executable code',
        },
        review: {
          command: 'review',
          views: viewNames,
          outputs: [
            'individual PNGs',
            'contact-sheet.png',
            'review.json with camera settings and source hash',
            'replay-plan.json with fixed cameras',
          ],
          browserSessions: 1,
        },
        examples: 'example list, example show <id>, example create <id> <directory>',
        discovery: 'describe [command path...] for machine-readable options and defaults',
        exports: exportFormats,
        conventions: {
          units: 'meters',
          up: 'Y',
          handedness: 'right',
          rotation: 'degrees, local XYZ Euler',
          defaultFacing: '+Z',
          profiles: 'XY, extruded along +Z',
          lathe: 'radius/Y profile revolved about Y',
        },
        agentContract: {
          success: 'stdout: {ok:true,data}',
          error: 'stderr: {ok:false,error:{code,message,details?}}; exit 1',
          input: '--file path, --file - (stdin), or --data JSON',
          mutations:
            'Atomic scene batches with revision and scene/library state guards; put replaces, patch merges named fields',
          idempotency: 'Reapplying identical put operations does not increment revision',
          discovery: 'forge3d schema --kind batch --raw',
        },
        limits: {
          expandedObjects: 20000,
          expandedTriangles: 2000000,
          patternCopies: 256,
          modelDepth: 16,
          authoredLights: 32,
          shadowLights: 4,
          inputBytes: 16777216,
        },
        unsupported: [
          'inverse kinematics and weight painting',
          'arbitrary GLSL shaders',
          'sculpting',
          'texture images and automatic UV unwrapping',
          'physics',
          'native .blend authoring',
          'native .tscn authoring',
          'mesh import',
          'arbitrary JavaScript in recipes',
        ],
      }),
    );
  program
    .command('schema')
    .description('Print the JSON Schema for agent-generated data')
    .addOption(new Option('--kind <name>', 'Contract').choices(schemaKinds).default('scene'))
    .option('--raw', 'Print bare JSON Schema for validators')
    .action((opts) => {
      const schema = jsonSchema(opts.kind);
      if (opts.raw) writeOut(JSON.stringify(schema, null, 2) + '\n');
      else output(schema);
    });
}
