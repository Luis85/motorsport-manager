# Agency delivery lab

This game holds seven synthetic processes (`content.definitions`), switchable in
the studio with the **Process** selector: the agency pipeline below, first and
initially active; `content/agile-vendor.process.json`, a vendor running an agile
project (an absolute contractual kickoff-date timer, then a release loop built from
counters: per-project iterations per release and releases, iteration and increment
counters, a customer review-window timer, UAT with one bounded fix loop, release
go-live and handover; a customer product owner and experts take part). CI/CD runs
there as automated `system` steps (CI build after each iteration, a regression
suite before UAT, automated deployment after go-live) on software pools, so they
occupy no people; and `content/order-fulfilment.process.json`, an order fulfilment
line with software systems (order validation, fraud scoring, documents,
notifications), `machine` steps (picking robots, packing line, label applicator),
a human spot-check and a bounded repack loop. Orders arrive as a steady open stream with random gaps (seed 20260607), a drawn
priority and a 12% chance of a defect; picking, packing and the spot-check take random
minutes, and a further 6% chance route sends a parcel to repack. It is meant to run
unlimited; three packing lanes run at roughly three quarters of capacity. `content/customer-journey-webshop.process.json` is a customer journey through an online
shop (seed 20261001): shoppers arrive as a steady open stream (exponential gap, mean 3 minutes),
draw an intent (60% browser, 40% buyer) and pass around twenty steps grouped
in five phases (Awareness, Consideration, Purchase, Delivery, After-sales and loyalty)
with channel, emotion, pain and opportunity notes. Chance routes model leaving
without buying, cart abandonment, a failed payment that goes to support chat, a
return call and repeat buying; sentiment is a counter that the tracked curve
reports. `content/user-journey-app-onboarding.process.json` is a user journey
through app onboarding (seed 20261002): new users arrive with a uniform gap,
draw a source and a device, and meet a verification system step, timers (the email
link, day 1 and weekly waits; one day is compressed to about 20 minutes), a
sessions counter that bounds the weekly loop, and chance routes for form
abandonment, permission denial, the tour, churn after day 1 and an upgrade. Both
end in goal and lost outcomes, so the snapshot reports conversion. Every journey step
has a one-to-three-sentence `description`, so each Present slide says what happens; they
were added to the steps that had none with one guarded `putStep` edit per journey (revision
0 to 1, `process diff` reports only changed steps), which changes no run. Both journeys
are scenario models with invented numbers, not research data, measured conversion
or a forecast, and neither has scene assets. The sixth,
`content/loan-application.process.json`, is a loan application converted from BPMN 2.0
(see below), and the seventh, `content/delivery-release.process.json`, is a product
team's weekly delivery cadence and release train (see below). None of them models a
real company, warehouse, bank, vendor or team; all values are authored, illustrative and synthetic, and the automated steps
are simulated assumptions, not integrations. Switching restarts the chosen process
paused at minute 0; Download HTML keeps all seven with your edits.

## Loan application converted from BPMN

`content/loan-application.process.json` shows what the engine simulates from a foreign
BPMN model: three documents verified in parallel (a multi-instance task inside the embedded
sub-process **Document check**), the call activity **Fraud screening** inlined as its own
phase, a risk decision with chance routes, an inclusive gateway (**Additional checks**:
income verification for amounts over 20,000 and an employer check for customers under two
years or amounts over 40,000; both, one or neither) and a non-interrupting 90-minute SLA
on **Manual review** that spawns an escalation to the supervisor while the review continues.
Applications arrive with an exponential gap (mean 30 minutes) until minute 960, each
drawing a whole amount and customer years, so the run completes by itself shortly after
(at minute 984 with the definition seed 7: 32 applications, 31 paid out, 1 rejected,
conversion 96.9%, 1 SLA escalation, work cost 2414, the bank-clerk pool 31% utilised;
with seed 8 at minute 1104: 34 applications, 31 paid out, 3 rejected, conversion 91.2%,
work cost 3301). Step descriptions name the BPMN construct and BPSim value behind each
step.

The applicant is the case, not a capacity. **Submit application** and **Sign contract**,
the user tasks of the BPMN customer lane, are `touchpoint` steps (channels Website and
Documents and forms) with their BPSim times and no pool: they take the applicant's time,
never queue and add no utilisation or capacity cost. A touchpoint with `timing` is the
engine's recipe for time spent by the case itself; a `timer` would say the same about
time, but these are interactions with the bank, which is what a touchpoint means. The end
steps declare outcomes: **Loan paid out** is a `goal` and **Application rejected** is
`lost` (drawn in the lost-end colour), so a run reports goals, lost applications and
conversion. **SLA breach logged** declares none: it ends the escalation token while the
application carries on to its own end, and the engine never counts an escalation end's
outcome, so an outcome there would promise a count that cannot happen.

The SIPOC **Process** column and the journey map follow the definition's main route: from
the start, the first flow without a condition at each step (never a deadline flow). For
this loan that route runs through high risk, **Manual review** and **Send rejection
letter** to **Application rejected**, although 31 of the 32 seed-7 applications are paid
out. This is deliberate. The BPMN gateways name no default flow, so the import makes the
last flow of each gateway the unconditional fallback (high risk, rejected) and chains the
others as chances; the main route is that chain of defaults, not the most frequent path.
The defaults are kept as imported because a swap cannot keep the run: every chance route
draws a random number keyed by its own flow id, so making approval the default (rejected
as a 30% chance) gives the same shares but other cases (seed 7: 30 paid out and 2
rejected), and making low risk the default as well needs other whole-percent chances
(medium 30%, then 36% of the rest high) and changes the run (seed 7: 7 manual reviews, 3
SLA escalations, work cost 3229). It would also stop the definition matching a
default import of the example file. Read the paid-out path from the end steps and their
counts in the **Outputs** column, and the branch shares from the step counts.

Provenance: converted from
[`source/wildlands/examples/bpmn/loan-application.bpmn`](../../../source/wildlands/examples/bpmn/README.md)
and its BPSim scenario `Scenario_Base` with

```sh
bin/wildlands process import-bpmn --input source/wildlands/examples/bpmn/loan-application.bpmn --output loan.json --report loan-report.json
```

using the default options (lanes as pools, default capacity 1, system capacity 4,
default duration 5, 480 minutes per day, `--unsupported reject`, BPSim on). The import
reports no rejections and eight warnings, all kept as imported: the 30-second fraud rules
round up to 1 minute; the unsupported lognormal time of **Notify supervisor** keeps the
default 5 minutes (the "1 task had no duration" warning is the same step); BPSim
replications are ignored (vary the seed instead); the merge gateway is folded into its
flows; the risk probabilities 0.45/0.30/0.25 become chained whole-percent chances (45%,
then 55% of the rest, the rest the default: 30.25% and 24.75%); six service-type tasks run
as automated `system` steps that execute nothing; and the message flows to the credit bureau
are ignored (the bureau is a SIPOC supplier and customer). The import also turns the
Customer lane into a 50-slot people pool. Descriptive data was then edited: the id
`loan-application`, the name, the process and step descriptions, `seed` 7, step `phase`
labels for the steps outside the sub-process and call activity (Application, Credit
decision, Contract and payout, so the SIPOC view groups the route correctly), the applicant
and supervisor in the SIPOC, and the scene positions, laid out on the left-to-right grid of
the other processes because the BPMN diagram coordinates overlapped and placed the inlined
fraud steps at the callee's separate diagram (revision 0, fingerprint `7054f46b249415d1`).

Two guarded `process edit` revisions then changed the model (revision 0 to 2, fingerprint
`221bcc4d80ed5e55`; `process diff` reports nothing else): revision 1 made **Submit
application** and **Sign contract** pool-free touchpoints and removed the Customer pool,
which only inflated capacity and utilisation (it was about 1% busy); revision 2 gave the
ends their outcomes, coloured the lost end, and rewrote the end and process descriptions
to say so. Every simulated time, distribution, probability, condition, cost and arrival is
still exactly as imported, and both seeds give the same cases, step counts, cost and cycle
time as before the edits; only the Customer pool's line has gone from the resources, and
the goal, lost and conversion counts are new. The definition validates strictly. Each step
has a scene marker and, like every process here except the agency pipeline, no scene asset.

BPMN results: `process export-bpmn`, with and without `--bpsim`, gives files that
`process validate-bpmn` reports as conforming (no errors), and importing either back gives
the same fingerprint. The touchpoints export as BPMN user tasks that the Wildlands
extension marks as touchpoints, and the outcomes as extension attributes on plain end
events; the export's only fidelity note with BPSim is that the system kinds of the Credit
engine and Automation pools exist only in the extension. The 30-slide deck keeps its
seven sections and titles. All durations, probabilities, amounts, capacities and costs
are the example file's synthetic assumptions, and the seeded runs are illustrations, not
a real bank, measured behaviour or a forecast.

## Weekly delivery and release train

`content/delivery-release.process.json` models how one product team delivers: a weekly
cadence of backlog refinement, iteration planning, daily stand-ups, review and
retrospective that feeds a release lifecycle shipping one small increment every week.
One case is one product. It starts with an inception (vision, MVP scope, first backlog)
and a Hello World walking skeleton released as **0.1.0**; then every weekly iteration is
released as the next minor version **0.x.0** (the `increments` counter is the minor
version) until the MVP scope is released, and the MVP launches as **1.0.0**. It shows:

- **Shared staff and queues.** Six pools (product owner, delivery lead, three developers,
  UX designer, two stakeholders, CI/CD runners) serve every ceremony and the build. Planning
  commits 3 to 5 items and the build runs one developer per item, so a fourth or fifth item
  waits in the queue.
- **Multi-instance work, both modes.** **Implement the committed items** runs one item per
  committed backlog item in parallel (`instances.field: plannedItems`); **Daily stand-up and
  iteration day** runs four iteration days one after another, each opening with the
  15-minute stand-up. A day occupies no pool, so the developers stay free for the build; its
  fixed cost stands for the stand-up time. The iteration closes at a join when both are done.
- **An escalating deadline.** An item still in progress after three working days (1,440
  minutes) escalates to the daily stand-up: **Raise the impediment and swarm** runs on its
  own route to **Impediment handled** while the item keeps being built.
- **A decision with a random share.** After the weekly review, 30% of the feedback asks for
  something new: **Add the feedback to the MVP backlog** adds one increment to the MVP scope
  (`mvpIncrements`, drawn as 6 to 8 when the product arrives); the rest fits the plan.
- **An inclusive gateway.** Before each weekly release, **Release checks needed?** adds a
  UX acceptance when the increment changed the user interface (60%, drawn at planning), a
  data-migration rehearsal when it changed stored data (25%), both, or neither (the default
  path goes straight to the release candidate).
- **Counters and a bounded loop.** Planning counts iterations; the release pipeline counts
  increments; **MVP scope released?** starts the next week while `increments` is below
  `mvpIncrements`.
- **Software systems.** CI (build, test and merge) and both release pipelines are automated
  `system` steps on the CI/CD pool; they execute nothing.
- **BPSim arrivals and a SIPOC.** One product arrives at minute 0 (a BPSim `TriggerCount`
  of 1 in the export) and draws its MVP scope; the SIPOC names stakeholders, the product
  owner, users and support and the platform team as suppliers, and stakeholders, end users
  and operations as customers. Steps carry six phases from **Inception (0.1.0)** to
  **MVP 1.0.0**, which group the SIPOC view.

Time is in business minutes with 480 per working day, so one iteration (refinement,
planning, four iteration days, review, retrospective and release) takes about a working
week. With the definition seed 7 the run completes at minute 19,007 (about eight working
weeks): eight weekly iterations after 0.1.0, so 0.2.0 to 0.9.0 and then 1.0.0; feedback
added one increment to the drawn scope of eight; 30 items built (one escalation), three UX
acceptances and four migration rehearsals; work cost 119,928 (the capacity cost, which also
charges idle pool time, is 361,133). Other seeds take from 5 to 16 iterations.

Provenance: written for this lab from a plain-language description of a team's delivery
process (weekly refinement, planning, dailies, review and retro; continuous small releases
from a 0.1.0 skeleton to a 1.0.0 MVP based on stakeholder feedback); it is not converted
from BPMN and does not describe a specific company. It was authored with the guarded CLI:
`process create`, then a revision- and fingerprint-guarded `process edit` (dry run first)
with every pool, step, flow and the arrival, then `process validate` and `process run`. The
description, `seed` 7 and the SIPOC were then added to the JSON directly, because the edit
vocabulary had no operation for them at the time (the studio's **Edit process…** writes the
same fields); the guarded `setDescription`, `setSeed` and `setSipoc` operations added since
make this unnecessary, so do not copy that step. A second guarded edit (revision 1 to 2) dropped the counters' zero starting values
from the arrival data, so the SIPOC lists only the drawn MVP scope as an input, and labelled
that need on **MVP scope released?**; the run is unchanged. The result validates strictly. Each step has a scene marker and no scene asset. It
exports to BPMN with and without BPSim; both exports pass `bin/wildlands process
validate-bpmn` and re-import to the same fingerprint. The BPSim export also carries the seed and
the drawn MVP scope as a start-event property, so a tool without the Wildlands extension repeats
the arrival; its `fidelity` notes name what stays extension-only (the case fields and counters the
steps write, needs and declared outputs, and the CI/CD pool kind). All durations, costs, capacities and
probabilities are synthetic illustrative assumptions, not measured team performance, a
delivery plan or a forecast.

The agency process is a synthetic agency process demonstrating step scenes, parallel product/technical design
(business analysts and requirements engineers), a prioritised Ready to build backlog
that developers pull from, declared step needs and deliveries, shared capacity, queues,
QA rework and client handover. Timing and cost values are
authored examples, not measured agency performance. Scene assets are original
Scene Forge recipes generated by the process bridge and compiled by Scene Forge.

Build from the repository root:

```sh
bin/wildlands validate-game --game docs/concepts/agency-delivery
bin/wildlands build-game --game docs/concepts/agency-delivery --output demos/agency-delivery.html
```

The business processes and journeys also carry a descriptive `sipoc` (suppliers and customers) and, for the
business processes, step `phase` labels that group the SIPOC view; neither affects a run.

Open `demos/agency-delivery.html` in a browser; use **Run simulation**, **2D**/**3D**, the
SIPOC or journey lens, **Step scenes**, and **Present** to walk through a process as slides
beside its map ([Present a process to stakeholders](../../how-to/present-a-process.md)). For
the release train, which runs for about 19,000 business minutes, choose **Speed** 2 h or 24 h and
a **Run until** of 720 h. Every file is embedded and the demo runs offline. The
studio tunes these processes (including where each step's paths lead) but cannot add steps or
create a new process; to build your own, follow
[Model your first business process](../../tutorials/first-business-process.md).

[Contract](../../reference/business-process-engine.md) ·
[Agent workflow](../../how-to/business-process-authoring.md) ·
[Tutorial](../../tutorials/first-business-process.md).
