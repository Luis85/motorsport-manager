# Authored mechanic profiles

`mechanic_profile` selects construction-time, code-registered providers. A weekend
may set `mechanic_profile_id`; the application resolves that definition before
creating a simulation. It never imports executable paths from a pack.

Clone `core.mechanic_profile.default`, edit its ID/name/description and reference
it from an authored weekend. Its `profiles` object declares an ordered provider
list for each of `strategy`, `weather`, `recovery` and `practice`. Each entry names
an installed provider ID and its exact version. The generated schema defines the
shape; the production compiler additionally checks registration, order,
dependencies, uniqueness and the reader's required compatibility prefix.

## What is and is not configurable

The four current providers are cumulative: strategy; strategy + weather;
strategy + weather + recovery; and all four including practice. These prefixes
are save-reader contracts, not arbitrary options to remove or reorder. With
only today's registered providers, authored alternatives retain these same
prefixes. This feature does **not** claim four new kinds of gameplay, optional
removal of required state, runtime hot-swapping, or arbitrary script plugins.

An additional, engine-reviewed provider can be registered in
`RaceMechanicProfiles.registered` and then selected by data after the required
prefix, provided its version and dependencies are valid. A provider that adds
serialized state also needs a code-owned reader/version contract and tests.
Ordinary definitions and tuning changes need no new provider implementation.

An unknown provider, unsupported version, duplicate, missing dependency, changed
required prefix or extra executable property rejects the candidate catalog.
Failure does not replace an active weekend. Provider objects are newly created
per simulation; neither live state nor instances are shared through the catalog.

## Frozen continuation

The selected profile record is frozen into construction options, snapshots and
the replay ruleset manifest. Weekend metadata must reference the same profile ID.
Replay initial state, bookmarks and endpoints must agree with their manifest;
changing only profile metadata cannot bypass that binding. Result receipts and
notebook validation use the same contract. No live pack lookup is necessary to
resume the supported frozen session.

Direct legacy construction without a profile keeps its original snapshot shape
and cumulative provider order. No original sporting expectation is regenerated
as part of this change. Run `content_mechanic_profile_tests`, `mechanics_tests`,
`content_tuning_tests`, persistence/reproduction tests and the full suite gate.
