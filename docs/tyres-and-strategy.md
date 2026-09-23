# Tyre allocation and stop planning

## Allocation

Every driver owns twelve sets for one weekend: **S1–S3, M1–M3, H1–H2, I1–I2, W1–W2**. Their internal identity includes the immutable driver ID; another driver cannot mount the set. Each records compound, aggregate tread percentage, aggregate temperature, distance in laps, mount count and whether it has been used.

Tread and temperature belong to the set. Removing, selecting or remounting it never restores 100% tread or resets it to a warmed temperature. Spare sets cool gradually toward the modeled ambient temperature. The fitted set's live aggregate tyre state is synchronized after wear/incident updates and into a copied checkpoint snapshot.

This ports the finite allocation shape and retained-condition decision from the prototype. It does **not** port its four-contact-patch thermal/pressure/graining/flat-spot/puncture model. The allocation is a fictional test ruleset, not current Formula 1 or another series' regulations. There are no mandatory compound-use penalties.

## Pick, commit, fit

Open **Tyres** in the right pit wall. All twelve sets show fitted/planned/fresh/used state and tread; hover a set for its temperature, laps and mount count. Selecting one only changes the plan. The existing compound dropdown instead asks the system to choose the freshest usable set of that compound.

A qualifying **Send out** mounts the selected set when the car leaves its garage. Approving **formation** mounts the prepared starting sets. A racing **Box** call or **Schedule stop** commits physical pit entry; the selected set is fitted during real servicing. Plans cannot switch tyres in the lane. At service start the specific set identity and repair flag are frozen, preventing a later edit from changing work already underway.

A set at or below 1% tread is unavailable for a new fit. The mounted set cannot serve as its own racing replacement. No spare means no accepted replacement stop: the player receives a reason and must choose an available set. Damage-only stops without a replacement are not implemented. Engineers use the same remaining inventory; they cannot manufacture fresh stock. New weekends create a new allocation.

Selecting a set does not itself disable delegation; delegated qualifying uses that plan at release. Manual pace/engine, immediate pit and scheduled-stop commands disable delegation. A subsequently re-enabled engineer may revise a condition-driven plan; the explicit pending scheduled gate is retained while its pit order exists.

## Scheduled pit entry

Only a racing on-track player car without an existing pit order may receive a scheduled stop. Choose an integer racing lap strictly before the final lap. The target gate is:

`(requested_lap - 1) * circuit_length + pit_entry_station`

Thus **lap 2** means the pit entry encountered during the second racing lap, not after completing two full laps. The command rejects past/too-close gates using a braking lead-distance estimate. It does not silently substitute another lap. Actual driving retains safe pit-entry braking and lane/box queues. The plan stores that absolute gate, so it cannot accidentally trigger at an earlier occurrence of the same pit branch.

Cancel while the car remains on track. To move a scheduled stop, cancel and schedule again. **Box at next entry** can replace a future schedule with an immediate safe-entry order; cancellation is no longer possible once in the pit lane. One pending scheduled stop per car is supported. There is no multi-stop optimization or future-weather oracle.

## Feedback

The stint chart records actual fitted-set spans from the standing start and each completed service. It identifies the planned stop separately. The current stint expands with distance; history is not invented before it happens.

Tread advice estimates laps until 20% tread from the current compound's base wear and pace factor. Fuel margin uses the current engine mode and remaining lap distance. These are approximate model-rate estimates, **not the prototype's recent-stint estimator**. They exclude future rain, traffic, incidents and other changing conditions; they are not a guarantee that the tyres will reach the suggested lap.

## Save continuity

Checkpoint version 3 stores the allocation, current/planned/service set IDs, absolute pit gate, scheduled lap and actual stints. Validation rejects changed identities, negative or non-finite state, foreign planned IDs and malformed stint records before replacing a session. JSON continuation tests compare exact discrete/random state and a declared numerical tolerance.

Native v1/v2 checkpoints initialize the formerly absent stock while preserving the currently mounted aggregate tread and temperature. Earlier discarded-set history is unknowable and is not fabricated. Browser prototype saves are still incompatible.
