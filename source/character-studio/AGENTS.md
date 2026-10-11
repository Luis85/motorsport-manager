# Character Studio agent workflow

Read the [handbook](../../docs/reference/character-studio-cli.md). Discover commands
and schemas; inspect revision and stateHash; dry-run and then apply the same
explicit guarded batch. On conflict inspect again; do not retry blindly.

Keep domain data and validation pure, application transactions detached, I/O in
infra, and browser rendering in ui. Use the existing engine validators and asset
renderer. Never add executable recipe content or silently normalize unknown
imports. Save status must reflect the destination that actually succeeded.

Run build:cli, check:cli, unit/integration tests and browser tests. Rebuild the
checked-in executable with source. Test engine and Scene Forge handoffs when
changing exports. Preserve root source-size budgets and documented limitations.
