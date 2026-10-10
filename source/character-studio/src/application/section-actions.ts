import { createCharacter, stageRandomize, type Character } from '../domain/character.js';
import type { Operation } from './transactions.js';

const bodyFields = ['preset','body','headSize','earSize','ears','eyeSize','eyeColor','tail'];
const coatFields = ['coat','belly','inner'];
function appearanceChanges(current: Character, next: Character, keys: string[]): Operation[] {
  return keys.filter(key => current.appearance[key as keyof Character['appearance']] !== next.appearance[key as keyof Character['appearance']])
    .map(key => ({op:'set',path:`/appearance/${key}`,value:next.appearance[key as keyof Character['appearance']]}));
}
export function randomizeSection(character: Character, scope: string, seed: number): Operation[] {
  if (scope === 'all') return [{op:'randomize',seed}];
  if (!['body','coat'].includes(scope)) throw new Error('Choose all appearance, body and face, or coat colors.');
  return appearanceChanges(character, stageRandomize(character, seed), scope === 'body' ? bodyFields : coatFields);
}
export function resetSection(character: Character, chapter: number): Operation[] {
  const defaults = createCharacter('draft', 'Draft', chapter === 1 || chapter === 2 ? character.appearance.preset : 'pip');
  defaults.identity.name = character.identity.name;
  if (!Number.isInteger(chapter) || chapter < 0 || chapter > 4) throw new Error('Choose a chapter from 0 through 4.');
  if (chapter === 0) return [{op:'set',path:'/identity',value:defaults.identity}];
  if (chapter === 1 || chapter === 2) return appearanceChanges(character, defaults, chapter === 1 ? bodyFields : coatFields);
  if (chapter === 3) return [{op:'set',path:'/skills',value:defaults.skills},{op:'set',path:'/personality',value:defaults.personality}];
  return [{op:'set',path:'/outfits',value:defaults.outfits}];
}
