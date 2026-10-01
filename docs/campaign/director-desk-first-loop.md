# Director Desk and first Team Principal loop

TM-11 turns the verified campaign authorities into the first playable management loop without introducing a second simulation.

## Player route

**Main menu → Team Principal Campaign → Director's Desk → Start/advance to event → existing Minimal weekend → factual settlement → Director's Desk debrief.**

The starter is a deterministic four-event Team Principal career. It reuses a real v12 race entry, preserves every race-local entrant through explicit stable campaign mappings, and starts with a bounded player organization, cash reserve, three facility families and five rival organizations.

## Director Desk contract

The desk is a detached read model. It shows current cash, committed minimum cash, next event, principal energy, team standing, at most three priorities, organization work, a rival-paddock summary, onboarding progress and the latest factual debrief. Reading or resizing the desk cannot advance time, settle money, reserve people or consume gameplay randomness.

Time advances only through an explicit Director transaction. **Advance to event** stops exactly at the next registered departure slot, settles due cash commitments and performs due rival reviews in the same checkpoint candidate. **Start next event** invokes TM-08 readiness and departure; a blocker leaves the campaign unchanged.

## Race and settlement boundary

A campaign weekend is the existing native PracticeRaceSim and Minimal race workspace. The campaign freezes its ordinary RaceRecord, performance profiles and stable mappings through CampaignWeekendManifest. Practice, qualifying, formation, lights, race commands and classification remain owned by the race implementation.

At completion, the ordinary factual WeekendResult passes through the exactly-once campaign settlement transaction. The desk then reports observed sporting, cash and returned-condition facts. It does not label estimated counterfactuals as facts or infer component diagnoses.

## Onboarding and accessibility

Onboarding is derived from campaign state rather than a separate progress save: read the desk, launch an event, settle a weekend, then advance toward the next decision. Its visibility is a user preference and can be resumed.

The native desk uses responsive grid layouts for 1100×720 and 130% text. Primary campaign actions remain explicit buttons; no management action requires precision dragging.

## Verification boundary

Registered contracts cover starter creation, twelve entrant mappings, explicit event-duty assignments, readiness-gated departure, factual result settlement, debrief generation, Round 2 advance and rival review. The existing whole-shell native suite covers the main-menu campaign entry and compact enlarged-text Director Desk.

Automated coverage establishes the contracts above. Human comprehension, campaign balance and long-session engagement remain separate validation work.
