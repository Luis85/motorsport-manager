# Agency delivery lab

This game holds six synthetic processes (`content.definitions`), switchable in
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
end in goal and lost outcomes, so the snapshot reports conversion. Both journeys
are scenario models with invented numbers, not research data, measured conversion
or a forecast, and neither has scene assets. The sixth,
`content/loan-application.process.json`, is a loan application converted from BPMN 2.0
(see below). None of them models a real company, warehouse, bank or
vendor; all values are authored, illustrative and synthetic, and the automated steps
are simulated assumptions, not integrations. Switching restarts the chosen process
paused at minute 0; Download HTML keeps all six with your edits.

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
1 SLA escalation, simulated cost 2414). Step descriptions name the BPMN construct and
BPSim value behind each step.

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
are ignored (the bureau is a SIPOC supplier and customer). Every simulated value (durations,
distributions, probabilities, conditions, pools, costs, arrivals) is exactly as imported, and
a seed-7 run gives the same numbers as the example's documented run. Only descriptive data
was edited afterwards: the id `loan-application`, the name, the process and step
descriptions, `seed` 7, step `phase` labels for the steps outside the sub-process and call
activity (Application, Credit decision, Contract and payout, so the SIPOC view groups the
route correctly), the applicant and supervisor in the SIPOC, and the scene positions, laid
out on the left-to-right grid of the other processes because the BPMN diagram coordinates
overlapped and placed the inlined fraud steps at the callee's separate diagram. Each step
has a scene marker and, like every process here except the agency pipeline, no scene asset. All durations,
probabilities, amounts, capacities and costs are the example file's synthetic assumptions,
not a real bank, measured behaviour or a forecast.

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

Open `demos/agency-delivery.html` in a browser; use Run simulation, 2D/3D,
and Step scenes. Every file is embedded and the demo runs offline.

[Contract](../../reference/business-process-engine.md) ·
[Agent workflow](../../how-to/business-process-authoring.md).
