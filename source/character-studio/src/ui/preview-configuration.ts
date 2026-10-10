export interface PreviewConfiguration {
  mode?: 'studio' | 'world' | 'portrait';
  light?: 'studio' | 'daylight' | 'night';
  pose?: 'idle' | 'walk' | 'work' | 'celebrate';
  camera?: 'front' | 'side' | 'back';
  paused?: boolean;
  reset?: boolean;
}
const choices = {
  mode: ['studio', 'world', 'portrait'],
  light: ['studio', 'daylight', 'night'],
  pose: ['idle', 'walk', 'work', 'celebrate'],
  camera: ['front', 'side', 'back'],
} as const;

/** Validate the whole request before touching presentation state or rendering. */
export function validatePreviewConfiguration(input: unknown): PreviewConfiguration {
  if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype
    || Object.getOwnPropertySymbols(input).length) throw new Error('Preview configuration requires a plain object.');
  const result: Record<string, string | boolean> = {};
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(input))) {
    if (!descriptor.enumerable || descriptor.get || descriptor.set) throw new Error(`Preview option ${key} must be a plain value.`);
    if (key === 'paused' || key === 'reset') {
      if (typeof descriptor.value !== 'boolean') throw new Error(`Preview ${key} requires a boolean.`);
    } else if (Object.hasOwn(choices, key)) {
      const values: readonly string[] = choices[key as keyof typeof choices];
      if (!values.includes(descriptor.value)) throw new Error(`Unknown ${key}: choose ${values.join(', ')}.`);
    } else throw new Error(`Unknown preview option: ${key}.`);
    result[key] = descriptor.value;
  }
  return result as PreviewConfiguration;
}
