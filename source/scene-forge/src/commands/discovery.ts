import { Option } from 'commander';
import { jsonSchema, schemaKinds } from '../domain/schema.js';
import {
  viewNames,
  expressionOperators,
  exportFormats,
  littlewildFamilies,
  littlewildLimits,
  littlewildPetRoles,
} from '../kernel.js';
import { VERSION } from '../version.js';
import type { CommandContext } from './context.js';
import { proceduralCatalog } from './procedural-catalog.js';
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
          'organic',
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
          'heightfield',
        ],
        organicForms: {
          type: 'organic',
          units:
            'size is the untapered diameter on X/Y/Z in meters; taper and bend can extend X/Z bounds',
          parameters: {
            roundness: [0.65, 1.5],
            taper: [-0.65, 0.65],
            bend: [-0.75, 0.75],
            segments: [12, 96],
          },
          profile: {
            stations: [2, 12],
            at: [-1, 1],
            minimumHeightGap: 0.02,
            width: [0.1, 2],
            depth: [0.1, 2],
            offset: [-0.75, 0.75],
            meaning:
              'Optional profile stations start at -1 and end at 1. Width/depth multiply each crosssection; offset [X,Z] moves its center in half-size units. Smoothstep interpolation never overshoots; every station is sampled exactly.',
            example: [
              { at: -1, width: 1, depth: 1, offset: [0, 0] },
              { at: -0.35, width: 1.12, depth: 1.15, offset: [0, 0.12] },
              { at: 0.35, width: 0.75, depth: 0.8, offset: [0, 0] },
              { at: 1, width: 0.65, depth: 0.7, offset: [0.1, -0.08] },
            ],
          },
          meaning:
            'roundness 1 is ellipsoidal, below 1 is fuller; positive taper narrows the top; bend offsets both ends along +X',
          example: {
            op: 'putGeometry',
            id: 'plushBody',
            geometry: {
              type: 'organic',
              size: [0.9, 1.1, 0.72],
              roundness: 0.9,
              taper: 0.22,
              bend: 0,
              segments: 32,
            },
          },
          export:
            'Closed smooth mesh with seam-aware UVs. Littlewild receives baked mesh; GLB retains mesh and UVs.',
          workflow:
            'inspect --source, apply --dry-run with revision/state guards, apply same batch with guards, review --file previous/replay-plan.json',
        },
        surfaceDetails: {
          algorithm: 'littlewild-surface-v1',
          versions: {
            1: 'Original detail, default when omitted; exact replay compatibility',
            2: 'Fine directional fur fibres, woven yarn and subtle leather grain',
          },
          uniqueRecipesPerScene: 256,
          pooling:
            'Identical version/kind/seed/scale/strength share maps across material colors; each compilation owns and disposes its pool.',
          fields: {
            kind: ['fur', 'cloth', 'leather'],
            version: [1, 2],
            seed: [0, 65535],
            scale: [1, 16],
            strength: [0, 1],
          },
          required: ['kind', 'seed', 'scale', 'strength'],
          example: {
            op: 'putMaterial',
            id: 'plushFur',
            material: {
              color: '#c89059',
              roughness: 0.9,
              sheen: 0.65,
              sheenColor: '#ffe4bd',
              surface: { kind: 'fur', seed: 7, scale: 3, strength: 0.4 },
            },
          },
          outputs:
            'Deterministic 128×128 color and tangent normal maps; no image files, browser, shader scripts or network needed for GLB export',
          compatibility:
            'Standard PBR only. Littlewild preserves recipe and UVs; GLB embeds PNGs with KHR_texture_transform repeat and recipe in material extras.',
          limits:
            'Surface detail shades existing geometry; use organic forms or authored meshes for a fluffy silhouette. Not strand fur or cloth simulation.',
          uvFallback:
            'Legacy baked meshes without UVs receive local spherical projection; supply seam-aware UVs for precise placement.',
        },
        composition: [
          'model capture',
          'model bundle import/export',
          'scene compose',
          'scene clone',
          'node patch/transform/duplicate/group/reparent/ground/place',
          'offline composer with guarded edit download',
        ],
        modelAuthoring: {
          tool: 'bin/model-forge',
          scope:
            'Standalone agent-first editor for exactly one model document (<id>.model.json, or <id>.model-bundle.json with frozen nested dependencies); owns the model asset contract and the shared recipe kernel',
          discovery: 'model-forge discover --compact',
          handoff: [
            'model-forge -d <document> export --format model-bundle --out <file>',
            `${program.name()} -p <project> model import --file <file> --dry-run`,
            `${program.name()} -p <project> model import --file <file> [--replace --expected-revision <n> --expected-state <hash>]`,
          ],
          sceneForgeRole:
            'model list/inspect/import/instantiate/capture/export remain here for the project registry and scene composition',
        },
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
          importFormats: [
            'littlewild-definition',
            'littlewild-3d-asset',
            'littlewild-creature-package',
          ],
          importScope:
            'Visual models only; creature gameplay and companion state stay in the source package',
          importGuards: ['--expected-revision', '--expected-state'],
          importOutputs: {
            variants: 'Array of imported model IDs (retained compatibility field)',
            variantModels:
              'Map of original source variant names to model IDs; use this instead of inferring capitalization or suffixes',
            example: { 'world-round': 'pipTrailWorldRound' },
          },
          families: Object.keys(littlewildFamilies),
          output: '<target>/<family>/<id>/definition.json visual facet; other facets are preserved',
          geometry:
            'boxes and unchanged lw-<primitive> geometries stay native; other meshes are baked',
          rig: 'pets only: tag nodes rig:<role>',
          rigRoles: littlewildPetRoles,
          limits: littlewildLimits,
          check: 'littlewild sync --check fails when a definition is stale',
        },
        procedural: proceduralCatalog(program.name()),
        lights: ['point', 'spot', 'directional'],
        materialShading: ['standard', 'unlit'],
        materialDepthWrite:
          'Optional boolean. Use false for alpha-blended shadow decals (opacity < 1); GLB uses alphaMode BLEND.',
        physicalMaterials: {
          fields: ['sheen', 'sheenColor', 'sheenRoughness', 'clearcoat', 'clearcoatRoughness'],
          range: 'Scalar fields 0..1; sheenColor #RRGGBB. Standard PBR shading only.',
          authoring: 'putMaterial in apply; schema --kind material --raw',
          exports: [
            'GLB/glTF KHR_materials_sheen and KHR_materials_clearcoat',
            'Littlewild visual',
          ],
        },
        previewPresentation: {
          values: ['inspection', 'portrait'],
          authoring: 'setEnvironment in apply; environment.presentation in scene schema',
          scope: 'Preview-only light rig and portrait shadow floor; source geometry unchanged',
        },
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
          discovery: `${program.name()} schema --kind batch --raw`,
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
          'external texture image import and automatic UV unwrapping',
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
