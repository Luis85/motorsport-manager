/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-slides-contracts.d.ts" />
/// <reference path="./process-html.ts" />
/**
 * Present mode of Process Studio (LWProcessPresent): a full-window native `<dialog id="present">` that shows the slide deck of the
 * ACTIVE definition (LWProcessSlides.build; never the unapplied draft) beside the studio's own 2D map.
 *  - The deck is built once on open from the detached view. The snapshot is passed only past minute 0, so live facts are labelled
 *    by the model as one simulated run. Every model string is plain text and is escaped here (LWProcessHtml's `html` template).
 *  - The map is the studio's single LWProcess2D host element (`#map`). It MOVES into the map pane on open and back to its exact
 *    position on exit; there is never a second renderer. Each slide shows its step's scene (or the whole map) through the studio's
 *    selection command (`env.show`), and choosing a step on the map moves the deck to that step's slide (`follow`).
 *  - It never ticks: `env.enter` pauses a playing run with a command and nothing resumes on exit. The studio root is inert while
 *    presenting, and it does not open while an LWProcessDialog is open.
 *  - Keys: ArrowRight/PageDown/n next, ArrowLeft/PageUp/p previous, Home first, End last (arrow keys inside the map pan it instead);
 *    while the slide itself has focus, Space and ArrowDown page forward (Shift+Space and ArrowUp back) once the slide cannot scroll
 *    further;
 *    Escape closes the contents list when it is open, otherwise exits and returns focus to the invoker (or the fallback).
 *  - Brief deck: the Contents list has a **Section slides only** switch (`#present-brief`, a button with `aria-pressed`) that
 *    rebuilds the deck in place from the same detached definition and snapshot (LWProcessSlides.build with `{brief: true}`; never
 *    ticks). The position follows: a step slide moves to its section's slide, every other slide keeps its place, and switching back
 *    without moving returns to that step. The live region says which cut and slide are shown, the counter adds "· section slides
 *    only", and a step chosen on the map moves the brief deck to its section's slide. Every open starts with the full deck.
 * Ids: present, present-title, present-count, present-run, present-note, present-draft (shown when the studio has an unapplied draft),
 *   present-toc, present-exit, present-contents, present-brief, present-prev, present-next, present-live.
 */
declare namespace LWProcessPresent {
 interface State {index: number; count: number; id: string}
 interface Env {
  /** The studio root, inert while presenting. */
  inertRoot: HTMLElement;
  /** The studio's one 2D map host; it moves into the presentation and back. */
  map: HTMLElement;
  /** Prepares the studio (pauses a playing run with a command, 2D view) and returns the detached view to present. Never ticks. */
  enter(): {view: LWProcessApp.View; paused: boolean; draft?: boolean};
  /** Shows one step's scene, or the whole map for null, through the studio's selection command. */
  show(step: string | null): void;
  /** Restores the studio view after the map has moved back. `paused` tells whether entering paused the run. */
  leave(paused: boolean): void;
 }
 interface Surface {
  /** Opens on the selected step's slide (else slide 1); false while another dialog is open or the deck is already shown. */
  open(invoker: HTMLElement, fallback: () => HTMLElement | null): boolean;
  close(): void;
  isOpen(): boolean;
  /** The current slide (0-based index), or null when not presenting. */
  state(): State | null;
  /** Called after each studio refresh: a step chosen on the map moves the deck to that step's slide. */
  follow(selected: string | null): void;
  dispose(): void;
 }
 interface Api {create(host: HTMLElement, env: Env): Surface;}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessPresent?: LWProcessPresent.Api; LWProcessSlides: LWProcessSlides.Api; LWProcessSlidesText: LWProcessSlidesText.Api;
  LWProcessDialog: LWProcessDialog.Api; LWProcessHtml: LWProcessHtml.Api};
 const {html, join} = root.LWProcessHtml;
 type Safe = LWProcessHtml.Safe;
 const FOCUSABLE = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])';
 const shown = (n: HTMLElement | null): n is HTMLElement => !!n && n.isConnected && n.getClientRects().length > 0
  && !(n as HTMLButtonElement).disabled;
 const list = (b: LWProcessSlides.Block) => html`<ul>${b.items.map(item => html`<li>${item}</li>`)}</ul>`;
 /** One concept explainer as an aside of the slide. */
 const conceptHtml = (c: LWProcessSlides.Concept, i: number) => join([
  html`<aside class="present-concept" aria-labelledby="present-concept-${i}"><p class="present-tag">Concept</p>`,
  html`<h3 id="present-concept-${i}">${c.name}</h3><p>${c.text}</p></aside>`,
 ]);
 /** One slide as escaped markup: kicker, title, subtitle, lead, headed lists, one aside per concept and the live facts aside. */
 function slideHtml(s: LWProcessSlides.Slide, section: string): string {
  const concepts = s.concepts.map(conceptHtml);
  const live: Safe | '' = s.live
   ? html`<aside class="present-facts" aria-labelledby="present-facts-title"><h3 id="present-facts-title">${s.live.heading}</h3>${list(s.live)}</aside>`
   : '';
  // The title slide's key results follow its lead; on every other slide the live facts close the slide.
  const first = s.kind === 'title' ? live : '', last = s.kind === 'title' ? '' : live;
  return String(join([
   html`<div class="present-body"><p class="present-kicker">${section}</p><h2 id="present-title" tabindex="-1">${s.title}</h2>`,
   s.subtitle ? html`<p class="present-subtitle">${s.subtitle}</p>` : '',
   s.lead ? html`<p class="present-lead">${s.lead}</p>` : '',
   first,
   s.blocks.map(b => html`<section class="present-block"><h3>${b.heading}</h3>${list(b)}</section>`),
   concepts,
   last,
   html`</div>`,
  ]));
 }
 /** The dialog's fixed shell: heading with the run and draft notes, Contents and Exit, the slide, the map pane and the footer. */
 const SHELL = `<header class="present-head"><div class="present-heading"><p id="present-process" class="present-process"></p>
   <p id="present-count" class="present-meta"></p><p id="present-run" class="present-run" hidden></p>`
  + `<p id="present-note" class="present-note" hidden>The run is paused while you present.</p>
   <p id="present-draft" class="present-note" hidden>Showing the applied definition; your unapplied draft is not included.</p></div>
   <div class="present-actions"><button type="button" id="present-toc" aria-expanded="false" aria-controls="present-contents">Contents</button>`
  + `<button type="button" id="present-exit">Exit</button></div></header>
   <nav id="present-contents" class="present-contents" aria-label="Slides" hidden></nav>
   <div class="present-main"><article id="present-slide" class="present-slide" aria-labelledby="present-title" tabindex="0"></article>
   <section class="present-map" aria-label="Process map"><div id="present-stage" class="present-stage"></div>`
  + `<p id="present-map-hint" class="present-map-hint"></p></section></div>
   <footer class="present-foot"><button type="button" id="present-prev">Previous</button>`
  + `<button type="button" id="present-next" class="primary">Next</button></footer>
   <div id="present-live" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>`;
 function create(host: HTMLElement, env: LWProcessPresent.Env): LWProcessPresent.Surface {
  const dlg = document.createElement('dialog');
  dlg.id = 'present';
  dlg.className = 'present';
  dlg.setAttribute('aria-labelledby', 'present-title');
  dlg.innerHTML = SHELL;
  host.append(dlg);
  const q = <T extends HTMLElement = HTMLElement>(id: string) => dlg.querySelector<T>('#' + id)!;
  const main = dlg.querySelector<HTMLElement>('.present-main')!, contents = q('present-contents'), toc = q<HTMLButtonElement>('present-toc');
  const foot = dlg.querySelector<HTMLElement>('.present-foot')!;
  const prev = q<HTMLButtonElement>('present-prev'), next = q<HTMLButtonElement>('present-next');
  let deck: LWProcessSlides.Deck | null = null, index = 0, opened = false, moving = false, paused = false, escapedNow = false;
  // The full deck, the brief deck (built on first use), the detached inputs both come from, and the step a brief switch left.
  let full: LWProcessSlides.Deck | null = null, brief: LWProcessSlides.Deck | null = null;
  let source: {definition: LWProcess.Definition; snapshot: LWProcess.Snapshot | null} | null = null, left: {brief: string; full: string} | null = null;
  let invoker: HTMLElement | null = null, fallback: () => HTMLElement | null = () => null, home: {parent: Node; next: Node | null} | null = null;
  const sectionOf = (i: number) => deck!.sections.find(s => i >= s.first && i < s.first + s.count);
  const inDialog = (n: Element | null) => !!n && n !== document.body && dlg.contains(n);
  function renderContents(d: LWProcessSlides.Deck): void {
   const cut = join([
    html`<div class="present-cut"><button type="button" id="present-brief" aria-pressed="${d.brief === true}" aria-describedby="present-brief-hint">`,
    html`Section slides only</button><p id="present-brief-hint" class="present-cut-hint">Title, overview, resources, one slide per section and the summary; `,
    html`no step slides.</p></div>`,
   ]);
   const head = html`<div class="present-contents-head"><h2 class="present-contents-title">Contents</h2>${cut}</div>`;
   const item = (slide: LWProcessSlides.Slide, at: number) => join([
    html`<li><button type="button" data-slide="${at}">`,
    html`<span class="present-num" aria-hidden="true">${at + 1}</span><span>${slide.title}</span></button></li>`,
   ]);
   const group = (s: LWProcessSlides.Section, g: number) => join([
    html`<section class="present-group" aria-labelledby="present-group-${g}">`,
    html`<h3 id="present-group-${g}">${s.title}</h3><ol start="${s.first + 1}">`,
    d.slides.slice(s.first, s.first + s.count).map((slide, j) => item(slide, s.first + j)),
    html`</ol></section>`,
   ]);
   contents.innerHTML = String(html`${head}<div class="present-groups">${d.sections.map(group)}</div>`);
  }
  /**
   * Shows slide `i`: text, counters, contents marker, the announcement and the map scene. Focus that the change removed returns to
   * the slide title. `step` is the step the map shows: the slide's own, unless a step chosen on the map moved the brief deck to its
   * section's slide, which keeps that choice.
   */
  function go(i: number, fromMap = false, step?: string): void {
   if (!deck) return;
   left = null;
   const at = Math.max(0, Math.min(deck.slides.length - 1, i)), slide = deck.slides[at]!;
   const section = sectionOf(at)?.title ?? '', count = deck.slides.length;
   const focused = document.activeElement as HTMLElement | null, wasTitle = focused?.id === 'present-title';
   index = at;
   q('present-slide').innerHTML = slideHtml(slide, section);
   q('present-slide').scrollTop = 0;
   if (!fromMap) dlg.scrollTop = 0;
   q('present-count').textContent = `Slide ${at + 1} of ${count}` + (deck.brief ? ' · section slides only' : '');
   prev.disabled = at === 0;
   next.disabled = at === count - 1;
   for (const b of contents.querySelectorAll<HTMLButtonElement>('[data-slide]')) {
    if (Number(b.dataset.slide) === at) b.setAttribute('aria-current', 'true');
    else b.removeAttribute('aria-current');
   }
   q('present-live').textContent = `Slide ${at + 1} of ${count}: ${slide.title}`;
   moving = true; try { env.show(step ?? slide.step); } finally { moving = false; }
   if (wasTitle) q('present-title').focus({preventScroll: true});
   else if (focused === next && next.disabled) prev.focus(); else if (focused === prev && prev.disabled) next.focus();
   else if (!inDialog(document.activeElement)) q('present-title').focus({preventScroll: true});
  }
  /**
   * Switches between the full deck and the brief deck in place: a step slide becomes its section's slide, and switching back
   * without moving returns to that step. Says which cut and slide are shown, and keeps focus on the switch.
   */
  function setBrief(on: boolean): void {
   if (!deck || !full || !source || on === (deck.brief === true)) return;
   const current = deck.slides[index]!;
   let target = current.id;
   if (on) {
    brief ??= root.LWProcessSlides.build(source.definition, source.snapshot, {brief: true});
    if (current.kind === 'step') target = 'section-' + current.section;
   } else if (left && left.brief === current.id) target = left.full;
   deck = on ? brief! : full;
   renderContents(deck);
   const at = Math.max(0, deck.slides.findIndex(s => s.id === target)), shown = deck.slides[at]!;
   go(at);
   // Remembered only until the brief deck moves (go() forgets it), so switching straight back returns to the step.
   left = on && current.kind === 'step' ? {brief: target, full: current.id} : null;
   const from = on && current.kind === 'step' ? `, the section of “${current.title}”` : '';
   const cutName = on ? 'Section slides only' : 'All slides';
   q('present-live').textContent = `${cutName}: ${deck.slides.length} slides. Slide ${at + 1}: ${shown.title}${from}.`;
   q('present-brief').focus();
  }
  function setContents(open: boolean, focus = true): void {
   contents.hidden = !open;
   main.hidden = open;
   toc.setAttribute('aria-expanded', String(open));
   if (open && focus) {
    const current = contents.querySelector<HTMLElement>('[aria-current="true"]');
    current?.scrollIntoView({block: 'nearest'});
    current?.focus();
   } else if (focus && !open) toc.focus();
  }
  function keydown(e: KeyboardEvent): void {
   if (!opened || e.altKey || e.ctrlKey || e.metaKey) return;
   const target = e.target as Element | null;
   if (e.key === 'Escape') {
    e.preventDefault(); e.stopPropagation(); escapedNow = true; setTimeout(() => { escapedNow = false; }, 0);
    if (!contents.hidden) setContents(false); else close(); return;
   }
   if (e.key === 'Tab') {
    const items = [...dlg.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(n => n.getClientRects().length > 0 && !n.closest('[hidden]'));
    if (!items.length) return;
    const first = items[0]!, last = items.at(-1)!, at = document.activeElement;
    if (e.shiftKey && (at === first || !inDialog(at))) {
     e.preventDefault();
     last.focus();
    } else if (!e.shiftKey && (at === last || !inDialog(at))) {
     e.preventDefault();
     first.focus();
    }
    return;
   }
   // Arrow keys inside the map pan it; they are not slide navigation.
   if (e.key.startsWith('Arrow') && target && env.map.contains(target)) return;
   const to = keyTarget(e, slideKey(e, target));
   if (to === null) return;
   e.preventDefault(); go(to);
  }
  /** The slide a navigation key moves to: a slide-paging step, next, previous, the first or the last; null for any other key. */
  function keyTarget(e: KeyboardEvent, step: 1 | -1 | null): number | null {
   if (step !== null) return index + step;
   if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'n') return index + 1;
   if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'p') return index - 1;
   if (e.key === 'Home') return 0;
   return e.key === 'End' ? Infinity : null;
  }
  /**
   * Space and ArrowDown (Shift+Space and ArrowUp back) page only while the slide itself has focus, and only once the slide cannot
   * scroll further that way, so a long slide still scrolls with the keyboard first. Null leaves the key to the browser.
   */
  function slideKey(e: KeyboardEvent, target: Element | null): 1 | -1 | null {
   const slide = q('present-slide');
   const forward = e.key === 'ArrowDown' || e.key === ' ' && !e.shiftKey, back = e.key === 'ArrowUp' || e.key === ' ' && e.shiftKey;
   if (!target || !slide.contains(target) || !forward && !back) return null;
   const box = slide.getBoundingClientRect();
   if (forward) {
    const atEnd = slide.scrollHeight - slide.clientHeight - slide.scrollTop <= 1;
    return atEnd && box.bottom <= foot.getBoundingClientRect().top + 1 ? 1 : null;
   }
   return slide.scrollTop <= 1 && box.top >= dlg.getBoundingClientRect().top - 1 ? -1 : null;
  }
  dlg.addEventListener('click', e => {
   const t = e.target as HTMLElement, item = t.closest<HTMLButtonElement>('button[data-slide]');
   if (item) { setContents(false, false); go(Number(item.dataset.slide)); q('present-title').focus(); }
   else if (t.closest('#present-brief')) setBrief(deck?.brief !== true);
   else if (t.closest('#present-toc')) setContents(contents.hidden);
   else if (t.closest('#present-exit')) close();
   else if (t.closest('#present-prev')) go(index - 1);
   else if (t.closest('#present-next')) go(index + 1);
  });
  // Escape is handled on keydown; a cancel or close that still arrives (the browser's close watcher) is the same exit intent.
  dlg.addEventListener('cancel', e => { e.preventDefault(); if (!escapedNow) close(); });
  dlg.addEventListener('close', () => { if (opened) close(); });
  /** 'Live facts come from one simulated run at business minute 217 (seed 1, completed).' */
  function runText(live: NonNullable<LWProcessSlides.Deck['live']>): string {
   const text = root.LWProcessSlidesText, status = text.statusText({status: live.status as LWProcess.Snapshot['status']});
   return `Live facts come from one simulated run at business minute ${text.number(live.minute)} (seed ${live.seed}, ${status}).`;
  }
  function open(from: HTMLElement, focusFallback: () => HTMLElement | null): boolean {
   if (opened || root.LWProcessDialog.active()) return false;
   opened = true; invoker = from; fallback = focusFallback; moving = true;
   let view: LWProcessApp.View, draft = false;
   try { const entered = env.enter(); view = entered.view; paused = entered.paused; draft = entered.draft === true; }
   catch (e) { opened = false; throw e; } finally { moving = false; }
   // Entering already paused the run and switched the view: any failure from here on is undone by close(), never left half open.
   try {
    source = {definition: view.definition, snapshot: view.snapshot.minute > 0 ? view.snapshot : null}; brief = null; left = null;
    const d = root.LWProcessSlides.build(source.definition, source.snapshot); deck = d; full = d;
    q('present-process').textContent = d.process.name; q('present-note').hidden = !paused; q('present-draft').hidden = !draft;
    q('present-run').hidden = !d.live; q('present-run').textContent = d.live ? runText(d.live) : '';
    // The studio's status region is inert behind the modal, so the dialog itself describes the pause, the draft and the live facts.
    const described = [paused ? 'present-note' : '', draft ? 'present-draft' : '', d.live ? 'present-run' : ''].filter(Boolean).join(' ');
    if (described) dlg.setAttribute('aria-describedby', described); else dlg.removeAttribute('aria-describedby');
    q('present-map-hint').textContent = matchMedia('(pointer: coarse)').matches
     ? 'Drag to pan · Pinch or + − to zoom · Tap a step to show its slide'
     : 'Drag to pan · Scroll to zoom · Arrow keys pan while the map has focus · Select a step to show its slide';
    renderContents(d); setContents(false, false);
    home = {parent: env.map.parentNode!, next: env.map.nextSibling};
    env.inertRoot.inert = true; document.documentElement.classList.add('pd-locked');
    dlg.showModal(); dlg.scrollTop = 0; q('present-stage').append(env.map);
    document.addEventListener('keydown', keydown);
    const start = view.selected ? d.slides.findIndex(s => s.id === 'step-' + view.selected) : 0;
    go(start < 0 ? 0 : start); (next.disabled ? prev : next).focus();
   } catch (e) { close(); throw e; }
   return true;
  }
  /** Exits: the map returns to its exact place, the studio view is restored, focus returns to the invoker or the fallback. */
  function close(): void {
   if (!opened) return;
   opened = false; document.removeEventListener('keydown', keydown);
   if (home) { home.parent.insertBefore(env.map, home.next && home.next.parentNode === home.parent ? home.next : null); home = null; }
   if (dlg.open) dlg.close();
   env.inertRoot.inert = false; document.documentElement.classList.remove('pd-locked');
   deck = null; full = null; brief = null; source = null; left = null; q('present-slide').innerHTML = ''; contents.innerHTML = '';
   moving = true; try { env.leave(paused); } finally { moving = false; }
   const target = shown(invoker) ? invoker : fallback(); invoker = null; target?.focus();
  }
  return {
   open, close, isOpen: () => opened,
   state: () => opened && deck ? {index, count: deck.slides.length, id: deck.slides[index]!.id} : null,
   follow(selected) {
    if (!opened || moving || !deck || selected === null || deck.slides[index]!.step === selected) return;
    let at = deck.slides.findIndex(s => s.id === 'step-' + selected);
    // The brief deck has no step slides: a step chosen on the map shows the slide of the section that holds it.
    const owner = full?.slides.find(s => s.id === 'step-' + selected)?.section;
    if (at < 0 && deck.brief && owner) {
     at = deck.slides.findIndex(s => s.id === 'section-' + owner);
     if (at >= 0 && at !== index) go(at, true, selected);
     return;
    }
    if (at >= 0) go(at, true);
   },
   dispose() { close(); dlg.remove(); },
  };
 }
 root.LWProcessPresent = {create};
})(globalThis);
