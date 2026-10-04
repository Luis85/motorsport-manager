# Version compatibility and migrations

Folder content packs were introduced at `schema_version: 1` and
`runtime_contract: 1`. Content definitions likewise start at schema version 1.
These are format and execution contracts, not the pack author's semantic
`version` string. Dependencies continue to require an exact declared pack version
and must precede their consumer in the selected pack list.

The production loader now reports `CONTENT_FUTURE_VERSION` for a higher format
or runtime contract and `CONTENT_MIGRATION_REQUIRED` for an earlier one. Malformed
or missing version fields still receive the structural schema diagnostic. The
loader does not rewrite any source file or silently lower a number. Duplicate
and self-referential dependency declarations are explicitly rejected.

There is no historical v0 folder-pack format, nor a specified v2 format to convert
in this repository. Consequently, no pretend v0-to-v1 converter, version-number
rewrite, or speculative future migration is supplied. A future format change
must register an explicit conversion, preserve original input, validate the
converted candidate with the destination production compiler and ship old/new
fixtures plus failure/no-write tests. Until that implementation exists, rejection
is intentional and safer than silently discarding fields.

New optional version-1 fields retain their old omission semantics. In particular,
legacy thermal records without `operating` use the original coefficients without
being rewritten; old weekends without a mechanic-profile reference retain the
existing construction contract. Missing `race_tuning.balance` and campaign
`tuning` blocks likewise use frozen legacy policy without inserting fields or changing historical definition hashes.
Save-game version readers remain independent of folder-pack version validation.

## Campaign-content continuation

New Team Principal careers freeze the validated campaign definition and its resolved
race-content closure into the campaign checkpoint. Save-game compatibility remains
independent from folder-pack versioning: `CampaignManagement` version 2 carries
the optional frozen campaign-content slot, while version-1 management envelopes
remain valid and use the isolated legacy policy adapter. A removed or edited pack
cannot retroactively change calendar dates, finance, rival policy, people-development
tuning, engineering-evidence tuning or weekend settings in an existing career.

This compatibility path is read-only technical debt. New careers must originate
from a validated `campaign` definition; compatibility constants are registered in
the consumer inventory and must not become a second authoring authority.
