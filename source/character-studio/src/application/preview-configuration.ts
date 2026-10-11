export const previewValues = {
  mode: ['studio', 'world', 'portrait'], light: ['studio', 'daylight', 'night'],
  pose: ['idle', 'walk', 'work', 'celebrate'], camera: ['front', 'three-quarter', 'side', 'back'],
} as const;
export const cameraYaw = {front: 0, 'three-quarter': .4, side: Math.PI / 2, back: Math.PI} as const;
export const previewNumbers = {
  yaw: {type:'number', minimum:-Math.PI, maximum:Math.PI, description:'Orbit in radians; overrides the named camera yaw.'},
  elevation: {type:'number', minimum:-.3, maximum:.8, default:.08, description:'Camera elevation in radians; overrides the named camera elevation.'},
  zoom: {type:'number', minimum:.5, maximum:2.5, default:1, description:'Absolute camera zoom multiplier.'},
  time: {type:'number', minimum:0, maximum:3600, default:0, description:'Presentation animation time in seconds; never advances gameplay. Explicit CLI preview time starts paused.'},
} as const;
export interface PreviewConfiguration {
  mode?: typeof previewValues.mode[number];
  light?: typeof previewValues.light[number];
  pose?: typeof previewValues.pose[number];
  camera?: keyof typeof cameraYaw;
  yaw?: number;
  elevation?: number;
  zoom?: number;
  time?: number;
  paused?: boolean;
  reset?: boolean;
}
/** Validate the whole request before touching presentation state or rendering. */
export function validatePreviewConfiguration(input: unknown): PreviewConfiguration {
  if (!input || typeof input !== 'object' || Object.getPrototypeOf(input) !== Object.prototype
    || Object.getOwnPropertySymbols(input).length) throw new Error('Preview configuration requires a plain object.');
  const result: Record<string, string | boolean | number> = {};
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(input))) {
    if (!descriptor.enumerable || descriptor.get || descriptor.set) throw new Error(`Preview option ${key} must be a plain value.`);
    const value = descriptor.value;
    if (key === 'paused' || key === 'reset') {
      if (typeof value !== 'boolean') throw new Error(`Preview ${key} requires a boolean.`);
    } else if (Object.hasOwn(previewValues, key)) {
      const values: readonly string[] = previewValues[key as keyof typeof previewValues];
      if (!values.includes(value)) throw new Error(`Unknown ${key}: choose ${values.join(', ')}.`);
    } else if (Object.hasOwn(previewNumbers, key)) {
      const {minimum, maximum} = previewNumbers[key as keyof typeof previewNumbers];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum)
        throw new Error(`Preview ${key} must be a finite number from ${minimum} through ${maximum}.`);
    } else throw new Error(`Unknown preview option: ${key}.`);
    result[key] = value;
  }
  return result as PreviewConfiguration;
}
