import type { z } from 'zod';
import type { ModelDocument, Random } from '../../kernel/index.js';

/** What a generator's build receives: identity, validated parameters and its keyed stream. */
export interface BuildInput<P> {
  id: string;
  name: string;
  params: P;
  /** `createRandom(seed, 'generate/<generator id>')`; fork one stream per concern. */
  random: Random;
}

/** A named starting point: a short description plus parameter values over the defaults. */
export interface GeneratorPreset<P> {
  description: string;
  parameters: Partial<P>;
}

/**
 * A procedural model generator: pure, deterministic for a given seed and parameters, and
 * bounded. `build` returns an ordinary editable `kind: "model"` document whose model
 * parameters (`$param`) keep the main dimensions editable after generation.
 */
export interface GeneratorDefinition<S extends z.ZodObject = z.ZodObject> {
  id: string;
  /** Output contract version: the same version, seed and parameters give the same bytes. */
  version: number;
  category: string;
  description: string;
  /** Every field has a default, a range or choices, and a description. */
  parameters: S;
  presets: Record<string, GeneratorPreset<z.input<S>>>;
  defaultPreset: string;
  limits: { maxTriangles: number };
  build(input: BuildInput<z.output<S>>): ModelDocument;
}

/** The registry's type-erased view of one generator. */
export interface Generator {
  id: string;
  version: number;
  category: string;
  description: string;
  parameters: z.ZodObject;
  presets: Record<string, GeneratorPreset<Record<string, unknown>>>;
  defaultPreset: string;
  limits: { maxTriangles: number };
  build(input: BuildInput<Record<string, unknown>>): ModelDocument;
}

/** Erase a typed definition for the registry; parameters are validated before build. */
export function defineGenerator<S extends z.ZodObject>(definition: GeneratorDefinition<S>) {
  return {
    ...definition,
    presets: definition.presets as Generator['presets'],
    build: (input) => definition.build({ ...input, params: input.params as z.output<S> }),
  } satisfies Generator as Generator;
}
