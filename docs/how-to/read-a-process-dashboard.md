# Read a process dashboard

Use the studio's **Dashboard** to answer the questions a process owner asks of a simulated run:
is work flowing, where is the time lost, how predictable is a case, and would a change help. The
Dashboard reads the run you already have; it never advances, pauses or changes it. Every panel,
rule and limit is listed in the [Dashboard reference](../reference/business-process-engine.md#dashboard).

## Before you start

- A built studio: a process game such as `demos/agency-delivery.html`, or your own file from
  `bin/wildlands process build` (see
  [Model your first business process](../tutorials/first-business-process.md)).
- A run past minute 0. At minute 0 the Dashboard says "Minute 0 — nothing has been simulated yet."
  Choose **Run simulation**, **Advance 30 min** or **Run to end** first. For a process with an open
  arrival stream, set a **Run until** length so **Run to end** has an end.
- For a comparison, an unapplied draft with the change you want to judge (for example a shorter
  duration or one more unit in a pool), made with **Edit step…** or **Edit process…** and not yet
  applied.

## Open the Dashboard

Choose **Dashboard** beside the view buttons (on a phone, **⋯** then **Dashboard**). It shows the
active process; choose another process with the **Process** selector and the Dashboard stays open
for it, so you can compare processes one after another. **Fit to view** scrolls back to the top.

On a phone the Dashboard scrolls with the page under the run bar, which stays at the top. Every
section folds under its heading (open by default), and a control you reach with Tab or Shift+Tab, a
heading you jump to and **Fit to view** stop just below the run bar, so nothing you are reading hides
behind it. A wide data table scrolls sideways inside its own panel; the page itself does not.

For a light background (a bright room, a printout of a screenshot), choose **Light theme** in the
**Export ▾** or **⋯** menu. Every chart, table and tooltip follows; the choice ends when you reload the
page.

## 1. Read what the numbers are

The strip at the top names the process, revision, seed, minute and run status, and says what the
numbers are: one simulated run from the authored assumptions and one seed, not measurements and
not a forecast. Read its notes before any chart: they say when lead times leave out cases still in
progress, when older finished cases are counted but not drawn, when an unapplied draft is not
included, and when an open arrival stream has no natural end. A value that cannot be known yet
reads "—" with its reason, never 0.

## 2. Check the key figures

The tiles give **In progress** and **Completed** (each with a sparkline and its trend in words),
**Lead time** (the median and 85th percentile once 10 cases have finished, else the mean; exact
values such as "median 37 min" while the run has finished at most 50,000 cases, otherwise a range such
as "median 20–50 min"), **Oldest
open**, **Busiest pool**, **Cost per completed case**, **Problems** and, when ends declare outcomes,
**Conversion**. A customer or user journey leads with conversion and says **Time to outcome**
instead of lead time.

## 3. See whether work is flowing

Under **Flow over time**, compare the two lines of **Arrivals and finishes**: when arrivals keep
rising faster than finishes, work piles up and lead time grows with it. **Work in progress over
time** shows whether that pile is stable, growing or oscillating, and **Throughput per interval**
whether output is steady (each column is labelled with the minute its interval ends, and a long run
draws the intervals as a line). **Little's law** checks that work in progress, arrival rate and time in
the system agree; it is an exact identity over the measured window, and the conditions for a
stable flow are listed for you to judge.

## 4. Find the bottleneck

Under **Where time goes**:

1. **Lead-time breakdown** splits the finished cases' time into working, waiting for capacity,
   blocked after finishing, in a backlog, on a timer and waiting at a join, with the flow
   efficiency (working time over lead time). A low flow efficiency means most time is waiting.
2. **Waiting by step** ranks the steps by the waiting they hold; the caption names the top one
   ("Pay the claim holds 100% of the waiting." in the tutorial's expense process). Choose a row to
   select that step.
3. **Capacity: pool utilisation** shows each pool's average use, with the units busy now as a tick.
   A pool near full use beside a step with long waits is the likely bottleneck. The shaded 85 to
   100% band marks where queues grow quickly; it is a reading aid, not a target.
4. **Queues over time** shows when a queue started building and whether it drains.

## 5. Check predictability

Under **Lead time and predictability**, read the distribution's 50th, 85th and 95th percentiles (from
10 finished cases) rather than the mean alone: a long tail means some cases take far longer than
typical. The note under the chart says how exact they are. While the run has finished at most 50,000
cases the percentiles are exact ("Percentiles are exact: nearest rank over all 12 finished cases; …")
and the caption gives single values ("The median of 12 finished cases is 30 min, …"); after that, and
for a step's own distributions, they are ranges of histogram bins ("The median … lies in 20–50 min")
and the note says why. Choose a target in the panel's select to see the exact share of finished cases under it;
the target is a choice for this view, not part of the process, and is not saved. **Lead time of
recent finished cases** shows whether recent cases are slower than earlier ones, and **Aging work
in progress** shows which open cases are already older than finished cases usually were at that
step: they are the next late ones.

## 6. Check quality and cost

**Repeat visits** counts work that entered a step again (rework or planned iteration; the
simulation cannot tell which), and **Failures, drops, blocking and deadlines** shows where the
process breaks or overflows. Under **Cost**, **Pool cost: work against idle capacity** shows the
capacity you pay for that sits idle, and **Cost by step and per case** which steps drive the cost.
Costs are simulated cost units, not money.

## 7. Focus on one step

Select a step (a step row in a panel, or the step list) and the four detail sections give way to
**Step focus: <step>**: its counters, its wait, service and age-at-exit distributions (the service
chart marks the authored planning duration), its waiting and working work over time, and what the
author wrote about it. Escape or **Whole process** returns to the whole process.

## 8. Leave out start-up

Every run starts empty, so early figures mix start-up with steady work. In the strip, choose a
later minute in **Measure from minute**. Arrivals, finishes, work in progress, Little's law, the
lead time of cases finished since then, pool utilisation and cost are then measured from that
minute to the last sample and labelled "from minute W to minute E"; distributions and per-case
charts stay whole-run. The choice never changes the run.

## 9. See the spread across seeds

One seed is one possible run. In **What-if: spread across seeds**:

1. Keep **Spread of the applied design**.
2. Set **Runs** (2 to 50; fewer than 10 gives wide intervals), **Minutes per run** (it starts at the
   current minute) and **First seed**. The plan line names the seeds and the simulated minutes
   (at most 1,000,000); **Run seeds** says why it is disabled when a value is out of range.
3. Choose **Run seeds**. The replications run in small slices and never touch your run; **Cancel**
   keeps the results so far.
4. Read each measure's mean, 95% interval and p10 · p50 · p90. Each row has its own scale. The
   interval uses the exact Student t quantile for the number of runs, so it is right for 2 runs as
   for 50. A narrow interval means the seeds agree under these assumptions; it says nothing about
   whether the assumptions are right. If every seed gives the same values, a random process says that
   its draws did not change these measures by that minute (try more minutes), and a process without
   random behaviour says so. With a **Measure from minute** chosen, measures labelled "after minute W"
   leave out each run's first W minutes.

## 10. Compare the draft with the applied design

With an unapplied, valid draft, choose **Applied design versus draft** and **Run seeds**. Both
designs run on the same seeds, so random draws match wherever the designs agree and the difference
shows the change rather than luck. Each measure says, from the draft's side, how much it differs
("Mean cycle (minutes) per run is 27.5 lower with the draft than with the applied design …"), or "No
clear difference …" when the 95% interval of the difference contains 0. Add runs before you read a
small difference as real. If you edit the draft, apply it or change the seed or the measuring
minute afterwards, the results are marked out of date; run them again.

The same analysis runs from the command line with `bin/wildlands process replicate` and
`process compare` (see [Compare designs across seeds](business-process-authoring.md#compare-designs-across-seeds)).

## 11. Export the data

Under **Data and export**, **Download dashboard data (CSV)** saves every panel table and the latest
What-if results as `<process-id>-dashboard-minute-<M>.csv`. Every chart also has its numbers under
**Data table**.

## Honesty notes

- Every figure comes from authored assumptions: durations, capacities, probabilities and costs that
  someone wrote down. A dashboard of a simulated run is not a measurement of a real process, and
  What-if replications are not a forecast.
- Lead time covers finished cases only; cases still in progress are named and left out. Read
  **Oldest open** and **Aging work in progress** beside it.
- Lead-time percentiles are exact while the run has finished at most 50,000 cases and bin ranges
  after that; the note under each chart says which. The 95% intervals use the exact Student t
  quantile, but an interval over a few runs is still wide: treat close calls as close.
- With working hours, lead times and their percentiles count every elapsed minute, nights and
  weekends included, while utilisation counts working minutes only; the notes say so, and the
  lead-time breakdown shows the average time finished cases spent outside working hours.
- Repeat visits may be planned iteration, not defects; the simulation cannot tell them apart.

## Confirm the result

- The clock and the run status in the toolbar are the same before and after you used the
  Dashboard: reading it, choosing a window or a target, and running What-if never advance the run.
- What-if ends with "Replications complete." or "Comparison complete." and its plan line names the
  seeds it used.
