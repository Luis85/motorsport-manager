import { barrel } from './barrel.js';
import { building } from './building.js';
import { bush } from './bush.js';
import { crate } from './crate.js';
import { fence } from './fence.js';
import { rock } from './rock.js';
import { terrain } from './terrain.js';
import { tree } from './tree.js';
import type { Generator } from './types.js';

/** The generator catalog, version 1. */
export const generators: readonly Generator[] = [
  rock,
  tree,
  bush,
  crate,
  barrel,
  fence,
  building,
  terrain,
];
