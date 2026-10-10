# Model your first business process

This tutorial builds a small expense approval process from nothing, runs it, opens it
in the Process Studio, tunes one step, presents it and exports the result. It takes
about 30 minutes. Every value is a synthetic example.

You use the checked-in `bin/wildlands` command-line tool to create the process, because
the studio tunes an existing process but cannot create one or add steps from a form (see
[What the studio can and cannot edit](../how-to/business-process-authoring.md#what-the-studio-can-and-cannot-edit)).
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
bin/wildlands process discover
```

`discover` prints the `process` commands, their limits and the 14 guarded
`editOperations` (for example `putStep`, `putFlow` and `setDescription`).

## 1. Create a starter process

```sh
bin/wildlands process create --id expense-approval --name "Expense approval" --output /tmp/first-process/process.json
bin/wildlands process inspect --input /tmp/first-process/process.json
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
bin/wildlands process edit --input /tmp/first-process/process.json --recipe /tmp/first-process/edit.json --dry-run
bin/wildlands process edit --input /tmp/first-process/process.json --recipe /tmp/first-process/edit.json --output /tmp/first-process/expense.json
```

Both print `"ok": true` with `"diagnostics": []`; the dry run writes nothing. If you see
a stale-guard error, run `inspect` again and copy the current fingerprint; never guess it.

## 3. Validate and review the change

```sh
bin/wildlands process validate --input /tmp/first-process/expense.json
bin/wildlands process diff --input /tmp/first-process/expense.json --against /tmp/first-process/process.json
```

`validate` prints `"runnable": true` and no diagnostics. `diff` summarises the edit as
"Changes: 7 steps, 8 flows, 2 resources, 1 arrival rule, 3 process settings changed" and
lists the added, changed and removed steps by name.

## 4. Run it and read the deck

```sh
bin/wildlands process run --input /tmp/first-process/expense.json --minutes 480 --output /tmp/first-process/report.json
bin/wildlands process slides --input /tmp/first-process/expense.json --format md --output /tmp/first-process/slides.md
```

With seed 7 the run completes by itself at minute 190 (`advancedMinutes`), before the
480 minutes you allowed: 12 claims arrived and completed, the mean cycle time is 52.5
minutes and the simulated cost is 555. In `report.json`, `snapshot.resources` shows the
finance clerk busy for 180 of the 190 minutes; the single clerk is the bottleneck. These
are business minutes and simulated cost units from one seeded scenario, not a forecast.

`slides.md` holds the 14-slide deck in six sections: the introduction, one section per
phase (Submit, Review, Pay), the variant path **Ask for a corrected receipt** and a
summary. Each step slide starts with the description you wrote.

## 5. Build and open the studio

```sh
bin/wildlands process build --input /tmp/first-process/expense.json --output /tmp/first-process/expense.html
```

Open `/tmp/first-process/expense.html` in the browser. The studio opens paused at minute
0 in the **3D** view, with the six steps in the step list and **2D**, **3D**, **SIPOC**
and **Present** above the stage.

1. Choose **Run simulation**. The clock runs to minute 190 and stops; the metrics read
   Completed 12, Mean cycle 52.5 min and Simulated cost 555, the same as the command line.
2. Choose **2D** to see the map, then **SIPOC** to see the suppliers, inputs, phases,
   outputs and customers. Changing the view never advances the clock.

## 6. Tune a step in the step editor

1. Select **Pay the claim** in the step list. The inspector shows its description,
   **Duration** 15 min and its total queue time.
2. Choose **Edit step…** beside **Frame view**. The step editor opens with the step's
   fields, its pools (**Approvers**, **Finance clerk**) and its outgoing path.
3. Set **Task duration (minutes, at least 1)** to `10` and choose **Save to draft**. The
   status line reads "Saved to the draft. Apply the draft to start a fresh run." and a chip
   in the header reads "Unapplied draft · 1 step changed".
4. Choose **Edit step…** again and **Apply and reset run**. Because the run is past minute
   0, the footer first asks you to confirm and starts on **Back**; choose **Apply and
   reset**. The studio starts a fresh paused run at minute 0 and the chip disappears.
5. Choose **Run simulation** again. This time the run completes at minute 165 with a mean
   cycle of 27.1 min and a simulated cost of 435.

## 7. Present it

1. Choose **Present**. The deck opens beside the 2D map: "Slide 1 of 14", and because the
   run is past minute 0 the header adds "Live facts come from one simulated run at minute
   165 (seed 7)."
2. Choose **Next**, or press the Right arrow or Page Down, to move through the slides; a
   step slide frames its step on the map. **Contents** lists every slide by section.
3. Choose **Exit** or press Escape. The studio returns to the view you had and the run
   stays paused.

[Present a process to stakeholders](../how-to/present-a-process.md) covers choosing a
minute, the phone menu and the Markdown export.

## 8. Export the result

1. Choose **Export ▾** and then **Export JSON**. The browser saves
   `expense-approval.process.json`, the applied definition at revision 2.
2. Back in the terminal, compare it with your file (adjust the path to your downloads
   folder) and export it to BPMN 2.0:

```sh
bin/wildlands process diff --input ~/Downloads/expense-approval.process.json --against /tmp/first-process/expense.json
bin/wildlands process export-bpmn --input ~/Downloads/expense-approval.process.json --output /tmp/first-process/expense.bpmn
bin/wildlands process validate-bpmn --input /tmp/first-process/expense.bpmn
```

`diff` reports "Changes: 1 step changed" (**Pay the claim**), and `validate-bpmn` exits 0
with `"conforms": true`. The same **Export ▾** menu also offers **Export BPMN**, **Export
BPMN with BPSim**, **Export run report** and **Download HTML**.

## Where to go next

- Add parallel work, machines, journeys, timers and BPMN-class behaviour with the
  [authoring guide](../how-to/business-process-authoring.md).
- Explore seven larger synthetic processes in the
  [agency delivery lab](../concepts/agency-delivery/README.md)
  (`demos/agency-delivery.html`).
- Look up commands and exit codes in the
  [CLI handbook](../reference/wildlands-cli.md#business-processes).

A finished tutorial run is a working walkthrough of the tools, not a validated process
model, balance check or usability review.
