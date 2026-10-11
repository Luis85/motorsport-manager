import { fail } from '../domain/errors.js';
import { resolveData } from '../domain/validate.js';
import type {
  ModelDocument,
  ModelLibrary,
  NodeSpec,
  SceneDocument,
  ScatterRecipe,
} from '../domain/schema.js';
import type { Random } from '../domain/random.js';
import { round4 } from './placement.js';

/** One scatter item, checked against the document and the model library. */
export interface ScatterSource {
  weight: number;
  model?: string;
  template?: NodeSpec;
  /** Varied parameters in name order: [name, min, max, integer]. */
  vary: [string, number, number, boolean][];
}

/**
 * Check every item: registered models, copyable template nodes (a mesh or model without
 * children), and vary ranges inside each parameter's declared range.
 */
export function scatterSources(
  scene: SceneDocument,
  models: ModelLibrary,
  recipe: ScatterRecipe,
): ScatterSource[] {
  return recipe.items.map((item, index) => {
    let target: ModelDocument | undefined;
    let template: NodeSpec | undefined;
    if (item.model !== undefined) {
      if (!Object.hasOwn(models, item.model))
        fail('REFERENCE_MISSING', `Scatter item ${index} uses unregistered model ${item.model}.`, {
          item: index,
          hint: 'Register or import the model first, or use a node template item.',
        });
      target = models[item.model];
    } else {
      template = scene.nodes.find((n) => n.id === item.node);
      if (!template)
        fail('REFERENCE_MISSING', `Scatter item ${index} copies missing node ${item.node}.`, {
          item: index,
        });
      if (template.type !== 'mesh' && template.type !== 'model')
        fail('INVALID_NODE_TYPE', `Template ${template.id} must be a mesh or model node.`, {
          item: index,
        });
      if (scene.nodes.some((n) => n.parent === template!.id))
        fail('INVALID_NODE_TYPE', `Template ${template.id} has children and cannot be copied.`, {
          item: index,
          hint: 'Capture the assembly as a model and scatter model instances instead.',
        });
      if (template.type === 'model') target = models[template.model];
    }
    const vary = Object.keys(item.vary)
      .sort()
      .map((name): [string, number, number, boolean] => {
        if (!target)
          fail('UNKNOWN_PARAMETER', `Scatter item ${index} varies ${name}, but it is a mesh.`, {
            item: index,
            hint: 'vary applies to model parameters; remove it from mesh templates.',
          });
        const declared = target.parameters[name];
        if (!declared)
          fail('UNKNOWN_PARAMETER', `Model ${target.id} has no parameter ${name}.`, {
            item: index,
          });
        let [min, max] = item.vary[name];
        if (
          (declared.min !== undefined && min < declared.min) ||
          (declared.max !== undefined && max > declared.max)
        )
          fail('PARAMETER_RANGE', `vary.${name} must stay inside ${target.id}.${name}'s range.`, {
            item: index,
            vary: [min, max],
            min: declared.min,
            max: declared.max,
          });
        if (declared.integer) {
          [min, max] = [Math.ceil(min), Math.floor(max)];
          if (min > max)
            fail('PARAMETER_RANGE', `vary.${name} contains no whole number.`, { item: index });
        }
        return [name, min, max, declared.integer === true];
      });
    return { weight: item.weight, model: item.model, template, vary };
  });
}

export interface InstanceDraw {
  position: [number, number, number];
  yaw: number;
  tilt: [number, number];
  scale: number;
}

/** Compact transform: identity rotation and unit scale are omitted. */
function transformOf(draw: InstanceDraw, baseScale: number[]) {
  const rotation = [draw.tilt[0], draw.yaw, draw.tilt[1]].map(round4);
  const scale = baseScale.map((v) => round4(v * draw.scale));
  return {
    position: draw.position.map(round4),
    ...(rotation.some((v) => v !== 0) ? { rotation } : {}),
    ...(scale.some((v) => v !== 1) ? { scale } : {}),
  };
}

/** The putNode payload of one placement. */
export function instanceNode(
  scene: SceneDocument,
  source: ScatterSource,
  id: string,
  group: string,
  tag: string,
  draw: InstanceDraw,
  random: Random,
): Record<string, unknown> {
  const parameters = Object.fromEntries(
    source.vary.map(([name, min, max, integer]) => {
      const value = random.range(min, max);
      return [name, integer ? Math.min(max, Math.round(value)) : round4(value)];
    }),
  );
  if (source.model !== undefined)
    return {
      id,
      type: 'model',
      model: source.model,
      parent: group,
      tags: [tag],
      transform: transformOf(draw, [1, 1, 1]),
      ...(source.vary.length ? { parameters } : {}),
    };
  const template = structuredClone(source.template!);
  const base = resolveData(template.transform?.scale ?? [1, 1, 1], scene.parameters) as number[];
  return {
    ...template,
    id,
    parent: group,
    visible: true,
    tags: [...template.tags.filter((t) => t !== tag), tag].slice(-32),
    transform: transformOf(draw, base),
    ...(template.type === 'model' ? { parameters: { ...template.parameters, ...parameters } } : {}),
  };
}
