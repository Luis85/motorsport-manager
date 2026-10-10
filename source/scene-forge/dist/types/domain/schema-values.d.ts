import { z } from 'zod';
export declare const Id: z.ZodString;
export declare const NumberValue: z.ZodNumber;
export declare const expressionOperators: readonly ["add", "sub", "mul", "div", "min", "max", "abs", "neg", "sin", "cos", "clamp"];
export type ScalarValue = number | {
    $param: string;
} | {
    $expr: (typeof expressionOperators)[number];
    args: ScalarValue[];
};
export declare const Scalar: z.ZodType<ScalarValue>;
export declare const Vec3: z.ZodTuple<[z.ZodType<ScalarValue, unknown, z.core.$ZodTypeInternals<ScalarValue, unknown>>, z.ZodType<ScalarValue, unknown, z.core.$ZodTypeInternals<ScalarValue, unknown>>, z.ZodType<ScalarValue, unknown, z.core.$ZodTypeInternals<ScalarValue, unknown>>], null>;
export declare const Vec2: z.ZodTuple<[z.ZodType<ScalarValue, unknown, z.core.$ZodTypeInternals<ScalarValue, unknown>>, z.ZodType<ScalarValue, unknown, z.core.$ZodTypeInternals<ScalarValue, unknown>>], null>;
export declare const Color: z.ZodString;
export declare const Transform: z.ZodObject<{
    position: z.ZodOptional<z.ZodTuple<[z.ZodType<ScalarValue, unknown, z.core.$ZodTypeInternals<ScalarValue, unknown>>, z.ZodType<ScalarValue, unknown, z.core.$ZodTypeInternals<ScalarValue, unknown>>, z.ZodType<ScalarValue, unknown, z.core.$ZodTypeInternals<ScalarValue, unknown>>], null>>;
    rotation: z.ZodOptional<z.ZodTuple<[z.ZodType<ScalarValue, unknown, z.core.$ZodTypeInternals<ScalarValue, unknown>>, z.ZodType<ScalarValue, unknown, z.core.$ZodTypeInternals<ScalarValue, unknown>>, z.ZodType<ScalarValue, unknown, z.core.$ZodTypeInternals<ScalarValue, unknown>>], null>>;
    scale: z.ZodOptional<z.ZodTuple<[z.ZodType<ScalarValue, unknown, z.core.$ZodTypeInternals<ScalarValue, unknown>>, z.ZodType<ScalarValue, unknown, z.core.$ZodTypeInternals<ScalarValue, unknown>>, z.ZodType<ScalarValue, unknown, z.core.$ZodTypeInternals<ScalarValue, unknown>>], null>>;
}, z.core.$strict>;
export type V3 = [ScalarValue, ScalarValue, ScalarValue];
export type V2 = [ScalarValue, ScalarValue];
export type TransformSpec = z.infer<typeof Transform>;
