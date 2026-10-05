import { materialTool, environmentTool } from './appearance.js';
import { lightingTool } from './lighting.js';
import { riggingTool } from './rigging.js';
import type { EditorTool } from '../tool-host.js';
/** Add built-in tools here. No viewer changes are required for a new inspector feature. */
export const editorTools: EditorTool[] = [lightingTool, materialTool, riggingTool, environmentTool];
