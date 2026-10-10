import { catalog } from '../domain/catalog.js';
import { validateCharacter, type Character } from '../domain/character.js';
import { button, escape as e, icon } from './helpers.js';
import type { StudioState } from './state.js';

export class Dialogs {
  element: HTMLDialogElement;
  portrait?: (character: Character) => string | undefined;
  returnFocus: HTMLElement | null = null;
  returnAction: string | undefined;
  constructor() {
    this.element = document.createElement('dialog');
    this.element.id = 'studio-dialog';
    document.body.append(this.element);
    this.element.addEventListener('close', () => {
      if (this.returnFocus?.isConnected) this.returnFocus.focus();
      else [...document.querySelectorAll<HTMLElement>('[data-action]')].find(el => el.dataset.action === this.returnAction)?.focus();
    });
    this.element.addEventListener('click', event => {
      if ((event.target as HTMLElement).closest('[data-action="close"]')) this.close();
    });
  }
  show(title: string, body: string, actions = button('Close', 'close', 'secondary')): void {
    if (!this.element.open && !this.element.contains(document.activeElement)) {
      this.returnFocus = document.activeElement as HTMLElement;
      this.returnAction = this.returnFocus?.dataset.action;
    }
    this.element.innerHTML = `<div class="dialog-head"><h2 id="dialog-title" tabindex="-1">${e(title)}</h2>${button(icon('close'), 'close', 'icon-button', 'aria-label="Close dialog"')}</div>${body}<div class="dialog-actions">${actions}</div>`;
    this.element.setAttribute('aria-labelledby', 'dialog-title');
    if (!this.element.open) this.element.showModal();
    this.element.querySelector<HTMLElement>('#dialog-title')!.focus();
  }
  close(): void { this.element.close(); }
  error(error: unknown): void {
    this.show('Your work is still here', `<p class="error-message">${e(error instanceof Error ? error.message : error)}</p><p>Keep editing, retry the action, or export your current draft to keep a copy.</p>`, button('Keep editing', 'close', 'secondary') + button('Export draft JSON', 'export:recipe', 'primary') + (window.__STUDIO__?.server && String(error).includes('changed on disk') ? button('Open disk version · keep recovery copy', 'reload-disk', 'secondary') : ''));
  }
  portraitMarkup(character: Character): string {
    try {
      const src = this.portrait?.(character);
      return src ? `<img class="review-portrait" src="${e(src)}" alt="Portrait of ${e(character.identity.name || 'your companion')}" width="144" height="144">` : '';
    } catch { return ''; }
  }
  review(state: StudioState): void {
    const c = state.character;
    const result = validateCharacter({ ...c, status: 'ready' }, { commit: true });
    const used = Object.values(c.skills).reduce((a, b) => a + b, 0);
    const outfit = Object.values(c.outfits).filter(Boolean).map(id => catalog.outfits.find(o => o.id === id)?.name || id).join(', ') || 'No outfit selected';
    this.show(`Review ${c.identity.name || 'companion'}`,
      ` ${this.portraitMarkup(c)}<p class="dialog-intro">One companion. Ready for a little life of their own.</p><dl class="review-list"><div><dt>Identity</dt><dd>${e(c.identity.name)} · Sproutling<br>${e(c.identity.pronouns)} · ${e(c.identity.gender || 'Gender unspecified')} · ${e(c.identity.voice)}</dd></div><div><dt>Appearance</dt><dd>${e(c.appearance.body)} build · ${e(c.appearance.ears)} ears<br>Coat ${e(c.appearance.coat)} · ${e(c.appearance.tail)} tail</dd></div><div><dt>Personality & skills</dt><dd>${e(c.personality)} · ${used} of 10 points assigned<br>${10 - used} unspent points are valid.</dd></div><div><dt>Outfit</dt><dd>${e(outfit)}</dd></div></dl>${result.errors.length ? `<div role="alert" class="validation"><strong>Resolve these before creating</strong><ul>${result.errors.map(issue => `<li>${e(issue.path)}: ${e(issue.message)}</li>`).join('')}</ul></div>` : ''}<p class="hint">${state.committed ? 'Apply updates the same collection record.' : 'Create adds this companion to your collection.'} This does not insert or alter a companion in a running game. ${window.__STUDIO__?.server ? 'The executable saves to your selected library on disk.' : 'This offline editor saves in this browser; export JSON for a portable copy.'}</p>`,
      button('Keep editing', 'close', 'secondary') + button(state.committed ? 'Apply changes' : 'Create companion', 'commit', 'primary', result.ok ? '' : 'disabled'));
  }
  importPreview(character: unknown): boolean {
    const result = validateCharacter(character);
    if (!result.ok) {
      this.show('This file could not be imported', `<p>The current draft is unchanged. The original file remains your recovery copy.</p><ul class="validation">${result.errors.map(issue => `<li>${e(issue.path)}: ${e(issue.message)}</li>`).join('')}</ul>`, button('Choose another file', 'import', 'primary') + button('Cancel', 'close', 'secondary'));
      return false;
    }
    this.show('Import companion', `${this.portraitMarkup(result.value!)}<p class="dialog-intro">${e(result.value!.identity.name)} · Sproutling</p><p>Companion recipe · version 1 · ready to import.</p><p>Includes identity, appearance, skills, personality and cosmetics. This creates a separate draft with a new ID. Your current companion stays in your collection.</p><p class="hint">Read-only preview. No changes have been made.</p>`, button('Cancel', 'close', 'secondary') + button('Import as new draft', 'confirm-import', 'primary'));
    return true;
  }
  preferences(paused: boolean): void {
    this.show('Accessibility & preview', `<div class="preference"><label><input type="checkbox" data-preference="large" ${document.body.classList.contains('large-text') ? 'checked' : ''}> Larger interface text</label><p>Navigation and controls reflow with the text.</p></div><div class="preference"><label><input type="checkbox" data-preference="motion" ${document.body.classList.contains('reduced-motion') ? 'checked' : ''}> Reduce interface motion</label><p>Keeps interface transitions still.</p></div><div class="preference"><label><input type="checkbox" data-preference="pause" ${paused ? 'checked' : ''}> Pause character animation</label><p>Use the activity controls to choose another preview.</p></div><p class="hint">Preview controls do not change your saved companion. Sound only plays when requested. All required choices are available without sound.</p>`);
  }
}
