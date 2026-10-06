import { fail } from './errors.js';
import type { ScalarValue } from './schema.js';

/** Evaluate a bounded data AST. Trigonometric operands use degrees. */
export function scalar(value: ScalarValue, params: Record<string, number>, depth = 0): number {
  if (depth > 16) fail('EXPRESSION_DEPTH', 'Scalar expressions may nest at most 16 levels.');
  let n: number;
  if (typeof value === 'number') n = value;
  else if ('$param' in value) {
    if (!Object.hasOwn(params, value.$param))
      fail('PARAMETER_MISSING', `Parameter ${value.$param} is not defined.`);
    n = params[value.$param];
  } else {
    const args = value.args.map((v) => scalar(v, params, depth + 1));
    const arity = { sub: 2, div: 2, abs: 1, neg: 1, sin: 1, cos: 1, clamp: 3 }[
      value.$expr as string
    ];
    if (arity && args.length !== arity)
      fail('EXPRESSION_ARITY', `${value.$expr} requires ${arity} arguments.`);
    switch (value.$expr) {
      case 'add':
        n = args.reduce((a, b) => a + b, 0);
        break;
      case 'sub':
        n = args[0] - args[1];
        break;
      case 'mul':
        n = args.reduce((a, b) => a * b, 1);
        break;
      case 'div':
        if (args[1] === 0) fail('EXPRESSION_DIV_ZERO', 'Cannot divide by zero.');
        n = args[0] / args[1];
        break;
      case 'min':
        n = Math.min(...args);
        break;
      case 'max':
        n = Math.max(...args);
        break;
      case 'abs':
        n = Math.abs(args[0]);
        break;
      case 'neg':
        n = -args[0];
        break;
      case 'sin':
        n = Math.sin((args[0] * Math.PI) / 180);
        break;
      case 'cos':
        n = Math.cos((args[0] * Math.PI) / 180);
        break;
      case 'clamp':
        if (args[1] > args[2]) fail('EXPRESSION_RANGE', 'Clamp minimum exceeds maximum.');
        n = Math.min(args[2], Math.max(args[1], args[0]));
        break;
      default:
        return fail('EXPRESSION_OPERATOR', 'Unsupported expression operator.');
    }
  }
  if (!Number.isFinite(n) || Math.abs(n) > 1e6)
    fail('EXPRESSION_RANGE', 'Scalar result must be finite and between -1,000,000 and 1,000,000.', {
      value: n,
    });
  return n;
}
