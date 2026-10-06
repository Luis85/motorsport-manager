import {
  parse,
  fail,
  SceneSchema,
  type SceneDocument,
  type ModelLibrary,
} from '../domain/schema.js';
import { subtreeIds, nodeById } from './composition.js';

export function authoringTarget(
  scene: SceneDocument,
  models: ModelLibrary,
  options: { model?: string; node?: string; parameters?: Record<string, number> } = {},
) {
  if (options.model && options.node) fail('INVALID_OPTION', 'Choose --model or --node, not both.');
  if (options.parameters && !options.model)
    fail('INVALID_OPTION', '--parameters requires --model.');
  if (options.model) {
    if (!Object.hasOwn(models, options.model))
      fail('NOT_FOUND', `Model ${options.model} does not exist.`);
    return parse(SceneSchema, {
      schemaVersion: 1,
      kind: 'scene',
      id: 'model',
      name: models[options.model].name,
      environment: scene.environment,
      nodes: [
        { type: 'model', id: 'asset', model: options.model, parameters: options.parameters ?? {} },
      ],
    });
  }
  if (!options.node) return scene;
  const ids = subtreeIds(scene, options.node),
    ancestors = new Set<string>();
  let parent = nodeById(scene, options.node).parent;
  while (parent) {
    ancestors.add(parent);
    parent = nodeById(scene, parent).parent;
  }
  // Keep transform-only ancestors, including nonuniform scale; no matrix decomposition needed.
  return parse(SceneSchema, {
    ...scene,
    nodes: scene.nodes
      .filter((n) => ids.has(n.id) || ancestors.has(n.id))
      .map((n) =>
        ids.has(n.id)
          ? n
          : {
              id: n.id,
              type: 'group',
              name: n.name,
              parent: n.parent,
              transform: n.transform,
              visible: n.visible,
              tags: n.tags,
            },
      ),
  });
}
