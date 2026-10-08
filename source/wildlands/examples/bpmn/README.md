# BPMN 2.0 examples with BPSim parameters

Two **illustrative** processes for `wildlands process import-bpmn`. They are foreign BPMN as
another modeler would save it: standard elements, a diagram, a BPSim scenario and no Wildlands
extension, so every simulation setting below comes from BPMN or BPSim and the importer's mapping.
All durations, probabilities, quantities and costs are synthetic demonstration assumptions: they
do not describe a real bank, help desk or any measured behaviour, and the mapping was not
verified against a BPMN conformance suite or a specific modeler. Both files validate against
the OMG BPMN 2.0 and BPSim 1.0 XML Schemas (see the
[schema record](../../../../docs/_archive/verification/bpmn-schema-conformance-2026-10-08.md)). The BPSim dialect is the subset
the importer reads (see [BPMN 2.0 interchange](../../../../docs/reference/business-process-engine.md#bpmn-20-interchange)).

| File | Shows |
|---|---|
| [`loan-application.bpmn`](loan-application.bpmn) | Three lanes (Customer, Bank clerk, Credit engine), user and service tasks, a risk decision with BPSim probabilities, an inclusive gateway with expressions, an embedded sub-process "Document check" with a parallel multi-instance task, a call activity to the process "Fraud screening" in the same file, a non-interrupting timer boundary as an SLA escalation, a message-flow counterparty, and a BPSim scenario with an arrival stream, start-event properties, distributions, quantities and costs. |
| [`support-ticket.bpmn`](support-ticket.bpmn) | An event-based gateway racing a customer reply (message catch) against a timer, an interrupting timer boundary that hands work to a specialist, a standard loop on a script task, send and receive tasks, and a BPSim scenario with a counted arrival stream. |

## Import and run

```sh
bin/wildlands process import-bpmn --input source/wildlands/examples/bpmn/loan-application.bpmn --output /tmp/loan.json --report /tmp/loan-report.json
bin/wildlands process run --input /tmp/loan.json --minutes 3000 --seed 7 --output /tmp/loan-run.json
```

Both files import with no rejections in the default mode; the printed `warnings` are the
assumptions made. With seed 7 the loan run ends at minute 984 with 32 cases completed (cost
2414 simulated units; 3 reviews, 1 SLA escalation) and the ticket run at minute 1094 with 20
completed (cost 2671; 4 interrupted investigations). Other seeds give other draws; the checks in
`source/test-process-bpmn.cts` pin these numbers.

In a process studio, **Import…** opens the **Import BPMN** dialog with the same options (except minutes per hour, which stays 60) and a
live preview of warnings, rejections and the mapping. The
[agency delivery lab](../../../../docs/concepts/agency-delivery/README.md) carries the converted
loan application as its sixth process.

## How each construct is simulated

Loan application (21 steps, 24 flows):

| In the file | In the simulation |
|---|---|
| lanes Customer / Bank clerk / Credit engine | pools `customer` (people, capacity 50), `bank-clerk` (people, 3) and `credit-engine` (system, 4) from BPSim `Quantity` and `UnitCost`; the engine lane is a system pool because it only holds service-type tasks |
| `userTask` | a task demanding 1 of its lane's pool |
| `serviceTask` / `businessRuleTask` | `system` steps on the lane's system pool; "Archive documents" sits in the Bank clerk lane and runs on the pool `Automation` (capacity 4) |
| sub-process "Document check" | inlined; its steps carry `phase` "Document check" and ids `sub-docs-...` |
| multi-instance "Verify document" (cardinality 3, parallel) | `instances: {count: 3, mode: "parallel"}` |
| call activity "Fraud screening" | the process of that name inlined (ids `call-fraud-...`, phase "Fraud screening") |
| "Risk level?" with flow probabilities 0.45 / 0.30 / 0.25 | chained chance routes 45% then 55% of the rest, the last flow the default (a warning reports the rounding) |
| inclusive gateway "Additional checks" with `${amount > 20000}` and `${years < 2 \|\| amount > 40000}` | an inclusive `fork` and its `join`; the flow without a condition is the default |
| timer boundary "SLA of 90 minutes", `cancelActivity="false"` | `deadline` with `escalate`: after 90 working minutes a second token notifies the supervisor while the review continues |
| start-event properties `amount` (uniform 1000-50000) and `years` (uniform 0-10) | arrival `draws` (whole numbers) so the conditions have data |
| `InterTriggerTimer` exponential mean 30 and scenario `Duration` PT16H | arrival `gap` exponential with `until` 960 minutes |
| message flows with "Credit bureau" | ignored; the bureau becomes a SIPOC supplier and customer |
| `ProcessingTime` in seconds, hours; a LogNormal distribution | converted (a 30 second task rounds up to 1 minute with a warning); the unsupported LogNormal keeps the default 5 minutes and warns |

Support ticket (14 steps, 15 flows):

| In the file | In the simulation |
|---|---|
| message start event | a plain start; arrivals come from BPSim (20 cases, exponential gap, mean 45) |
| event-based gateway "Await customer" | a decision with chance 70% to the reply and the rest to the timeout, from the BPSim probabilities; the warning says the race is simulated by chance |
| message catch "Customer reply" | a timer of the BPSim `WaitTime` (triangular 30-60-180) |
| timer catch `PT4H` | a 240 minute timer |
| interrupting boundary `PT75M` on "Investigate" | `deadline` with `interrupt`: unfinished work is cancelled after 75 minutes and the token goes to "Hand over to specialist", then rejoins |
| standard loop on "Apply fix" (`loopMaximum` 3, an unparseable condition) | the task counts runs in `taskFixRuns` and a decision repeats it with a 50% chance while the counter is below 3; a warning says the condition was replaced |
| `sendTask`, `scriptTask`, `receiveTask` | `system` steps on the lane pool `Automation` |

## Import options worth trying

- `--no-bpsim`: ignores the scenario. The loan file is then rejected because its decisions have
  no conditions or probabilities; add `--unsupported drop` to share those flows equally.
- `--lanes ignore`: tasks demand no pools, so cases never queue for staff.
- `--default-capacity N`, `--system-capacity N`: pool sizes for lanes without BPSim `Quantity`.
- `--minutes-per-day N`, `--minutes-per-hour N`: business minutes in a day (default 480) and an
  hour (default 60) for ISO-8601 timer durations and BPSim units; a week is 5 days.
- `--unsupported drop`: removes constructs the engine cannot simulate instead of rejecting the file.
- `--process ID`, `--scenario ID`: choose one of several processes or BPSim scenarios.

See [Import BPMN and its simulation parameters](../../../../docs/how-to/business-process-authoring.md#import-bpmn-and-its-simulation-parameters)
and the option table in the [CLI reference](../../../../docs/reference/wildlands-cli.md#business-processes).
