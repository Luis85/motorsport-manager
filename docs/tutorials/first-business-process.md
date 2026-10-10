# Model your first business process

This tutorial builds a small expense approval process from nothing, runs it, opens it
in the Process Studio, reads its Dashboard, tunes one step, presents it and exports the result.
It takes about 30 minutes. Every value is a synthetic example.

You create the process with the checked-in `bin/process-studio` command-line tool, so that the whole
structure is one guarded, reviewable change. The studio can build a process too (**New
process…**, **Add step…** and the step editor's **Step structure**; see
[What the studio can and cannot edit](../how-to/business-process-authoring.md#what-the-studio-can-and-cannot-edit)),
and you use it below to tune and compare.
The [process contract](../reference/business-process-engine.md) defines every field used
here; the [authoring guide](../how-to/business-process-authoring.md) covers the tasks this
tutorial only touches.

## Before you start

- A clone of this repository and Node.js 22 or newer on `PATH`. No `npm ci` or build step
  is needed.
- A desktop browser for the studio.
- Run every command from the repository root. The tutorial writes only into
  `/tmp/first-process`.

```sh
mkdir -p /tmp/first-process
bin/process-studio discover
```

`discover` prints the 17 process commands, their limits and the 15 guarded
`editOperations` (for example `putStep`, `putFlow` and `setDescription`).

## 1. Create a starter process

```sh
bin/process-studio create --id expense-approval --name "Expense approval" --output /tmp/first-process/process.json
bin/process-studio inspect --input /tmp/first-process/process.json
```

The starter is runnable: a start step **Intake**, a task **Deliver work** and an end
step **Handover**, joined by the flows `start-work` and `work-end`. `inspect` prints its
`revision` (0) and a 16-character `fingerprint`. Copy the fingerprint: every edit must
name both values, so an edit can never apply to a file that changed since you read it.

## 2. Shape it with one guarded recipe

Save this recipe as `/tmp/first-process/edit.json` and replace
`REPLACE_WITH_INSPECT_FINGERPRINT` with the fingerprint you copied:

```json
{
  "expectedRevision": 0,
  "expectedFingerprint": "REPLACE_WITH_INSPECT_FINGERPRINT",
  "operations": [
    {"op": "removeFlow", "id": "start-work"},
    {"op": "removeFlow", "id": "work-end"},
    {"op": "removeStep", "id": "work"},
    {"op": "putResource", "value": {"id": "approvers", "name": "Approvers", "capacity": 2, "costPerMinute": 1}},
    {"op": "putResource", "value": {"id": "finance", "name": "Finance clerk", "capacity": 1, "costPerMinute": 2}},
    {"op": "putStep", "value": {"id": "start", "name": "Expense claim submitted", "kind": "start", "phase": "Submit",
      "description": "An employee submits an expense claim with its receipt.",
      "scene": {"id": "scene-start", "position": [0, 0], "color": "#77b5a0"}}},
    {"op": "putStep", "value": {"id": "check", "name": "Check the receipt", "kind": "task", "phase": "Review",
      "duration": 10, "resources": {"approvers": 1},
      "description": "An approver compares the receipt with the claimed amount.",
      "scene": {"id": "scene-check", "position": [14, 0], "color": "#ffbb73"}}},
    {"op": "putStep", "value": {"id": "approved", "name": "Receipt clear?", "kind": "decision", "phase": "Review",
      "description": "One claim in five has an unclear receipt and goes back to the employee.",
      "scene": {"id": "scene-approved", "position": [28, 0], "color": "#d6a2ce"}}},
    {"op": "putStep", "value": {"id": "fix", "name": "Ask for a corrected receipt", "kind": "task", "phase": "Review",
      "duration": 5, "resources": {"approvers": 1},
      "description": "The approver asks for a readable receipt; the claim is then checked again.",
      "scene": {"id": "scene-fix", "position": [28, 10], "color": "#ffbb73"}}},
    {"op": "putStep", "value": {"id": "pay", "name": "Pay the claim", "kind": "task", "phase": "Pay",
      "duration": 15, "resources": {"finance": 1},
      "description": "The finance clerk pays the approved amount.",
      "scene": {"id": "scene-pay", "position": [42, 0], "color": "#ffbb73"}}},
    {"op": "putStep", "value": {"id": "end", "name": "Claim paid", "kind": "end", "phase": "Pay",
      "description": "The employee has been reimbursed.",
      "scene": {"id": "scene-end", "position": [56, 0], "color": "#77b5a0"}}},
    {"op": "putFlow", "value": {"id": "start-check", "from": "start", "to": "check"}},
    {"op": "putFlow", "value": {"id": "check-approved", "from": "check", "to": "approved"}},
    {"op": "putFlow", "value": {"id": "approved-fix", "from": "approved", "to": "fix", "label": "Receipt unclear", "when": {"chance": 20}}},
    {"op": "putFlow", "value": {"id": "approved-pay", "from": "approved", "to": "pay"}},
    {"op": "putFlow", "value": {"id": "fix-check", "from": "fix", "to": "check"}},
    {"op": "putFlow", "value": {"id": "pay-end", "from": "pay", "to": "end"}},
    {"op": "setArrivals", "value": [{"at": 0, "count": 12, "interval": 10, "data": {}}]},
    {"op": "setDescription", "value": "A small expense approval desk for learning the process tools. All values are synthetic."},
    {"op": "setSeed", "value": 7},
    {"op": "setSipoc", "value": {"suppliers": [{"name": "Employees", "supplies": "Expense claims and receipts"}],
                                 "customers": [{"name": "Employees", "receives": "Reimbursement"}]}}
  ]
}
```

The recipe is one transaction: it replaces the starter task with two pools, five new or
replaced steps, a decision that sends 20% of the claims back for a corrected receipt,
twelve claims arriving ten minutes apart, a description, seed 7 and the suppliers and
customers of the SIPOC view. Preview it first, then write a new file:

```sh
bin/process-studio edit --input /tmp/first-process/process.json --recipe /tmp/first-process/edit.json --dry-run
bin/process-studio edit --input /tmp/first-process/process.json --recipe /tmp/first-process/edit.json --output /tmp/first-process/expense.json
```

Both print `"ok": true` with `"diagnostics": []`; the dry run writes nothing. If you see
a stale-guard error, run `inspect` again and copy the current fingerprint; never guess it.

## 3. Validate and review the change

```sh
bin/process-studio validate --input /tmp/first-process/expense.json
bin/process-studio diff --input /tmp/first-process/expense.json --against /tmp/first-process/process.json
```

`validate` prints `"runnable": true` and no diagnostics. `diff` summarises the edit as
"Changes: 7 steps, 8 flows, 2 resources, 1 arrival rule, 3 process settings changed", lists
the added, changed and removed steps, resources, flows and arrival rules by name, and itemises
each changed value in `fields` (for example `/steps/start/name` from "Intake" to "Expense claim
submitted").

## 4. Run it and read the deck

```sh
bin/process-studio run --input /tmp/first-process/expense.json --minutes 480 --output /tmp/first-process/report.json
bin/process-studio slides --input /tmp/first-process/expense.json --format md --output /tmp/first-process/slides.md
```

With seed 7 the run completes by itself at minute 190 (`advancedMinutes`), before the
480 minutes you allowed: 12 claims arrived and completed, the mean cycle time is 52.5
minutes, the work cost (`metrics.cost`: pool minutes actually worked) is 555 and the capacity
cost (`metrics.capacityCost`: every pool unit for every minute, busy or idle) is 760. In
`report.json`, `snapshot.resources` shows the finance clerk busy for 180 of the 190 minutes; the
single clerk is the bottleneck. These are business minutes and simulated cost units from one
seeded scenario, not a forecast.

`slides.md` holds the 14-slide deck in six sections: the introduction, one section per
phase (Submit, Review, Pay), the variant path **Ask for a corrected receipt** and a
summary. Each step slide starts with the description you wrote.

## 5. Build and open the studio

```sh
bin/process-studio build --input /tmp/first-process/expense.json --output /tmp/first-process/expense.html
```

Open `/tmp/first-process/expense.html` in the browser. The studio opens paused at minute
0 in the **3D** view (on a phone, in **2D**), with the six steps in the **Steps** list and **2D**,
**3D**, **SIPOC**, **Dashboard** and **Present** above the stage.

1. Choose **Run simulation**. The clock runs to minute 190 and stops, and **Reset run**
   becomes the highlighted button; the metrics read Completed 12, Mean cycle 52.5 min, Work
   cost 555 and Capacity cost 760, the same as the command line.
2. Choose **2D** to see the map, then **SIPOC** to see the suppliers, inputs, phases,
   outputs and customers. Changing the view never advances the clock.
3. Choose **Dashboard**. The **Busiest pool** tile reads 95% for the Finance clerk, and under
   **Where time goes** the **Waiting by step** panel says "Pay the claim holds 100% of the
   waiting.": every minute a claim waited, it waited for the single clerk. The strip at the top
   reminds you that this is one simulated run of seed 7, not a forecast.

## 6. Tune a step in the step editor

1. Select **Pay the claim** in the **Steps** list. The inspector shows its description,
   **Duration** 15 min, its total queue time (255 min) and a **Mean wait per start** of 21.3 min.
2. Choose **Edit step…** beside **Fit to view**. The step editor opens with the step's
   fields, its pools (**Approvers**, **Finance clerk**) and its outgoing path.
3. Set **Task duration (minutes, at least 1)** to `10` and choose **Save to draft**. The
   status line reads "Saved to the draft. Apply the draft to start a fresh run." and a chip
   in the header reads "Unapplied draft · 1 step changed".
4. Before applying, compare the draft with the applied design over several seeds. The
   Dashboard is still shown, now with the step focus of **Pay the claim**; go to **What-if: spread
   across seeds**, choose
   **Applied design versus draft** and **Run seeds**. With the defaults (20 runs of 190 minutes from
   seed 7) it ends with "Comparison complete." and the mean cycle line reads "Mean cycle (minutes)
   per run is 25.9 lower with the draft than with the applied design", with its 95% interval.
   Your live run stays at minute 190.
5. Choose **Edit step…** again and **Apply and reset run**. Because the run is past minute
   0, the footer first asks you to confirm and starts on **Back** (**Export report first** would
   save the run report before you continue); choose **Apply and reset**. The studio starts a fresh paused run at minute 0, the chip disappears and **Pay the
   claim** stays selected.
6. Choose **Run simulation** again. This time the run completes at minute 165 with a mean
   cycle of 27.1 min, a work cost of 435 and a capacity cost of 660.

To add a step in the studio instead of a recipe, you would select a step and use **Step
structure** in the step editor, or **Add step…** in the header; the new step goes into the same
draft and is applied the same way.

## 7. Present it

1. Choose **Present**. The deck opens beside the 2D map on the slide of the selected step,
   **Pay the claim**: "Slide 10 of 14". Because the run is past minute 0 the header adds "Live
   facts come from one simulated run at business minute 165 (seed 7, completed)."
2. Press Home for slide 1, whose **Key results** repeat the run: 12 cases arrived and completed,
   mean cycle time 27.1 min, work cost 435 units and the most utilised pool, Finance clerk.
3. Choose **Next**, or press the Right arrow, Page Down or `n`, to move through the slides; a
   step slide frames its step and its neighbours on the map. **Contents** lists every slide by
   section.
4. Choose **Exit** or press Escape. The studio returns to the view you had and the run
   stays paused.

[Present a process to stakeholders](../how-to/present-a-process.md) covers choosing a
minute, the phone menu, the shorter **Section slides only** deck and the Markdown export.

## 8. Export the result

1. Choose **Export ▾** and then **Export JSON**. The browser saves
   `expense-approval.process.json`, the applied definition at revision 2.
2. Back in the terminal, compare it with your file (adjust the path to your downloads
   folder) and export it to BPMN 2.0:

```sh
bin/process-studio diff --input ~/Downloads/expense-approval.process.json --against /tmp/first-process/expense.json
bin/process-studio export-bpmn --input ~/Downloads/expense-approval.process.json --output /tmp/first-process/expense.bpmn
bin/process-studio validate-bpmn --input /tmp/first-process/expense.bpmn
```

`diff` reports "Changes: 1 step changed" (**Pay the claim**) with one changed value,
`/steps/pay/duration` from 15 to 10. `export-bpmn` prints a `fidelity` note that without BPSim
the arrivals, durations, probabilities, pool sizes and costs travel only in the Wildlands extension
(add `--bpsim` to carry them), and `validate-bpmn` exits 0 with `"conforms": true`. The same **Export ▾** menu also offers **Export BPMN**, **Export
BPMN with BPSim**, **Export run report** and **Download HTML**.

## Where to go next

- Add parallel work, machines, journeys, timers and BPMN-class behaviour with the
  [authoring guide](../how-to/business-process-authoring.md).
- Explore seven larger synthetic processes in the
  [agency delivery lab](../concepts/agency-delivery/README.md)
  (`demos/agency-delivery.html`).
- Read every Dashboard panel with
  [Read a process dashboard](../how-to/read-a-process-dashboard.md).
- Look up commands and exit codes in the
  [Process Studio CLI handbook](../reference/process-studio-cli.md); `bin/wildlands process`
  takes the same commands ([Wildlands CLI](../reference/wildlands-cli.md#business-processes)).

A finished tutorial run is a working walkthrough of the tools, not a validated process
model, balance check or usability review.
