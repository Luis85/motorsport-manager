import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { readJson } from './files.js';
import { parse, Id, SceneBundleSchema, fail } from '../domain/schema.js';
import { errorCode } from '../domain/errors.js';
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
async function exampleData(name: string) {
  for (const url of [
    new URL(`./examples/${name}`, import.meta.url),
    new URL(`../../examples/catalog/${name}`, import.meta.url),
  ]) {
    try {
      return await readJson(fileURLToPath(url));
    } catch (error) {
      if (errorCode(error) !== 'NOT_FOUND') throw error;
    }
  }
  return fail('BUILD_REQUIRED', 'Bundled examples are missing. Run npm run build.');
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
