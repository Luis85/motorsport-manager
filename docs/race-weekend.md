# Grand Prix weekend

## Session contract

| Phase | Player action / exit condition |
|---|---|
| Briefing | Review circuit/scenario, then start qualifying |
| Qualifying | Engineers or player dispatch runs; out → hot → in → garage; clock or manual closure stops new flying laps |
| Qualifying results | All active attempts settle; measured best laps establish the grid; player approves preparation |
| Race preparation | Pick starting tyres/setup; player starts formation |
| Formation | A physical lap in grid order, tyre warming and fuel use; no race distance counted |
| Grid ready | All cars stopped in their assigned slots; player approves lights |
| Lights | Five red lights, then a standing start |
| Race | Continuous top-down simulation until finish/retirement classification |
| Results | Stable results and event log; player chooses another weekend |

There are twelve fictional drivers in six two-car teams. The player controls **Obsidian: Daniel Mercer (08) and Lucas Moreau (09)**. Other cars can be inspected but reject player commands. Qualifying is a single timed session, not Q1/Q2/Q3. There is no practice session or campaign unlock gate in this iteration.

## Qualifying

By default, delegated engineers schedule up to two runs. Departure follows the physical pit lane with its limiter and merge checks. Only a completed valid **hot lap** establishes a time; an out-lap or in-lap never appears as a qualifying result. Closing the session prevents new hot laps and allows already-started attempts to finish before returning to the garage. Cars without a measured time sort behind timed cars using stable grid order.

Disabling delegation allows manual **Send out** and **Recall**. A tyre set can be planned in the garage and is actually fitted on release. After the session the application waits for approval instead of automatically rolling into a race.

## Pit-wall decisions

**Pace** trades performance against tyre wear: conserve, balanced, push. **Engine** trades speed against fuel use: save, standard, attack. Fuel is expressed in **lap-equivalent units**, not litres. The interface makes remaining fuel and tyre/health state visible. A single cornering-setup slider changes the simplified balance between cornering and straight-line performance; it is not a full setup simulator.

**Tyre selection** plans a specific driver-owned set or the freshest usable set of a compound. Send out, formation approval or actual pit service performs the fit; selection alone never refreshes wear. S/M/H are dry tyres, I/W intermediates and wets. **Box at next entry** commits a pit request. Calls that cannot be safely reached at the limiter speed are deferred to the next entry opportunity and logged. **Cancel** cancels an uncommitted on-track request. The team shares a pit box, so a teammate may queue. Servicing fits the chosen remaining set at its retained condition, optionally repairs modeled damage according to the frozen service plan, and returns the car through the exit merge. There is no race refueling.

Manual pace/engine/pit commands turn delegation off, avoiding silent engineer overrides. Re-enable delegation to restore automatic condition, fuel and tyre-crossover decisions. The model does not enforce real-series tyre allocation or mandatory-compound regulations.

## Reading the race

The timing tower shows position, car, current gap/state and tyre life. Live gaps beginning with `~` are distance/speed estimates; measured lap/sector times and interpolated finish timestamps are separate. Select a car on the track or in the tower to inspect it. Gold/teal identify the player's cars, not their standing.

The circuit view supports free pan/zoom, fit, selected-car follow, labels and a racing-line overlay. A speed trace covers recent telemetry. Flag/weather text and the radio log explain state changes. Red lights are visible during the start sequence. Pit service remains visible as a separate route rather than a hidden countdown.

## Flags, finish and interruption

Local yellow suppresses passing in the affected modeled sector. A simplified safety-car state limits the field's speed and prohibits overtaking, followed by a timed restart. Blue flags and qualifying courtesy move slower priority-conflicting traffic aside. These are game rules, not a complete sporting-regulations engine.

When a car completes the target distance, the earliest interpolated finish crossing raises the chequered flag. Other cars finish on their next crossing; lapped finishers retain their lower lap count. Same-step finishes are ordered by crossing time rather than roster iteration order. Retirements remain classified after finishers/running cars. A field of all retirements still ends the session.

Pause and speed controls are available in active phases. Main-menu navigation saves and pauses a weekend. Checkpoints preserve simulation state, including PRNG, pending pit/flag state and the track snapshot; reloading does not reroll the race.

## Iteration-two pit-wall workflow

The left timing tower keeps the same native rows during refresh. It shows OUT/HOT/IN/BOX qualifying states, explicit BLUE/DNF/FIN states, compounds and timing. Race gaps marked `~` are distance-based estimates, not transponder measurements. Selecting a car does not issue a command; rival cars can be inspected but not managed.

Both player-car selectors stay at the top of the right pit wall. Commands, Telemetry, Radio and Tyres are separate tabs. Send/Recall during qualifying and Box/Cancel during racing stay below those tabs, so scrolling telemetry cannot hide the primary actions. Ordinary commands acknowledge in the footer rather than opening a modal. Closing qualifying requires confirmation because it prevents new flying laps.

Telemetry contains actual sector splits and qualifying-run validity. Track water is an optional map overlay; it visualizes the same longitudinal simulation cells, not a separate cosmetic rain state. Following is damped and released immediately by manual pan/zoom; Fit resets the view.

A pit order reports when a late call must defer to another entry. The chosen set identity and repair work freeze when service begins. Set/compound changes are rejected while in the pit lane; later repair changes cannot alter the active service. Final classification uses completed laps before finishing time, so lapped cars cannot steal positions by crossing earlier.

## Finite stock and planned stops

See [Tyres and strategy](tyres-and-strategy.md). Twelve sets per driver retain condition throughout the weekend. The Tyres tab adds an explicit racing-lap stop, actual stint chart and approximate current-rate advice. Cancel a future plan before rescheduling; final-lap and insufficient-lead-distance entries are rejected. Primary pit calls remain visible below the scrolling detail area.
