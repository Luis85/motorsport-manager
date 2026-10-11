/// <reference path="./process-contracts.d.ts" />
/**
 * Detached slide deck that explains one process definition step by step (LWProcessSlides, process-slides.ts). Every string is
 * plain text, never HTML. The deck is derived from the definition only; live facts appear only when a snapshot is passed and
 * describe that one simulated run. The deck never shares object references with its inputs.
 * A brief deck (`build(definition, snapshot, {brief: true})`) is the executive cut: the title (lead and Key results), the overview,
 * the resources slide, one section slide per section (its step list and the paths leaving the main route) and the summary, without
 * the individual step slides; every step is still named on exactly one section slide.
 */
declare namespace LWProcessSlides {
 type Kind = 'title' | 'overview' | 'resources' | 'section' | 'step' | 'summary';
 /** A heading with plain-text bullet items. */
 interface Block { heading: string; items: string[] }
 /**
  * One short explainer of a construct a step uses. `id` is one of 'touchpoint', 'machine-step', 'system-step', 'timer', 'decision',
  * 'chance-route', 'counter-loop', 'parallel-fork', 'inclusive-gateway', 'join', 'multi-instance-parallel', 'multi-instance-sequential',
  * 'deadline-escalate', 'deadline-interrupt' or 'backlog', in that order.
  */
 interface Concept { id: string; name: string; text: string }
 interface Slide {
  /** Stable: 'title', 'overview', 'resources', 'section-<sectionId>', 'step-<stepId>', 'summary'. */
  id: string;
  kind: Kind;
  /** Owning section id. */
  section: string;
  title: string; subtitle: string; lead: string;
  blocks: Block[]; concepts: Concept[];
  /**
   * Read-only facts of one simulated run; only when a snapshot was passed (heading names the business minute and seed). The title
   * slide carries 'Key results', the resources slide (when pools exist) the pool utilisation, step slides their counters and the
   * summary the run totals; the overview and section slides carry none.
   */
  live: Block | null;
  /** Step the map should show: the step of a step slide, the first step of a phase or main-route section slide; null shows the whole process. */
  step: string | null;
 }
 /** Section ids: 'intro', 'phase-<n>' (1-based, one per main-route phase), 'route' (no phases), 'variants', 'summary'. */
 interface Section { id: string; title: string; kind: 'intro' | 'phase' | 'route' | 'variants' | 'summary'; first: number; count: number }
 interface Deck {
  format: 'wildlands-process-slides'; schemaVersion: 1;
  process: {id: string; name: string; genre: string; revision: number};
  /** Present (true) only on a brief deck; a full deck has no `brief` key, so its JSON is unchanged. */
  brief?: true;
  live: {minute: number; seed: number; status: string} | null;
  sections: Section[]; slides: Slide[];
 }
 interface BuildOptions {
  /** The brief deck: section slides only, no step slides (see the header). */
  brief?: boolean;
 }
 interface Api {
  /** Builds the deck; never mutates its inputs and returns fresh values only. */
  build(definition: LWProcess.Definition, snapshot?: LWProcess.Snapshot | null, options?: BuildOptions): Deck;
  /** Readable Markdown of a deck for agents and documents; deterministic, ends with a newline. */
  markdown(deck: Deck): string;
 }
}
