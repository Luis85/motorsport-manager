// Scene/Models panel tabs: selection and roving tab focus (arrow, Home and End keys
// when editable), the filter label and reset on switch, and routing filter input to
// the active list. List rendering itself belongs to the panels module.
import { $, field, button } from './dom.js';

export function setupPanelTabs({
  editable,
  renderTree,
  renderModels,
}: {
  editable: boolean;
  renderTree(): void;
  renderModels(): void;
}) {
  let tab = 'scene';
  function switchTab(next: string) {
    tab = next;
    button('scene-tab').tabIndex = next === 'scene' ? 0 : -1;
    button('models-tab').tabIndex = next === 'models' ? 0 : -1;
    $('scene-list').hidden = next !== 'scene';
    $('model-list').hidden = next !== 'models';
    $('scene-tab').setAttribute('aria-selected', String(next === 'scene'));
    $('models-tab').setAttribute('aria-selected', String(next === 'models'));
    $('filter-label').textContent = next === 'scene' ? 'Find an object' : 'Find a model';
    field('filter').value = '';
    renderTree();
    renderModels();
  }
  button('scene-tab').addEventListener('click', () => switchTab('scene'));
  button('models-tab').addEventListener('click', () => switchTab('models'));
  button('browse-models').addEventListener('click', () => switchTab('models'));
  for (const id of ['scene-tab', 'models-tab'])
    button(id).addEventListener('keydown', (event) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) && editable) {
        event.preventDefault();
        const next =
          event.key === 'Home'
            ? 'scene'
            : event.key === 'End'
              ? 'models'
              : tab === 'scene'
                ? 'models'
                : 'scene';
        switchTab(next);
        button(next === 'scene' ? 'scene-tab' : 'models-tab').focus();
      }
    });
  button('models-tab').tabIndex = -1;
  field('filter').addEventListener('input', () =>
    tab === 'scene' ? renderTree() : renderModels(),
  );
}
