# Small claims

Process `small-claims` · Business process · revision 1 · 18 slides

## 1. Introduction

### Slide 1: Small claims

_Business process_

A small claims desk used to check the slide model. All values are synthetic.

**About the values**

- The description says these values are synthetic or illustrative: they are scenario assumptions, not measurements.

**How to read this deck**

- The overview and resources come first, then the main route phase by phase, then every step off the main route, then a summary.
- Each step slide says what happens, who or what does it, how long it takes, what it needs and delivers, and where the case goes next.

### Slide 2: Overview

_SIPOC: suppliers, inputs, process, outputs and customers_

Business process with 10 steps, 8 of them on the main route. Cases start at “Claim received” and the main route ends at “Claim settled”.

**Suppliers**

- No suppliers authored (add them in Edit process).

**Inputs**

- No arrival data or external needs.

**Process**

- Intake: 1 step
- Decide: 2 steps, with alternative paths
- Payout: 4 steps, in parallel

**Outputs**

- Reached Claim rejected: end of the process
- Reached Claim settled: end of the process

**Customers**

- No customers authored (add them in Edit process).

**How cases arrive**

- 3 cases: every 5 min, first at minute 0.

### Slide 3: Resources

_1 resource pool_

Pools are capacity slots: work starts when its pools have free units, otherwise the case waits in a queue. Costs are simulated units, not money.

**People**

- Claims clerks: capacity 2, cost 1 per minute; used by Check the claim, Supervisor review, Pay the claim.

## 2. Intake

### Slide 4: Intake

_Phase 1 of 3_

2 steps on the main route, from “Claim received” to “Check the claim”.

**In this part**

- Claim received (start)
- Check the claim (task)

**Leaves the main route**

- Check the claim → Supervisor review (deadline path)

### Slide 5: Claim received

_Start · Intake_

No description authored.

**How it works**

- Each case begins here on arrival; no time passes and nobody works on it.

**Where it goes next**

- Next → “Check the claim”

### Slide 6: Check the claim

_Task · Intake_

A clerk checks the claim form.

**Who or what does it**

- Claims clerks (people, capacity 2): 1 unit for each visit.

**How long**

- Takes 10 min.
- Fixed cost: 5 simulated units for each visit; pools add their cost per minute while they work.
- After 15 min of work the deadline interrupts: the work is cancelled and the case takes the deadline path.

**What it delivers**

- Sets checked to true.

**Where it goes next**

- Next → “Pay out?”
- Deadline path → “Supervisor review”

**Concepts**

- Interrupting deadline: An interrupting deadline cancels the work when it runs late and sends the case down the deadline path instead.

## 3. Decide

### Slide 7: Decide

_Phase 2 of 3_

1 step on the main route: “Pay out?”.

**In this part**

- Pay out? (decision)

**Leaves the main route**

- Pay out? → Claim rejected (other end)

### Slide 8: Pay out?

_Decision · Decide_

No description authored.

**How it works**

- Takes no time: the case follows the first route below whose condition holds, checked in order.
- The route without a condition is taken when no other applies.

**Where it goes next**

- 20% of cases take this path → “Claim rejected” (“Not covered”)
- Otherwise (no condition) → “Pay and wait”, main route

**Concepts**

- Decision: A decision takes no time. It checks its routes in order and sends the case along the first one whose condition holds; the route without a condition catches the rest.
- Chance route: A chance route is taken by a share of cases, like a roll of the dice. Every case gets its own draw from the run's seed, so the same seed always repeats the same run.

## 4. Payout

### Slide 9: Payout

_Phase 3 of 3_

5 steps on the main route, from “Pay and wait” to “Claim settled”.

**In this part**

- Pay and wait (parallel fork)
- Pay the claim (task)
- Cooling-off period (timer)
- Paid and closed (join)
- Claim settled (end)

### Slide 10: Pay and wait

_Parallel fork · Payout_

No description authored.

**How it works**

- Parallel fork: starts every branch at once, and its join waits for all of them.
- Its join is “Paid and closed”.

**Where it goes next**

- Branch → “Pay the claim”
- Branch → “Cooling-off period”

**Concepts**

- Parallel fork: A parallel fork starts all of its branches at the same moment. The case continues only when every branch has reached the join.

### Slide 11: Pay the claim

_Task · Payout_

No description authored.

**Who or what does it**

- Claims clerks (people, capacity 2): 1 unit for each visit.

**How long**

- Takes 4 min.

**What it delivers**

- Sets paid to true.

**Where it goes next**

- Next → “Paid and closed”

### Slide 12: Cooling-off period

_Timer · Payout_

No description authored.

**How it works**

- Waits 30 min.
- Nobody works on it and no capacity is used.

**Where it goes next**

- Next → “Paid and closed”

**Concepts**

- Timer: A timer only waits: nobody works and no capacity is used, so any number of cases can wait at the same time.

### Slide 13: Paid and closed

_Join · Payout_

No description authored.

**How it works**

- Waits until the branches started by “Pay and wait” have arrived, then continues as one case.

**Where it goes next**

- Next → “Claim settled”

**Concepts**

- Join: A join collects the branches started by its fork and lets the case continue once they have all arrived.

### Slide 14: Claim settled

_End · Payout_

No description authored.

**How it works**

- The case finishes here.

## 5. Variants and other paths

### Slide 15: Variants and other paths

_2 steps off the main route_

These steps are reached only through a decision alternative, a branch, a deadline or another end; each slide says how.

**Off the main route**

- Supervisor review: deadline path from “Check the claim”
- Claim rejected: other end from “Pay out?”

### Slide 16: Supervisor review

_Task · Deadline path from “Check the claim”_

No description authored.

**Who or what does it**

- Claims clerks (people, capacity 2): 1 unit for each visit.

**How long**

- Takes 5 min.

**What it delivers**

- Sets checked to true.

**Where it goes next**

- Next → “Pay out?”

### Slide 17: Claim rejected

_End · Other end from “Pay out?”_

No description authored.

**How it works**

- The case finishes here.

## 6. Summary

### Slide 18: Summary

_Small claims_

10 steps in 3 phases, 1 resource pool and 2 steps off the main route.

**Steps by kind**

- 1 start step
- 3 tasks
- 1 timer
- 1 decision
- 1 fork
- 1 join
- 2 end steps

**Structure**

- Main route: 8 steps.
- Off the main route: 2 steps.
- Arrival rules: 1.
- Seed: 3.

**Try in the studio**

- Choose Run simulation and watch cases move along the main route; pause and select a step to inspect it.
- Open the SIPOC view to see the same process as suppliers, inputs, stages, outputs and customers.
- Change a pool's capacity in Edit process and compare waiting time, cost and cycle time.
- Change a decision's condition or chance and watch how many cases take each route.
- Change the seed to see another run; the same seed always repeats the same run.
- From the command line: wildlands process run for a bounded run, or process slides --minutes N for these slides with live facts.
