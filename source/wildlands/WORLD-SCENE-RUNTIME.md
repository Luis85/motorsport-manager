# Scene journeys and native world authority

A graph pack names levels, dungeons, owned islands and building interiors. A
connection selects a destination scene; the application prepares a detached review
before replacing the active engine. Scene metadata remains data. Requirements use
the compiled player-level, completed-quest, item and building checks; entry events
can produce a message or change the destination's pause setting.

Initial scene launches evaluate requirements against their native starting state.
Connected entries evaluate the reviewed source state, so an admitted guide can
enter a destination with a lower starting level. Both paths share the same entry
event authority and expose its messages once. Saved visited worlds restore their
native state without replaying admission events.

`LWSceneNavigation` owns this boundary. `prepare(engine, connectionId)` returns a
detached target, messages and a normal scenario scene preview. `commit(engine,
preview)` accepts that exact reviewed proposal only while the source export and
experience context remain unchanged. A tick, gameplay command, settings change,
context edit or preview edit invalidates the review. A successful commit consumes
it. Failed activation restores libraries, resources, simulation and world profiles
together, preserving the original engine and leaving the review available for retry.

## Checkpoints and bound scenes

The experience context contains an optional journey: the complete authored pack,
visited scene IDs and detached native checkpoints keyed by unbound source scene.
There is one active simulation. Dormant worlds preserve their own elapsed time,
RNG, inventories, settings, paid work and physical actor locations without ticking.
Returning imports the saved checkpoint instead of restarting the authored state.

The pack owns each embedded asset and creature catalog once. Authored starting
states and dormant checkpoints in a saved journey omit `scenarioResources`;
native scene reconstruction restores that catalog from the pack before import.
This normalization preserves exact native exports across revisits without copying
large catalogs into every independent world. Imported journeys reject duplicate
checkpoint catalogs. Portable experience contexts omit their duplicate resources
and reconstruct them from the saved pack for canonical validation. Portable stories
also require their four native library
envelopes to agree with the journey pack, preventing a later transition from
silently replacing modified definitions.

An island or interior binding points directly to an unbound ancestor in the same
world. Its authored `initialState` must be empty. These children reuse that source
scene's current native checkpoint; entering and leaving preserve the same unfinished
jobs and identities. A binding cannot create a duplicate colony, award supplies,
purchase land or move workers. Island bindings require an actually owned coordinate.
Interior bindings require an actual building and stable `floorId`, including its
native default or construction layout.

`target(engine)` returns presentation intent. An island target supplies its
coordinate for the existing map focus controls; an interior target supplies the
exact building and floor for the existing building visit view. Camera state and
selected floor belong to the presentation lifetime. The native engine has no
separate active-island simulation selector: all owned islands continue through
the same world engine. Authored bounds limit the view and hierarchy, without
teleporting or clipping physical workers.

## Save, capture and admission

Current v10 portable stories retain the whole graph and dormant checkpoints.
Encoding updates a detached copy of the active owner's checkpoint to the exact
saved native state. Inspecting rejects a mismatch between that checkpoint and the
story's active native state. Validation checks pack/context identity, visited IDs,
owner checkpoint identity and every native checkpoint under its authored libraries
and world. A checkpoint cannot embed another journey. Existing stories and packs
without graph metadata keep their established behavior.

Journeys accept at most 8 MiB of JSON and retain the shared content decoder's
60,000-value and depth limits. A separate 200,000-value journey guard reserves
capacity for detached SDK projections if the shared decoder policy changes; the
existing decoder currently rejects oversized input first. These checks run before
importing saved checkpoints. Failed inspection does not install content or change
the current story.

Initial launch and transition preparation also bound the whole prospective portable
envelope: active native state, four native libraries and the compact experience.
They reserve 64 values for envelope metadata. Growing a journey past that supported
capacity rejects before replacing the source engine, leaving its existing story
saveable. The larger-owner regression verifies the rejection and exact SDK restore
of the last admitted world.

Capturing a journey returns the whole original pack with all owner starting states
patched to their latest checkpoints. Bound starting states remain empty. The result
can reopen any captured world while retaining its dormant progress and authored
connections. Capturing does not mutate the current journey or advance simulation.

## Regression evidence

`source/test-scene-navigation.cts` exercises cross-world revisits, real paid upstairs
production across bound entry/return, owned-island focus, world-owned settings,
entry gates and events, consumed/stale/forged reviews, activation rollback and retry,
invalid saved checkpoints, aggregate limits, portable story restoration and complete
pack capture. Full Office catalogs additionally cross two independent worlds and
an actual upstairs binding through the SDK, preserving exact progress across a
portable story roundtrip. These headless tests exercise native simulation and application
admission; browser focus, camera restoration and human usability need their own
presentation evidence.
