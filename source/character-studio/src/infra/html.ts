import { embedded } from './embedded.js';
import type { Character } from '../domain/character.js';
export function renderHtml(options: {server?: boolean; token?: string; storageKey?: string; initial?: Character; preview?: {mode?: string; light?: string; pose?: string; camera?: string}} = {}) {
  const config = JSON.stringify({ server: false, ...options }).replaceAll('<', '\\u003c');
  return embedded.html
    .replace('<!--STUDIO_STYLE-->', () => `<style>${embedded.css}</style>`)
    .replace('<!--STUDIO_CONFIG-->', () => `<script>window.__STUDIO__=${config};</script>`)
    .replace('<!--STUDIO_SCRIPT-->', () => `<script>${embedded.javascript.replaceAll('</script', '<\\/script')}</script>`);
}
