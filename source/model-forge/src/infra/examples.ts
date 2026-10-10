import { z } from 'zod';
import { fail, parse, Id } from '../kernel/index.js';
import { documentKinds } from '../domain/document.js';
import { parseDocument, type EditorDocument, withoutRevision } from '../application/document.js';
import { documentFor } from '../application/import.js';
import { readAsset } from './assets.js';
import { createDocument, documentKindForPath } from './store.js';

const Entry = z
  .object({
    id: Id,
    name: z.string(),
    kind: z.enum(documentKinds),
    file: z.string().regex(/^[A-Za-z0-9_-]+\.model(-bundle)?\.json$/),
    description: z.string(),
    source: z.string(),
    dependencies: z.array(Id),
  })
  .strict();

/** Bundled example documents, stored as data under source/model-forge/examples. */
export const listExamples = async () =>
  parse(z.array(Entry), JSON.parse(await readAsset('examples/index.json')));

export async function exampleDocument(id: string): Promise<EditorDocument> {
  parse(Id, id);
  const entry = (await listExamples()).find((example) => example.id === id);
  if (!entry)
    fail('NOT_FOUND', `Unknown example ${id}.`, {
      available: (await listExamples()).map((example) => example.id),
    });
  return parseDocument(JSON.parse(await readAsset(`examples/${entry.file}`)));
}

/**
 * Create a new document from an example. With `rename`, the editable model takes a new ID
 * and name while its frozen dependencies are kept unchanged.
 */
export async function createFromExample(
  id: string,
  file: string,
  rename?: { id: string; name: string; category?: string; description?: string },
) {
  const example = await exampleDocument(id);
  const model = rename
    ? {
        ...withoutRevision(example.model),
        id: rename.id,
        name: rename.name,
        ...(rename.category !== undefined ? { category: rename.category } : {}),
        ...(rename.description !== undefined ? { description: rename.description } : {}),
      }
    : example.model;
  if (Object.hasOwn(example.dependencies, model.id))
    fail('DUPLICATE_ID', `Model ID ${model.id} is already used by a dependency of ${id}.`);
  const document = documentFor(
    { ...example.dependencies, [model.id]: model },
    model.id,
    documentKindForPath(file),
  );
  return { ...(await createDocument(file, document)), example: id };
}
