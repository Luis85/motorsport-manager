import { catalog } from '../domain/catalog.js';
import type { Character } from '../domain/character.js';
import { button, escape as e, icon, pathValue } from './helpers.js';

export const chapters = ['Identity', 'Body & Face', 'Coat & Details', 'Skills & Personality', 'Outfits'];
const descriptions = [
  'A name, a voice. The beginning of a little story.',
  'Small details. A familiar little face.',
  'A palette that feels like them.',
  'A little curiosity. A world of possibilities.',
  'Ready for the everyday adventure.',
];
export const palettes = [
  ['Honey', '#c89b63'], ['Cream', '#e9ddbf'], ['Moss', '#8d9b78'],
  ['Chestnut', '#8e6048'], ['Cloud', '#d8d9d2'], ['Rose', '#c98980'],
  ['Walnut', '#40382f'], ['Forest', '#405d48'],
];
function lock(c: Character, path: string): string {
  const locked = c.locks.includes(path);
  return button(icon(locked ? 'lock' : 'unlock'), `lock:${path}`, `icon-button ${locked ? 'locked' : ''}`,
    `aria-label="${locked ? 'Unlock' : 'Lock'} ${e(path.split('.').pop())} for randomization" aria-pressed="${locked}" title="Locks protect randomization; direct edits still work"`);
}
function select(c: Character, label: string, path: string, choices: (string | [string, string])[], locked = false): string {
  const value = pathValue(c, path);
  if (typeof value === 'string' && !choices.some(item => (Array.isArray(item) ? item[0] : item) === value)) choices = [[value, value], ...choices];
  return `<div class="field"><label for="field-${path}">${e(label)}</label><div class="field-line"><select id="field-${path}" data-field="${path}">${choices.map(item => {
    const [v, name] = Array.isArray(item) ? item : [item, item];
    return `<option value="${e(v)}" ${v === value ? 'selected' : ''}>${e(name)}</option>`;
  }).join('')}</select>${locked ? lock(c, path) : ''}</div></div>`;
}
function slider(c: Character, label: string, path: string, ends: [string, string]): string {
  const value = Math.round(Number(pathValue(c, path)) * 100);
  return `<div class="field slider-field"><label for="range-${path}">${label}</label><div class="slider-ends"><span>${ends[0]}</span><span>${ends[1]}</span></div><div class="field-line"><input id="range-${path}" type="range" min="70" max="130" value="${value}" data-range="${path}"><input id="number-${path}" class="range-value" aria-label="${label} percent" type="number" min="70" max="130" step="1" value="${value}" data-range="${path}">${lock(c, path)}</div></div>`;
}
function swatches(c: Character, label: string, path: string): string {
  const value = pathValue(c, path);
  return `<fieldset class="swatches"><legend>${label}</legend><div class="swatch-line">${palettes.map(([name, color]) => button(`<span style="background:${color}">${value === color ? icon('check') : ''}</span><small>${name}</small>`, `color:${path}:${color}`, `swatch ${value === color ? 'selected' : ''}`, `aria-label="${name} ${label}" aria-pressed="${value === color}"`)).join('')}</div><div class="custom-color"><label for="color-${path}">Custom color</label><input id="color-${path}" type="color" value="${e(value)}" data-field="${path}"><code>${e(value)}</code>${lock(c, path)}</div></fieldset>`;
}
function identity(c: Character): string {
  return `<div class="field"><label for="character-name">Companion name</label><input id="character-name" data-field="identity.name" value="${e(c.identity.name)}" maxlength="24" autocomplete="off"><small>You can change their name any time.</small></div><div class="species-line">Species <strong>Sproutling</strong></div>`
    + select(c, 'Pronouns', 'identity.pronouns', ['they/them', 'she/her', 'he/him', 'any pronouns'])
    + `<p class="sentence">Meet ${e(c.identity.name || 'your companion')}. ${e(c.identity.pronouns === 'she/her' ? 'She is' : c.identity.pronouns === 'he/him' ? 'He is' : 'They are')} ready for a little adventure.</p>`
    + select(c, 'Gender', 'identity.gender', [['', 'Unspecified'], ['Non-binary', 'Non-binary'], ['Female', 'Female'], ['Male', 'Male']])
    + select(c, 'Voice', 'identity.voice', ['Soft', 'Warm chirps', 'Bright chirps', 'Soft chirps'])
    + button('Play voice sample', 'voice', 'secondary')
    + '<p class="hint">Name, pronouns, gender, appearance and abilities are independent. Voice samples are synthesized chirps.</p>';
}
function body(c: Character, face: boolean): string {
  const tabs = `<div class="segmented" aria-label="Body and face controls">${button('Body', 'bodytab:body', face ? '' : 'active', `aria-pressed="${!face}"`)}${button('Face', 'bodytab:face', face ? 'active' : '', `aria-pressed="${face}"`)}</div>`;
  if (face) return tabs + slider(c, 'Head size', 'appearance.headSize', ['Smaller', 'Larger'])
    + slider(c, 'Eye size', 'appearance.eyeSize', ['Smaller', 'Larger'])
    + swatches(c, 'Eye color', 'appearance.eyeColor')
    + '<p class="hint">Face choices are saved with your companion. Camera and animation choices only change the preview.</p>';
  return tabs + '<h3>Starting look</h3><div class="preset-row">' + catalog.presets.filter(p => p.id !== 'bramble').map(p => button(`<span class="preset-dot" style="background:${p.appearance.coat}"></span>${e(p.name)}`, `preset:${p.id}`, c.appearance.preset === p.id ? 'selected' : '', `aria-pressed="${c.appearance.preset === p.id}"`)).join('') + '</div>'
    + '<p class="hint">Starting looks replace appearance and keep locked traits.</p>'
    + select(c, 'Body shape', 'appearance.body', [['round', 'Round'], ['balanced', 'Balanced'], ['slender', 'Slender']], true)
    + slider(c, 'Head size', 'appearance.headSize', ['Smaller', 'Larger'])
    + select(c, 'Ears', 'appearance.ears', [['round', 'Round'], ['long', 'Long'], ['pointed', 'Pointed']], true)
    + slider(c, 'Ear size', 'appearance.earSize', ['Smaller', 'Larger'])
    + select(c, 'Tail', 'appearance.tail', [['short', 'Short & soft'], ['long', 'Long'], ['fluffy', 'Fluffy']], true);
}
function skills(c: Character): string {
  const used = Object.values(c.skills).reduce((a, b) => a + b, 0);
  return `<div class="points"><strong>${used} / ${catalog.skillBudget} points</strong><span>${catalog.skillBudget - used} unspent · unspent points are welcome</span></div>`
    + catalog.skills.map(skill => `<div class="skill-row"><div><strong>${e(skill.name)}</strong><small>${e(skill.description)}</small></div><div class="stepper">${button('−', `skill:${skill.id}:-1`, '', `aria-label="Decrease ${skill.name}" ${(c.skills[skill.id] || 0) <= 0 ? 'disabled' : ''}`)}<output aria-label="${skill.name} invested points">${c.skills[skill.id] || 0}</output>${button('+', `skill:${skill.id}:1`, '', `aria-label="Increase ${skill.name}" ${used >= 10 || (c.skills[skill.id] || 0) >= 10 ? 'disabled' : ''}`)}</div></div>`).join('')
    + '<p class="hint">Invest up to ten starting points across your skills. These are the engine’s invested points, not skill levels.</p>'
    + select(c, 'Personality', 'personality', catalog.personalities.map(p => [p.id, p.name]))
    + `<p class="sentence">${e(catalog.personalities.find(p => p.id === c.personality)?.description || '')}</p>`;
}
function outfits(c: Character): string {
  return '<p class="hint">Cosmetic choices, with no skill bonuses. Each item remains independently editable.</p>'
    + catalog.slots.map(slot => select(c, slot[0].toUpperCase() + slot.slice(1), `outfits.${slot}`, [['', 'None'], ...catalog.outfits.filter(o => o.slot === slot).map(o => [o.id, o.name] as [string, string])], true)).join('')
    + button('Save this look', 'look', 'secondary')
    + '<p class="hint">A look saves appearance and cosmetics. Identity, personality and skills stay with the companion.</p>';
}
export function fields(c: Character, chapter: number, face: boolean): string {
  const content = chapter === 0 ? identity(c) : chapter === 1 ? body(c, face) : chapter === 2
    ? swatches(c, 'Base coat', 'appearance.coat') + swatches(c, 'Belly', 'appearance.belly') + swatches(c, 'Inner ears', 'appearance.inner')
    : chapter === 3 ? skills(c) : outfits(c);
  return `<header class="panel-heading"><h2>${chapters[chapter]}</h2><p>${descriptions[chapter]}</p></header><div class="fields">${content}</div><div class="chapter-next">${button("Reset this section", "reset-section", "reset-section")}${button(chapter === 4 ? 'Review companion' : `Next: ${chapters[chapter + 1]} ${icon('arrow')}`, chapter === 4 ? 'review' : `chapter:${chapter + 1}`, 'secondary')}</div>`;
}
