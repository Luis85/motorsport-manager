import { z } from 'zod';
import { readAsset } from './assets.js';
import { parse, Id, fail } from '../kernel.js';
import { SceneBundleSchema } from '../domain/schema.js';
import { unpackScene } from './bundle.js';

const Entry = z
  .object({
    id: Id,
    name: z.string(),
    description: z.string(),
    features: z.array(z.string()),
    models: z.array(Id),
    stats: z.unknown(),
  })
  .strict();
async function exampleData(name: string): Promise<unknown> {
  return JSON.parse(await readAsset(`examples/${name}`));
}
export const listExamples = async () => parse(z.array(Entry), await exampleData('index.json'));
export async function exampleBundle(id: string) {
  parse(Id, id);
  const examples = await listExamples();
  if (!examples.some((entry) => entry.id === id))
    fail('NOT_FOUND', `Unknown example ${id}.`, { available: examples.map((entry) => entry.id) });
  return parse(SceneBundleSchema, await exampleData(`${id}.scene-bundle.json`));
}
export async function createExample(id: string, directory: string) {
  const project = await unpackScene(directory, await exampleBundle(id));
  return {
    ...project,
    example: id,
    nextCommands: [
      ['forge3d', '-p', project.project, 'inspect', '--source'],
      ['forge3d', '-p', project.project, 'model', 'list'],
      ['forge3d', '-p', project.project, 'review', '--out', `${project.project}/exports/review`],
      [
        'forge3d',
        '-p',
        project.project,
        'export',
        '--validate',
        '--out',
        `${project.project}/exports/scene.glb`,
      ],
    ],
  };
}
