# Director Desk and first Team Principal loop

The native Director Desk provides a bounded four-event management loop over the existing campaign and race authorities.

## Player route

**Main menu → Team Principal Campaign → Director's Desk → Start/advance to event → existing Minimal weekend → factual settlement → Director's Desk debrief.**

The bundled default starts a deterministic four-event 1950 career, with a bounded player organization, cash reserve, three facility families and five rivals. New careers consume the validated default campaign definition, its authored weekend and scheduled circuits. The checkpoint freezes those inputs; changing the live content pack does not change an existing career. Custom campaign definitions can differ from the bundled default.

1. Choose **Team Principal Campaign** from the main menu. An existing local campaign loads; otherwise the validated default career is created.
2. Review cash, committed minimum cash, priorities and the next event on the desk. Reading the desk does not advance time.
3. If departure is still in the future, choose **Advance to event**. Due obligations and rival reviews are staged as part of that campaign advance.
4. Choose **Start next event** at the departure slot. Readiness blockers prevent departure; a successful departure opens the existing Minimal weekend.
5. Complete practice, qualifying and the race using the [Minimal weekend guide](../race-weekend/minimal.md).
6. Return from results to the desk for factual standings, cash and condition changes, then repeat for the next event. After the final event, the season lifecycle closes; the desk does not expose a next-season creation action.

## Director Desk contract

The desk is a detached read model. It shows current cash, committed minimum cash, next event, principal energy, team standing, at most three priorities, organization work, a rival-paddock summary, onboarding progress and the latest factual debrief. Reading or resizing the desk cannot advance time, settle money, reserve people or consume gameplay randomness.

Time advances only through an explicit Director transaction. **Advance to event** stops exactly at the next registered departure slot, settles due cash commitments and performs due rival reviews in the same checkpoint candidate. **Start next event** invokes [readiness and departure](event-readiness-departure.md); a blocker leaves the campaign unchanged.

## Race and settlement boundary

A campaign weekend is the existing native PracticeRaceSim and Minimal race workspace. The campaign freezes its ordinary RaceRecord, performance profiles and stable mappings through CampaignWeekendManifest. Practice, qualifying, formation, lights, race commands and classification remain owned by the race implementation.

At completion, the ordinary factual WeekendResult passes through the exactly-once campaign settlement transaction. The desk then reports observed sporting, cash and returned-condition facts. It does not label estimated counterfactuals as facts or infer component diagnoses.

## Saves and interrupted weekends

Campaign state is saved to `user://campaign.json` separately from the ordinary
weekend checkpoint. Reopening a campaign with an active manifest resumes its
saved weekend. If that weekend checkpoint is unavailable, the shell reports that
the campaign needs attention; it does not fabricate a race or settle a result.

Each campaign envelope uses the atomic [storage contract](state-clock-storage.md).
The native shell saves the campaign and weekend files in sequence; these are not
one cross-file transaction. An active manifest freezes campaign planning until a
valid factual result can settle it.

## Onboarding and accessibility

Onboarding is derived from campaign state rather than a separate progress save: read the desk, launch an event, settle a weekend, then advance toward the next decision. Its visibility is a user preference and can be resumed.

The native desk uses responsive grid layouts for 1100×720 and 130% text. Primary campaign actions remain explicit buttons; no management action requires precision dragging.

## Verification boundary

Registered contracts cover starter creation, twelve entrant mappings, explicit event-duty assignments, readiness-gated departure, factual result settlement, debrief generation, Round 2 advance and rival review. The existing whole-shell native suite covers the main-menu campaign entry and compact enlarged-text Director Desk.

Automated coverage establishes the contracts above. Human comprehension, campaign balance and long-session engagement remain separate validation work.

## Implementation and coverage

Authority and application owners: [starter.gd](../../../scripts/application/campaign/starter.gd), [weekend_workflow.gd](../../../scripts/application/campaign/weekend_workflow.gd), [director_query.gd](../../../scripts/application/campaign/director_query.gd), [director_transaction.gd](../../../scripts/application/campaign/director_transaction.gd), [campaign_screens.gd](../../../scripts/composition/campaign_screens.gd).

Contract fixtures: [campaign_director_contracts.gd](../../../tests/support/campaign_director_contracts.gd), [game_flow_coherence_ui_tests.gd](../../../tests/game_flow_coherence_ui_tests.gd).
