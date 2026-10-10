# Present a process to stakeholders

Walk an audience or a reviewer through a process step by step with its slide deck. The
studio shows the deck beside its own 2D map; the command line writes the same deck as
Markdown or JSON for a review. Both explain the applied definition and, optionally, one
simulated run; neither is a forecast. The deck model and its limits are in the
[slide deck reference](../reference/business-process-engine.md#slide-deck) and the
[Present mode reference](../reference/business-process-engine.md#presentation-limits).

## Before you start

- A built studio: a process game such as `demos/agency-delivery.html`, or your own file
  from `bin/wildlands process build` (see
  [Model your first business process](../tutorials/first-business-process.md)).
- Apply any draft you want to show. Present always shows the **applied** definition, not
  an unapplied draft: if the header chip reads "Unapplied draft · …", open it and choose
  **Apply draft and reset run** first.
- Check that every step has a description. A step without one reads "No description
  authored." on its slide; add one with a guarded `putStep` recipe (see
  [Author and simulate a business process](business-process-authoring.md)).

## Present in the studio

1. **Choose the process.** In a game with several processes, pick it with the **Process**
   selector. Switching starts it paused at minute 0.
2. **Choose a minute for live facts (optional).** At minute 0 the deck explains only the
   definition. To add facts from a run, choose **Run simulation** (and **Pause**), or
   **Advance 30 min**, until the clock shows the minute you want; **Run until** sets where
   a run stops. Times are simulated business minutes and costs are simulated units.
3. **Select a starting step (optional).** If a step is selected when you start, the deck
   opens on that step's slide; otherwise it opens on slide 1.
4. **Open Present.** Choose **Present** beside the view buttons. On a phone (650 px wide or
   less) choose **⋯**, then **Present slides**. A playing run pauses ("The run is paused
   while you present.") and never advances while you present.
5. **Move through the slides.** Use **Next** and **Previous**, the Right and Left arrow
   keys, Page Down and Page Up (most presentation clickers send these), or Home and End.
   Arrow keys inside the map pan the map instead.
6. **Jump.** **Contents** lists every slide by section and marks the current one; choose a
   slide to go there, or press Escape to close the list. Selecting a step on the map moves
   the deck to that step's slide.
7. **Exit.** Choose **Exit** or press Escape. The studio returns to the view and selection
   you had, and the run stays paused until you choose **Run simulation**.

The deck has an introduction (title, overview, resources), one section per main-route
phase, a section for every other path and a summary. A step slide frames its step on the
map, a section slide its first step and the other slides the whole process. Past minute
0 the header adds "Live facts come from one simulated run at minute M (seed S)." and step
and summary slides add the run's counts for that minute and seed.

## Export the deck from the command line

Review the same deck as text, optionally with facts from one fresh bounded run, and keep
the file beside a change for review:

```sh
bin/wildlands process slides --input docs/concepts/agency-delivery/content/agency.process.json --format md --output /tmp/agency-slides.md
bin/wildlands process slides --input docs/concepts/agency-delivery/content/agency.process.json --format md --minutes 240 --seed 7
```

`--format md` without `--output` prints the Markdown itself; with `--output` the command
prints one JSON object naming the file, the slide and section counts and the `live` run
(minute, seed, status). `--minutes N [--seed S]` runs the same bounded run as
`process run`; `--seed` needs `--minutes`. See the
[CLI handbook](../reference/wildlands-cli.md#business-processes) for every option.

Read the Markdown as a learner: every step should say what happens, who or what does it,
how long it takes, what it needs and delivers and where the work goes next.

## Confirm the result

- In the studio, the header reads "Slide n of N", and **Contents** lists every section.
- On a step slide the map frames that step; after **Exit** the run minute is unchanged.
- From the command line, the printed `slides` count matches the deck you reviewed.

For screenshots of the studio and Present mode at a chosen minute (desktop, phone and the
wider DejaVu Sans fallback font, with overflow and console-error reports), run
`npm run process:shots` in `source/wildlands` (see
[Verification suites](../reference/business-process-engine.md#verification-suites)).
Screenshots of a synthetic run are review material, not usability validation.
