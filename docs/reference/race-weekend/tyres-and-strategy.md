# Tyre allocation and stop planning

This reference explains finite resources and physical stop execution. Minimal exposes automatic finite-stock choices through **Send out** and **Box this lap**, plus a read-only Strategy comparison. The explicit set, stop-plan and recovery controls described below belong to optional **Advanced**. See [Minimal weekend](minimal.md) for the default interface.

## Allocation

The shipped standard allocation gives each driver twelve sets for one weekend: **S1–S3, M1–M3, H1–H2, I1–I2, W1–W2**. Validated content packs can supply a different ordered allocation (up to 64 sets per driver); [Tyre and setup content](../content/tyres-and-setup.md) describes its authoring limits. The selected allocation and compounds freeze with the weekend. Each set’s internal identity includes the immutable driver ID; another driver cannot mount the set. Each records compound, distance in laps, mount count, heat cycles and four individual wheel records; aggregate tread/temperature are derived summaries.

Tread and temperature belong to the set. Removing, selecting or remounting it never restores 100% tread or resets it to a warmed temperature. Spare sets cool gradually toward the modeled ambient temperature. The fitted set's live aggregate tyre state is synchronized after wear/incident updates and into a copied checkpoint snapshot.

This adapts the prototype allocation and four-contact-patch model: tread, surface/core temperatures, normalized pressure, load, graining, blistering, flat spots and punctures. Coefficients are bounded game rules, not a validated real-vehicle tyre model. The allocation is a fictional test ruleset, not current Formula 1 or another series' regulations. There are no mandatory compound-use penalties.

## Pick, commit, fit

In Advanced, open **Tyres** in the right pitwall. The driver’s allocated sets show fitted/planned/fresh/used state and tread; hover a set for its temperature, laps and mount count. Selecting one only changes the plan. The existing compound dropdown instead asks the system to choose the freshest usable set of that compound.

A qualifying **Send out** mounts the selected set when the car leaves its garage. Approving **formation** mounts the prepared starting sets. A racing **Box** call or **Schedule stop** commits physical pit entry; the selected set is fitted during real servicing. Plans cannot switch tyres in the lane. At service start the specific set identity and repair flag are frozen, preventing a later edit from changing work already underway.

A set at or below 1% aggregate tread, or with a punctured/exhausted wheel, is unavailable for a new fit. The mounted set cannot serve as its own racing replacement. No spare means no accepted replacement stop: the player receives a reason and must choose an available set. The staged Recovery mechanic separately supports **Repair only** without spare stock when the fitted set is usable and meets its limiting-wheel requirement; this retains the set and its history. Minimal’s Box action requests a replacement-tyre stop. See [Recovery](../../_archive/releases/race-weekend-recovery.md) for repair feasibility and authority. Engineers use the same remaining inventory; they cannot manufacture fresh stock. New weekends create a new allocation.

In the current strategy profile, delegation has separate qualifying, pit, pace, engine and racecraft channels. Racing set/compound selection takes pit ownership; pace and engine commands take only their corresponding channel. Immediate/scheduled pit orders and cancellations take pit ownership and mark an existing approved plan overridden. A garage tyre choice does not itself claim unrelated channels. The legacy base profile retains its older all-or-nothing delegation behavior; restoring it does not silently enable the modern policy. An accepted physical pit commitment remains binding.

## Scheduled pit entry

Only a racing on-track player car without an existing pit order may receive a scheduled stop. Choose an integer racing lap strictly before the final lap. The target gate is:

`(requested_lap - 1) * circuit_length + pit_entry_station`

Thus **lap 2** means the pit entry encountered during the second racing lap, not after completing two full laps. The command rejects past/too-close gates using a braking lead-distance estimate. It does not silently substitute another lap. Actual driving retains safe pit-entry braking and lane/box queues. The plan stores that absolute gate, so it cannot accidentally trigger at an earlier occurrence of the same pit branch.

Cancel while the car remains on track. To move a scheduled stop, cancel and schedule again. **Box at next entry** can replace a future schedule with an immediate safe-entry order; cancellation is no longer possible once in the pit lane. One pending physical stop per car is supported. Advanced’s strategy plan may hold later approved windows; those are intentions until their physical order is issued. Neither the manual schedule nor the bounded forecaster guarantees an optimal multi-stop plan or reads the authoritative future weather.

## Feedback

The stint chart records actual fitted-set spans from the standing start and each completed service. It identifies the planned stop separately. The current stint expands with distance; history is not invented before it happens.

Tread advice estimates laps until 20% tread from the current compound's base wear and pace factor. Fuel margin uses the current engine mode and remaining lap distance. These are approximate model-rate estimates, **not the prototype's recent-stint estimator**. They exclude future rain, traffic, incidents and other changing conditions; they are not a guarantee that the tyres will reach the suggested lap.

## Save continuity

The base native v4 checkpoint introduced individual wheel/setup/surface data in addition to the allocation, current/planned/service set IDs, absolute pit gate, scheduled lap and actual stints. Validation rejects changed identities, negative or non-finite state, foreign planned IDs and malformed stint records before replacing a session. JSON continuation tests compare exact discrete/random state and a declared numerical tolerance.

Current practice/strategy/recovery saves add their own validated profile records and frozen content closures around these retained fields; [Persistence](../persistence.md) documents the complete envelopes. Restoring an existing weekend uses its retained allocation rather than the live catalog.

Native v1/v2 checkpoints initialize the formerly absent stock while preserving the currently mounted aggregate tread and temperature. Native v3 retains its stock; all pre-v4 saves receive explicit symmetric wheel defaults because individual wheel history was not recorded. Earlier discarded-set history is unknowable and is not fabricated. Browser prototype saves are still incompatible.

## Wheel detail and emergency recovery

Tyres separates Allocation, Wheels and Stop plan. The four stable wheel cards retain selection during refresh. Pressure is relative to the cold reference (×), not bar/psi. Surface and core temperatures differ; heating increments a cycle once and cooling re-arms it. Graining may clean under suitable running conditions, while flat spots/punctures are retained until the set is replaced.

Punctures limit grip/pace and produce a wheel-specific advisory. Only a delegated engineer may advance a future scheduled stop or order early emergency recovery. It still needs sound finite stock and safe pit-entry braking. A manually controlled car receives information, not an automatic strategy override. There is no guaranteed rescue where the remaining physical pit entry lies beyond the race finish.
