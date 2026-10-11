// The recipe/source side panel: the Recipe button toggles the current scene recipe,
// other JSON text (such as a review plan) can be shown in it, and closing it keeps the
// Recipe button's expanded state and keyboard focus coherent.
import { $, button } from './dom.js';

export function setupSourcePanel() {
  button('recipe').addEventListener('click', () => {
    $('source-title').textContent = 'Current scene recipe';
    $('source-panel').hidden = !$('source-panel').hidden;
    button('recipe').setAttribute('aria-expanded', String(!$('source-panel').hidden));
  });
  button('close-source').addEventListener('click', () => {
    hideSourcePanel();
    button('recipe').focus();
  });
}
export function showSourceText(title: string, text: string) {
  $('source-title').textContent = title;
  $('source').textContent = text;
  $('source-panel').hidden = false;
  button('recipe').setAttribute('aria-expanded', 'true');
}
export function hideSourcePanel() {
  $('source-panel').hidden = true;
  button('recipe').setAttribute('aria-expanded', 'false');
}
