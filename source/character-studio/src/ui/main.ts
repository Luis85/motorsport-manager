import { catalog } from '../domain/catalog.js';
import { validateCharacter, type Character } from '../domain/character.js';
import { compilePackage, compileVisual, importCharacter } from '../application/compiler.js';
import { createViewport } from './viewport.js';
import { StudioState } from './state.js';
import { Dialogs } from './dialogs.js';
import { fields, chapters } from './fields.js';
import { randomizeSection, resetSection } from '../application/section-actions.js';
import { button, download, downloadText, escape as e, icon, pathValue } from './helpers.js';

const state = new StudioState();
const dialogs = new Dialogs();
let chapter = 0, face = false, collection = !window.__STUDIO__?.initial;
const preview = window.__STUDIO__?.preview;
let mode = preview?.mode || 'studio', light = preview?.light || 'studio';
let pose = preview?.pose || 'idle', camera = preview?.camera || 'front';
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let pendingImport: Character | null = null;
let pendingLook: { appearance: Character['appearance']; outfits: Character['outfits'] } | null = null;
let viewport: ReturnType<typeof createViewport> | undefined;
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<header class="app-header"><a href="#" class="brand" data-action="collection" aria-label="Littlewild Character Studio home">${icon('leaf')}<span>LITTLEWILD</span></a><div class="app-name"><strong>Character Studio</strong><span>Identity. Character. A little life of their own.</span></div><div class="header-actions">${button('Companions', 'collection')}${button(`${icon('settings')} <span>Accessibility</span>`, 'preferences')}</div></header><div id="save-status" class="save-status" role="status" aria-live="polite"></div><main><div id="journey" class="journey"></div><div class="workspace"><section id="editor-panel" tabindex="-1"></section><section class="preview" aria-label="Character preview"><canvas id="viewport"></canvas><div class="preview-top"><div id="preview-modes" class="segmented"></div><div id="preview-lights" class="segmented"></div></div><div class="preview-caption"><span id="preview-caption">Same companion. Every little angle.</span></div><div id="portrait-action"></div><div class="preview-bottom"><div id="preview-cameras" class="segmented"></div><div class="preview-bottom-row"><div id="preview-poses" class="segmented"></div><div class="camera-tools">${button('−', 'zoom:-0.15', 'icon-button', 'aria-label="Zoom out"')}${button('+', 'zoom:0.15', 'icon-button', 'aria-label="Zoom in"')}${button('Reset view', 'reset-view')}</div></div></div></section></div><footer id="editor-actions" class="editor-actions"></footer></main><input id="import-file" type="file" accept="application/json,.json" hidden>`;
try {
  viewport = createViewport(document.querySelector<HTMLCanvasElement>('#viewport')!);
  viewport.setMode(mode); viewport.setLight(light); viewport.setPose(pose); viewport.setCamera(camera);
} catch (error) {
  const notice = document.createElement('p');
  notice.className = 'viewport-error';
  notice.textContent = `3D preview unavailable: ${(error as Error).message}. Your character controls and exports still work. Try a browser with WebGL enabled.`;
  document.querySelector('.preview')!.append(notice);
}
function status(): void { document.querySelector('#save-status')!.textContent = state.savedStatus; }
function segmented(id: string, values: [string, string][], current: string, action: string): void {
  document.querySelector(id)!.innerHTML = values.map(([value, label]) => button(label, `${action}:${value}`, value === current ? 'active' : '', `aria-pressed="${value === current}"`)).join('');
}
function previewControls(): void {
  const focused = document.activeElement as HTMLElement;
  const restore = focused?.closest('.preview') ? focused.dataset.action : undefined;
  segmented('#preview-modes', [['studio', '3D Studio'], ['world', 'In-world'], ['portrait', 'Portrait']], mode, 'mode');
  segmented('#preview-lights', [['studio', 'Studio'], ['daylight', 'Daylight'], ['night', 'Night']], light, 'light');
  segmented('#preview-cameras', [['front', 'Front'], ['side', 'Side'], ['back', 'Back']], camera, 'camera');
  segmented('#preview-poses', [['idle', 'Idle'], ['walk', 'Walk'], ['work', 'Work'], ['celebrate', 'Celebrate']], pose, 'pose');
  document.querySelector('#preview-poses')!.insertAdjacentHTML('afterbegin', button(paused ? 'Play' : 'Pause', 'pause', '', `aria-label="${paused ? 'Play' : 'Pause'} character animation"`));
  document.querySelector('#portrait-action')!.innerHTML = mode === 'portrait' ? button('Use this thumbnail', 'thumbnail', 'secondary') : '';
  document.querySelector('#preview-caption')!.textContent = mode === 'world' ? 'Scale preview · a small studio diorama, not a running game' : mode === 'portrait' ? 'Portrait framing · appearance and skills stay unchanged' : 'Drag to turn · arrow keys to rotate · + / − to zoom';
  if (restore) [...document.querySelectorAll<HTMLElement>('.preview [data-action]')].find(el => el.dataset.action === restore)?.focus();
}
function collectionMarkup(): string {
  return `<header class="panel-heading"><h2>Your companions</h2><p>A familiar face for every little adventure.</p></header><div class="fields"><h3>Choose a starting look</h3><p class="hint">Pip, Fern and Mochi are starting looks for the Sproutling species. Every choice can become your own.</p><div class="starting-looks">${catalog.presets.filter(p => p.id !== 'bramble').map(p => button(`<span class="look-swatch" style="background:${p.appearance.coat}"></span><span><strong>${p.name}</strong><small>${e(p.description)}</small></span>${icon('arrow')}`, `new:${p.id}`, 'starting-look')).join('')}</div>${state.records.size ? '<h3>Your collection</h3><div class="collection-list">' + [...state.records.values()].map(record => button(`${record.thumbnail ? `<img src="${e(record.thumbnail)}" alt="">` : '<span class="collection-symbol">' + icon('person') + '</span>'}<span><strong>${e(record.character.identity.name)}</strong><small>${record.committed ? record.dirty ? 'Companion · unapplied working draft' : 'Companion · saved' : 'Draft · continue editing'}</small></span>${icon('arrow')}`, `open:${record.character.id}`, 'collection-item')).join('') + '</div>' : '<p class="empty-collection">Your collection begins with one little companion.</p>'}${button('Import companion or look', 'import', 'secondary')}${state.recoverySource !== null ? '<p class="validation">Some browser recovery data could not be loaded. The original is preserved. Export it before clearing browser storage.</p>' + button('Export browser recovery data', 'recovery-library', 'secondary') : ''}</div>`;
}
function render(focus = false): void {
  const active = document.activeElement as HTMLElement;
  const activeId = active?.id;
  const activeAction = active?.dataset.action;
  const scroll = document.querySelector('#editor-panel')!.scrollTop;
  document.querySelector('#journey')!.innerHTML = collection ? '<div class="journey-heading"><h1>A little life of their own.</h1><p>Start with a look. Make a companion.</p></div>' : `<div class="journey-heading"><h1>Make ${e(state.character.identity.name)} your own</h1><p>${state.committed ? 'Editing a companion' : 'New companion'} · Sproutling</p></div><nav aria-label="Character chapters">${chapters.map((name, i) => button(name, `chapter:${i}`, chapter === i ? 'active' : '', chapter === i ? 'aria-current="step"' : '')).join('')}</nav>`;
  document.querySelector('#editor-panel')!.innerHTML = collection ? collectionMarkup() : fields(state.character, chapter, face);
  document.querySelector('#editor-actions')!.innerHTML = collection ? `<p>${icon('leaf')} Made for Littlewild. Ready for Scene Forge.</p>${button('Import JSON', 'import', 'secondary')}` : `<div class="history-actions">${button(`${icon('undo')} Undo`, 'undo', '', state.session.canUndo ? '' : 'disabled')}${button(`${icon('redo')} Redo`, 'redo', '', state.session.canRedo ? '' : 'disabled')}${button(`${icon('dice')} Randomize unlocked`, 'randomize')}${button(`${icon('save')} Save draft`, 'save')}${button('Export', 'export', '')}</div>${button(`Review companion ${icon('arrow')}`, 'review', 'primary')}`;
  viewport?.update(state.character);
  previewControls();
  status();
  document.querySelector('#editor-panel')!.scrollTop = focus ? 0 : scroll;
  if (focus) document.querySelector<HTMLElement>('#editor-panel')!.focus();
  else if (activeId) document.getElementById(activeId)?.focus();
  else if (activeAction) [...document.querySelectorAll<HTMLElement>('[data-action]')].find(el => el.dataset.action === activeAction)?.focus();
}
function set(path: string, value: unknown, refresh = true): void {
  state.apply([{ op: pathValue(state.character, path) === undefined ? 'add' : 'set', path: '/' + path.replaceAll('.', '/'), value }]);
  if (refresh) render();
  else {
    viewport?.update(state.character);
    document.querySelector('h1')!.textContent = `Make ${state.character.identity.name || 'your companion'} your own`;
    status();
  }
}
function chirp(): void {
  const context = new AudioContext();
  const oscillator = context.createOscillator(), gain = context.createGain();
  const voice = state.character.identity.voice.toLowerCase();
  const hz = voice.includes('bright') ? 880 : voice.includes('warm') ? 520 : 660;
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(hz, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(hz * 1.5, context.currentTime + .12);
  oscillator.frequency.exponentialRampToValueAtTime(hz * .8, context.currentTime + .3);
  gain.gain.setValueAtTime(.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.15, context.currentTime + .03);
  gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .4);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(); oscillator.stop(context.currentTime + .42);
  oscillator.onended = () => void context.close();
}
async function action(value: string): Promise<void> {
  const [name, arg, extra] = value.split(':');
  const previewValues: Record<string, string[]> = {mode:['studio','world','portrait'], light:['studio','daylight','night'], pose:['idle','walk','work','celebrate'], camera:['front','side','back']};
  if (previewValues[name] && (!previewValues[name].includes(arg) || extra !== undefined)) throw new Error(`Unknown ${name}: ${arg}. Choose ${previewValues[name].join(', ')}.`);
  if (name === 'close') return;
  if (name === 'collection') { collection = true; render(true); }
  else if (name === 'new') { state.newCharacter(arg); collection = false; chapter = 0; render(true); }
  else if (name === 'open') { state.open(arg); collection = false; render(true); }
  else if (name === 'chapter') { chapter = Number(arg); render(true); }
  else if (name === 'bodytab') { face = arg === 'face'; render(); }
  else if (name === 'preset') { state.apply([{op:'preset',preset:arg}]); render(); }
  else if (name === 'lock') {
    const locks = state.character.locks;
    state.session.setLocks(locks.includes(arg) ? locks.filter(p => p !== arg) : [...locks, arg]);
    state.recover(); render();
  } else if (name === 'color') set(arg, extra);
  else if (name === 'skill') set(`skills.${arg}`, (state.character.skills[arg] || 0) + Number(extra));
  else if (name === 'randomize') dialogs.show('Randomize unlocked choices', '<p>Choose what to explore. Locked traits stay in place. Identity, skills and personality remain unchanged.</p><div class="export-choices">' + button('All appearance', 'randomize-scope:all') + button('Body & face only', 'randomize-scope:body') + button('Coat colors only', 'randomize-scope:coat') + '</div>');
  else if (name === 'randomize-scope') {
    const operations = randomizeSection(state.character, arg, crypto.getRandomValues(new Uint32Array(1))[0]);
    if (operations.length) state.apply(operations);
    dialogs.close(); render();
  } else if (name === 'reset-section') dialogs.show(`Reset ${chapters[chapter]}?`, '<p>Restore this chapter to the current starting look’s defaults. Other chapters and locks stay unchanged. Your companion’s name stays the same. You can undo this as one change.</p>', button('Keep current choices', 'close', 'secondary') + button('Reset this section', 'confirm-reset', 'primary'));
  else if (name === 'confirm-reset') {
    const operations = resetSection(state.character, chapter);
    if (operations.length) state.apply(operations);
    dialogs.close(); render();
  }
  else if (name === 'undo' || name === 'redo') { state.session[name](); state.recover(); render(); }
  else if (name === 'save') { await state.save(); status(); }
  else if (name === 'recovery-library' && state.recoverySource !== null) downloadText('character-studio-browser-recovery.json', state.recoverySource);
  else if (name === 'reload-disk') { await state.reloadDisk(); dialogs.close(); render(); }
  else if (name === 'review') dialogs.review(state);
  else if (name === 'commit') {
    await state.save(true); dialogs.close(); render();
    dialogs.show(`${state.character.identity.name} is ready`, `<p>Your companion is in your collection.</p><p>${e(state.savedStatus)}.</p><p>Export an engine package or Scene Forge visual to continue in the other tools. Creating a companion does not change a running world.</p>`, button('Keep editing', 'close', 'secondary') + button('Export companion', 'export', 'primary'));
  } else if (name === 'export') {
    if (arg === 'recipe') download(`${state.character.id}.character.json`, state.character);
    else if (arg === 'engine') download(`${state.character.id}.creature-package.json`, compilePackage(state.character));
    else if (arg === 'visual') download(`${state.character.id}.visual.json`, compileVisual(state.character));
    else dialogs.show('Export companion', '<p>Choose the file for your next step. Your original companion stays here.</p><div class="export-choices">' + button('<strong>Companion recipe</strong><span>Complete editable record, including draft status.</span>', 'export:recipe') + button('<strong>Engine creature package</strong><span>Gameplay definition, visual and dependency references.</span>', 'export:engine') + button('<strong>Scene Forge visual</strong><span>Engine-compatible 3D actor with cosmetic attachments.</span>', 'export:visual') + button('<strong>Appearance look</strong><span>Body, colors and cosmetics. No identity or skills.</span>', 'look') + '</div>');
  } else if (name === 'look') {
    download(`${state.character.id}.look.json`, { format: 'littlewild-look', schemaVersion: 1, appearance: state.character.appearance, outfits: state.character.outfits });
    state.savedStatus = 'Appearance look downloaded · identity and skills excluded'; status();
  } else if (name === 'import') { dialogs.close(); document.querySelector<HTMLInputElement>('#import-file')!.click(); }
  else if (name === 'confirm-import' && pendingImport) { state.importCharacter(pendingImport); pendingImport = null; collection = false; dialogs.close(); render(true); }
  else if (name === 'confirm-look' && pendingLook) {
    state.apply([{op:'set',path:'/appearance',value:pendingLook.appearance},{op:'set',path:'/outfits',value:pendingLook.outfits}]);
    pendingLook = null; collection = false; dialogs.close(); render();
  } else if (name === 'mode') { mode = arg as typeof mode; viewport?.setMode(arg as any); previewControls(); }
  else if (name === 'light') { light = arg as typeof light; viewport?.setLight(arg as any); previewControls(); }
  else if (name === 'pose') { pose = arg as typeof pose; viewport?.setPose(arg as any); previewControls(); }
  else if (name === 'camera') { camera = arg as typeof camera; viewport?.setCamera(arg as any); previewControls(); }
  else if (name === 'pause') { paused = !paused; viewport?.pause(paused); previewControls(); }
  else if (name === 'zoom') viewport?.zoom(Number(arg));
  else if (name === 'reset-view') { viewport?.reset(); camera = 'front'; previewControls(); }
  else if (name === 'thumbnail') {
    if (!viewport) throw new Error('A working 3D preview is needed to capture a thumbnail.');
    state.thumbnail(viewport.capture()); status();
  } else if (name === 'preferences') dialogs.preferences(paused);
  else if (name === 'voice') chirp();
}
document.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
  if (!target || target.hasAttribute('disabled')) return;
  event.preventDefault();
  void action(target.dataset.action!).catch(error => { render(); dialogs.error(error); });
});
document.addEventListener('change', async event => {
  const input = event.target as HTMLInputElement;
  try {
    if (input.dataset.field) set(input.dataset.field, input.dataset.field.startsWith('outfits.') && !input.value ? null : input.value, input.type !== 'text');
    else if (input.dataset.range) set(input.dataset.range, Number(input.value) / 100);
    else if (input.dataset.preference) {
      if (input.dataset.preference === 'pause') { paused = input.checked; viewport?.pause(paused); previewControls(); }
      else document.body.classList.toggle(input.dataset.preference === 'large' ? 'large-text' : 'reduced-motion', input.checked);
    } else if (input.id === 'import-file' && input.files?.[0]) {
      if (input.files[0].size > 1_000_000) throw new Error('Choose a JSON file smaller than 1 MB.');
      const data = JSON.parse(await input.files[0].text()); input.value = '';
      if (data.format === 'littlewild-look') {
        if (data.schemaVersion !== 1 || Object.keys(data).some(k => !['format','schemaVersion','appearance','outfits'].includes(k))) throw new Error('This look uses an unsupported format.');
        const result = validateCharacter({...state.character, appearance:data.appearance, outfits:data.outfits});
        if (!result.ok) throw new Error(result.errors.map(issue => `${issue.path}: ${issue.message}`).join('\n'));
        pendingLook = data;
        dialogs.show('Apply appearance look', '<p>This replaces body, face, colors and cosmetic outfit choices, including locked values. Identity, skills and personality stay unchanged. The whole change can be undone in one step.</p>', button('Cancel', 'close', 'secondary') + button('Apply look', 'confirm-look', 'primary'));
      } else {
        const character = importCharacter(data);
        if (dialogs.importPreview(character)) pendingImport = character;
      }
    }
  } catch (error) { input.value = ''; render(); dialogs.error(error); }
});
document.addEventListener('input', event => {
  const input = event.target as HTMLInputElement;
  if (input.type === 'range' && input.dataset.range) {
    const number = input.parentElement!.querySelector<HTMLInputElement>('input[type="number"]')!;
    number.value = input.value;
    const draft = state.character;
    (draft.appearance as any)[input.dataset.range.split('.')[1]] = Number(input.value) / 100;
    viewport?.update(draft);
  }
});
document.addEventListener('keydown', event => {
  if ((event.target as HTMLElement).matches('input,textarea,select,[contenteditable]') || dialogs.element.open) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    const redo = event.shiftKey;
    if (redo ? state.session.canRedo : state.session.canUndo) { event.preventDefault(); void action(redo ? 'redo' : 'undo'); }
  }
});
window.addEventListener('beforeunload', event => {
  if (!state.storageAvailable && state.changed) { event.preventDefault(); event.returnValue = ''; }
});
window.characterStudio = Object.freeze({
  discover: () => ({
    format:'character-studio-browser-api', version:1,
    methods: {inspect:'Detached current character, history availability and persistence status',catalog:'Available looks, slots, equipment, personalities and engine skills',apply:'Atomic operation array; updates the local working draft only',preview:'Preview-only controls; never modifies the character'},
    operations: ['set','add','remove','preset','randomize','look','reset'],
    preview: {setMode:['studio','world','portrait'],setLight:['studio','daylight','night'],setPose:['idle','walk','work','celebrate'],setCamera:['front','side','back'],zoom:'Finite numeric delta',reset:'Restore front framing',pause:'Boolean',capture:'PNG data URL'},
    persistence:'Use the guarded local HTTP API or CLI to save to disk; browser apply edits only the working draft.',
  }),
  inspect: () => ({ character: state.character, canUndo: state.session.canUndo, canRedo: state.session.canRedo, persistence: state.savedStatus }),
  catalog: () => structuredClone(catalog),
  apply: (operations: unknown[]) => { const result = state.apply(operations); collection = false; render(); return result; },
  preview: Object.freeze({
    setMode: (value: string) => action(`mode:${value}`),
    setLight: (value: string) => action(`light:${value}`),
    setPose: (value: string) => action(`pose:${value}`),
    setCamera: (value: string) => action(`camera:${value}`),
    zoom: (delta: number) => {
      if (typeof delta !== 'number' || !Number.isFinite(delta)) throw new Error('Zoom requires a finite numeric delta.');
      viewport?.zoom(delta);
    },
    reset: () => action('reset-view'),
    pause: (value: boolean) => {
      if (typeof value !== 'boolean') throw new Error('Pause requires a boolean.');
      paused = value; viewport?.pause(value); previewControls();
    },
    capture: () => viewport?.capture(),
  }),
});
render();
void state.load().then(() => render());
