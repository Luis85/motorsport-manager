// Bundle the engine's detached validators for both UI and executable.
import "../../../wildlands/source/asset-catalog.ts";
import "../../../wildlands/source/creature-catalog.ts";
type Validator = { validate(value: unknown): unknown };
const root = globalThis as unknown as {
  LWAssets: Validator;
  LWCreatures: Validator;
};
export const validateAsset = (value: unknown) => root.LWAssets.validate(value);
export const validateCreature = (value: unknown) =>
  root.LWCreatures.validate(value);
