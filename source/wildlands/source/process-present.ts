/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-slides-contracts.d.ts" />
/**
 * Present mode of Process Studio (LWProcessPresent): a full-window native `<dialog id="present">` that shows the slide deck of the
 * ACTIVE definition (LWProcessSlides.build; never the unapplied draft) beside the studio's own 2D map.
 *  - The deck is built once on open from the detached view. The snapshot is passed only past minute 0, so live facts are labelled
 *    by the model as one simulated run. Every model string is plain text and is escaped here.
 *  - The map is the studio's single LWProcess2D host element (`#map`). It MOVES into the map pane on open and back to its exact
 *    position on exit; there is never a second renderer. Each slide shows its step's scene (or the whole map) through the studio's
 *    selection command (`env.show`), and choosing a step on the map moves the deck to that step's slide (`follow`).
 *  - It never ticks: `env.enter` pauses a playing run with a command and nothing resumes on exit. The studio root is inert while
 *    presenting, and it does not open while an LWProcessDialog is open.
 *  - Keys: ArrowRight/PageDown next, ArrowLeft/PageUp previous, Home first, End last (arrow keys inside the map pan it instead);
 *    Escape closes the contents list when it is open, otherwise exits and returns focus to the invoker (or the fallback).
 * Ids: present, present-title, present-count, present-toc, present-exit, present-contents, present-prev, present-next, present-live.
 */
declare namespace LWProcessPresent {
 interface State {index: number; count: number; id: string}
 interface Env {
  /** The studio root, inert while presenting. */
  inertRoot: HTMLElement;
  /** The studio's one 2D map host; it moves into the presentation and back. */
  map: HTMLElement;
  /** Prepares the studio (pauses a playing run with a command, 2D view) and returns the detached view to present. Never ticks. */
  enter(): {view: LWProcessApp.View; paused: boolean};
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
 const root = inputRoot as {LWProcessPresent?: LWProcessPresent.Api; LWProcessSlides: LWProcessSlides.Api; LWProcessDialog: LWProcessDialog.Api};
 const esc = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
 const FOCUSABLE = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])';
 const shown = (n: HTMLElement | null): n is HTMLElement => !!n && n.isConnected && n.getClientRects().length > 0 && !(n as HTMLButtonElement).disabled;
 const list = (b: LWProcessSlides.Block) => `<ul>${b.items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`;
 /** One slide as escaped markup: kicker, title, subtitle, lead, headed lists, one aside per concept and the live facts aside. */
 function slideHtml(s: LWProcessSlides.Slide, section: string): string {
  const concepts = s.concepts.map((c, i) => `<aside class="present-concept" aria-labelledby="present-concept-${i}"><p class="present-tag">Concept</p><h3 id="present-concept-${i}">${esc(c.name)}</h3><p>${esc(c.text)}</p></aside>`).join('');
  const live = s.live ? `<aside class="present-facts" aria-labelledby="present-facts-title"><h3 id="present-facts-title">${esc(s.live.heading)}</h3>${list(s.live)}</aside>` : '';
  return `<div class="present-body"><p class="present-kicker">${esc(section)}</p><h2 id="present-title" tabindex="-1">${esc(s.title)}</h2>`
   + (s.subtitle ? `<p class="present-subtitle">${esc(s.subtitle)}</p>` : '') + (s.lead ? `<p class="present-lead">${esc(s.lead)}</p>` : '')
   + s.blocks.map(b => `<section class="present-block"><h3>${esc(b.heading)}</h3>${list(b)}</section>`).join('') + concepts + live + '</div>';
 }
 function create(host: HTMLElement, env: LWProcessPresent.Env): LWProcessPresent.Surface {
  const dlg = document.createElement('dialog');
  dlg.id = 'present'; dlg.className = 'present'; dlg.setAttribute('aria-labelledby', 'present-title');
  dlg.innerHTML = `<header class="present-head"><div class="present-heading"><p id="present-process" class="present-process"></p>
   <p id="present-count" class="present-meta"></p><p id="present-run" class="present-run" hidden></p><p id="present-note" class="present-note" hidden>The run is paused while you present.</p></div>
   <div class="present-actions"><button type="button" id="present-toc" aria-expanded="false" aria-controls="present-contents">Contents</button><button type="button" id="present-exit">Exit</button></div></header>
   <nav id="present-contents" class="present-contents" aria-label="Slides" hidden></nav>
   <div class="present-main"><article id="present-slide" class="present-slide" aria-labelledby="present-title" tabindex="0"></article>
   <section class="present-map" aria-label="Process map"><div id="present-stage" class="present-stage"></div><p id="present-map-hint" class="present-map-hint"></p></section></div>
   <footer class="present-foot"><button type="button" id="present-prev">Previous</button><button type="button" id="present-next" class="primary">Next</button></footer>
   <div id="present-live" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>`;
  host.append(dlg);
  const q = <T extends HTMLElement = HTMLElement>(id: string) => dlg.querySelector<T>('#' + id)!;
  const main = dlg.querySelector<HTMLElement>('.present-main')!, contents = q('present-contents'), toc = q<HTMLButtonElement>('present-toc');
  const prev = q<HTMLButtonElement>('present-prev'), next = q<HTMLButtonElement>('present-next');
  let deck: LWProcessSlides.Deck | null = null, index = 0, opened = false, moving = false, paused = false, escapedNow = false;
  let invoker: HTMLElement | null = null, fallback: () => HTMLElement | null = () => null, home: {parent: Node; next: Node | null} | null = null;
  const sectionOf = (i: number) => deck!.sections.find(s => i >= s.first && i < s.first + s.count);
  const inDialog = (n: Element | null) => !!n && n !== document.body && dlg.contains(n);
  function renderContents(d: LWProcessSlides.Deck): void {
   contents.innerHTML = `<h2 class="present-contents-title">Contents</h2><div class="present-groups">` + d.sections.map((s, g) => `<section class="present-group" aria-labelledby="present-group-${g}"><h3 id="present-group-${g}">${esc(s.title)}</h3><ol start="${s.first + 1}">`
    + d.slides.slice(s.first, s.first + s.count).map((slide, j) => `<li><button type="button" data-slide="${s.first + j}"><span class="present-num" aria-hidden="true">${s.first + j + 1}</span><span>${esc(slide.title)}</span></button></li>`).join('') + '</ol></section>').join('') + '</div>';
  }
  /** Shows slide `i`: text, counters, contents marker, the announcement and the map scene. Focus that the change removed returns to the slide title. */
  function go(i: number, fromMap = false): void {
   if (!deck) return;
   const at = Math.max(0, Math.min(deck.slides.length - 1, i)), slide = deck.slides[at]!, section = sectionOf(at)?.title ?? '', count = deck.slides.length;
   const focused = document.activeElement as HTMLElement | null, wasTitle = focused?.id === 'present-title';
   index = at; q('present-slide').innerHTML = slideHtml(slide, section); q('present-slide').scrollTop = 0; if (!fromMap) dlg.scrollTop = 0;
   q('present-count').textContent = `Slide ${at + 1} of ${count}`;
   prev.disabled = at === 0; next.disabled = at === count - 1;
   for (const b of contents.querySelectorAll<HTMLButtonElement>('[data-slide]')) { if (Number(b.dataset.slide) === at) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }
   q('present-live').textContent = `Slide ${at + 1} of ${count}: ${slide.title}`;
   moving = true; try { env.show(slide.step); } finally { moving = false; }
   if (wasTitle) q('present-title').focus({preventScroll: true});
   else if (focused === next && next.disabled) prev.focus(); else if (focused === prev && prev.disabled) next.focus();
   else if (!inDialog(document.activeElement)) q('present-title').focus({preventScroll: true});
  }
  function setContents(open: boolean, focus = true): void {
   contents.hidden = !open; main.hidden = open; toc.setAttribute('aria-expanded', String(open));
   if (open && focus) { const current = contents.querySelector<HTMLElement>('[aria-current="true"]'); current?.scrollIntoView({block: 'nearest'}); current?.focus(); }
   else if (focus && !open) toc.focus();
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
    if (!items.length) return; const first = items[0]!, last = items.at(-1)!, at = document.activeElement;
    if (e.shiftKey && (at === first || !inDialog(at))) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && (at === last || !inDialog(at))) { e.preventDefault(); first.focus(); }
    return;
   }
   // Arrow keys inside the map pan it; they are not slide navigation.
   if (e.key.startsWith('Arrow') && target && env.map.contains(target)) return;
   const to = e.key === 'ArrowRight' || e.key === 'PageDown' ? index + 1 : e.key === 'ArrowLeft' || e.key === 'PageUp' ? index - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? Infinity : null;
   if (to === null) return;
   e.preventDefault(); go(to);
  }
  dlg.addEventListener('click', e => {
   const t = e.target as HTMLElement, item = t.closest<HTMLButtonElement>('button[data-slide]');
   if (item) { setContents(false, false); go(Number(item.dataset.slide)); q('present-title').focus(); }
   else if (t.closest('#present-toc')) setContents(contents.hidden);
   else if (t.closest('#present-exit')) close();
   else if (t.closest('#present-prev')) go(index - 1);
   else if (t.closest('#present-next')) go(index + 1);
  });
  // Escape is handled on keydown; a cancel or close that still arrives (the browser's close watcher) is the same exit intent.
  dlg.addEventListener('cancel', e => { e.preventDefault(); if (!escapedNow) close(); });
  dlg.addEventListener('close', () => { if (opened) close(); });
  function open(from: HTMLElement, focusFallback: () => HTMLElement | null): boolean {
   if (opened || root.LWProcessDialog.active()) return false;
   opened = true; invoker = from; fallback = focusFallback; moving = true;
   let view: LWProcessApp.View;
   try { const entered = env.enter(); view = entered.view; paused = entered.paused; } catch (e) { opened = false; throw e; } finally { moving = false; }
   const d = root.LWProcessSlides.build(view.definition, view.snapshot.minute > 0 ? view.snapshot : null); deck = d;
   q('present-process').textContent = d.process.name; q('present-note').hidden = !paused;
   q('present-run').hidden = !d.live; q('present-run').textContent = d.live ? `Live facts come from one simulated run at minute ${d.live.minute.toLocaleString()} (seed ${d.live.seed}).` : '';
   q('present-map-hint').textContent = matchMedia('(pointer: coarse)').matches ? 'Drag to pan · Pinch or + − to zoom · Tap a step to show its slide' : 'Drag to pan · Scroll to zoom · Arrow keys pan while the map has focus · Select a step to show its slide';
   renderContents(d); setContents(false, false);
   home = {parent: env.map.parentNode!, next: env.map.nextSibling};
   env.inertRoot.inert = true; document.documentElement.classList.add('pd-locked');
   dlg.showModal(); dlg.scrollTop = 0; q('present-stage').append(env.map);
   document.addEventListener('keydown', keydown);
   const start = view.selected ? d.slides.findIndex(s => s.id === 'step-' + view.selected) : 0;
   go(start < 0 ? 0 : start); (next.disabled ? prev : next).focus();
   return true;
  }
  /** Exits: the map returns to its exact place, the studio view is restored, focus returns to the invoker or the fallback. */
  function close(): void {
   if (!opened) return;
   opened = false; document.removeEventListener('keydown', keydown);
   if (home) { home.parent.insertBefore(env.map, home.next && home.next.parentNode === home.parent ? home.next : null); home = null; }
   if (dlg.open) dlg.close();
   env.inertRoot.inert = false; document.documentElement.classList.remove('pd-locked');
   deck = null; q('present-slide').innerHTML = ''; contents.innerHTML = '';
   moving = true; try { env.leave(paused); } finally { moving = false; }
   const target = shown(invoker) ? invoker : fallback(); invoker = null; target?.focus();
  }
  return {
   open, close, isOpen: () => opened,
   state: () => opened && deck ? {index, count: deck.slides.length, id: deck.slides[index]!.id} : null,
   follow(selected) {
    if (!opened || moving || !deck || selected === null || deck.slides[index]!.step === selected) return;
    const at = deck.slides.findIndex(s => s.id === 'step-' + selected); if (at >= 0) go(at, true);
   },
   dispose() { close(); dlg.remove(); },
  };
 }
 root.LWProcessPresent = {create};
})(globalThis);
