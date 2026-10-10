import {
  terrainPresets,
  terrainPresetNames,
  defaultTerrainPreset,
  PROCEDURAL_MAX_PLACEMENTS,
  PROCEDURAL_MAX_CANDIDATES,
  HEIGHTFIELD_MAX_RESOLUTION,
} from '../kernel.js';

/** The catalog's `procedural` block: commands, presets, limits and one-command examples. */
export function proceduralCatalog(name: string) {
  const cli = `${name} -p <project>`;
  return {
    commands: ['scatter', 'layout', 'terrain add', 'terrain sample'],
    recipe:
      'scatter (schema --kind scatter --raw). Flags compile to this recipe; every result echoes the normalized recipe and recipeHash, and --file/--data replays it.',
    determinism:
      'Same scene, model library, recipe and seed give the same operations, scene bytes and stateHash. Keyed PRNG (cyrb128 seed|stream -> sfc32); each candidate draws from its own stream, so exclusions never reshuffle survivors.',
    distributions: {
      poisson: 'scatter --spacing <meters>: even blue noise, no two closer than spacing',
      random: 'scatter --count <n>: uniform random points',
      path: 'layout --path "x,z;x,z" --spacing <meters> [--orient yaw|none]',
      grid: 'layout --grid CxR --step <meters> [--jitter 0..1] [--center x,z]',
    },
    areas: ['rect:x0,z0,x1,z1', 'circle:x,z,radius', 'polygon:x,z;x,z;x,z[;...]'],
    defaultArea: 'scatter --on <terrain> without --area or --parent covers the terrain footprint',
    grounding:
      '--on <heightfield node> sets each origin on the rendered surface (--sink, --max-slope). Terrain and parent chains may only translate, yaw and scale uniformly (TERRAIN_TRANSFORM). Without --on, origins sit at y 0 of the frame.',
    output: {
      ids: '<group>-1..<group>-N under one group node',
      tags: ['scatter (group)', 'scatter:<recipeHash8> (group and every instance)'],
      result:
        'normal edit result + recipe + placement{seed, recipeHash, group, placed, candidates, rejected{outside, exclusion, slope, budget}} + nextCommands',
      regenerate:
        '--replace removes an existing group tagged scatter and its subtree first (any other node of that ID fails DUPLICATE_ID); rerunning the same recipe with --replace leaves the revision unchanged',
    },
    terrain: {
      presets: Object.fromEntries(
        terrainPresetNames.map((p) => [p, terrainPresets[p].description]),
      ),
      defaultPreset: defaultTerrainPreset,
      creates: 'mesh node <id> (tag terrain), geometry <id>_geo (heightfield), material <id>_mat',
      coloring:
        'Presets color by height bands through vertex colors; --color or --material makes a solid surface without bands',
      geometry: 'heightfield (schema --kind geometry --raw)',
      replace:
        '--replace regenerates the terrain; placements keep their heights, so rerun the result.staleScatterGroups with scatter --replace',
    },
    guards: ['--dry-run', '--expected-revision', '--expected-state'],
    limits: {
      placements: PROCEDURAL_MAX_PLACEMENTS,
      candidates: PROCEDURAL_MAX_CANDIDATES,
      sceneNodes: 10000,
      items: 32,
      exclusions: 64,
      areaPoints: 256,
      terrainResolution: HEIGHTFIELD_MAX_RESOLUTION,
      samplePoints: 256,
    },
    errors: {
      DUPLICATE_ID: 'group exists: --replace with guards (scatter groups only), or another --group',
      SCATTER_EMPTY: 'nothing placed: read details.rejected, loosen spacing/area or --allow-empty',
      PROCEDURAL_BUDGET: 'too many candidates or placements: raise spacing, shrink area, --max',
      TERRAIN_TRANSFORM: 'tilted or non-uniformly scaled terrain/parent chain',
    },
    examples: [
      `${cli} terrain add ground --preset hills --size 48,48 --seed 7`,
      `${cli} terrain sample ground --at "0,0;10,-4"`,
      `${cli} scatter --model tree,rock:2 --on ground --spacing 3 --scale 0.8..1.3 --seed 42 --group forest --dry-run`,
      `${cli} layout --model post --path "-20,-20;20,-20;20,20" --spacing 2 --on ground --group fence`,
      `${cli} layout --model crate --grid 4x3 --step 1.5 --center 0,5 --group stock`,
      `${cli} scatter --file forest.scatter.json --replace --expected-revision <n> --expected-state <hash>`,
    ],
  };
}
