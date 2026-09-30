# Campaign commitments, due dates and cash forecast

Status: implemented TM-04 domain/application foundation on PR #27. This is not a complete accounting system, commercial model or playable Finance screen.

## Authority and separation

`CampaignEconomy` remains the factual integer-minor-unit cash authority. Version 2 adds binding future cash commitments and current reserve policy without treating either as cash.

The implementation separates four concepts:

1. **Cash** is opening balance plus settled postings.
2. **Commitments** are signed future receipts or payments with one due slot.
3. **Reserve policy** is a planning floor; it is not a second account and does not reserve or create cash by itself.
4. **Forecast assumptions** are detached conservative/optimistic inputs. They are never persisted as commitments or posted as cash.

Operating result, assets/liabilities, eligible-series expenditure and accrual accounting remain future views. The game does not claim real-world accounting compliance.

## Economy version 2

The version-two economy contains:

- stable campaign identity;
- `authority_from_slot`, identifying when commitment history became authoritative;
- one or more integer-minor-unit accounts;
- immutable weekend financial event indexes;
- binding commitments;
- current per-account reserve policies;
- one complete integrity digest.

Every posting has exactly one source:

- `event`: entry cost, participation amount or position bonus from a settled weekend; or
- `commitment`: the settlement of one binding future cash movement.

Event indexes and settled commitment records must account for every posting exactly once. Cash must reconcile to opening balance plus all postings. A posting cannot be detached, multiply indexed, assigned to another account, or changed independently from its result/commitment evidence.

## Commitments

`CampaignCashCommitment` records:

- stable commitment, account and source identity;
- creation and due slots;
- a signed non-zero integer amount;
- a game-defined category;
- `open`, `settled` or `cancelled` state;
- dated resolution and settlement-posting identity;
- immutable terms digest.

Positive amounts are contracted receipts; negative amounts are contracted payments. Supported first-slice categories include fixed/event operations, development, training, facilities, payroll, suppliers, sponsorship, participation, financing and a bounded other category.

An open commitment creates no posting. Settlement creates one posting at the contractual due slot and changes the commitment to `settled`. Re-running the same settlement boundary finds no open due record and is an exact no-op. Cancellation is possible only while open and no later than the due slot; it creates no cash movement.

Changing amount, date, category, source or account after recomputing only the outer economy digest still fails the commitment terms check.

## Time and checkpoint rules

`CampaignEconomyTimeline` validates finance against the authoritative campaign clock:

- commitment authority cannot begin in the future;
- creation, cancellation, settlement, reserve policy and cash postings cannot be dated after the checkpoint state;
- open due dates may be in the future.

`CampaignFinanceTransaction` restores the complete checkpoint, stages one finance change and publishes a complete replacement checkpoint or the exact caller value. It supports adding/cancelling commitments, changing reserve policy and settling due items up to current campaign time.

New planning changes are frozen while a campaign weekend manifest is active. Existing obligations still continue: `CampaignWeekendTransaction` settles commitments due between departure and return at their own due slots, then publishes them atomically with elapsed campaign time, standings, returned inventory, event cash and the exactly-once receipt. Failure in any sub-step publishes none of them.

## Legacy compatibility

Version-one economy data remains valid. On the first new finance/event mutation it upgrades losslessly:

- opening cash and current cash are unchanged;
- event postings keep identity, date, amount, category and result digest;
- `event_id` becomes the generic version-two event source reference;
- commitments and reserve policy start empty;
- `authority_from_slot` is the explicit migration/current campaign slot.

Migration therefore does not claim knowledge of unrecorded historical obligations. A version-one economy can remain inside a valid checkpoint until a version-two operation is required.

## Cash forecast

`CampaignFinanceQuery.cash_forecast()` restores a validated checkpoint and calls the pure `CampaignCashForecast`. It issues no campaign command, advances no clock, writes no file and mutates no caller value.

The forecast requires:

- account identity;
- current authoritative slot;
- horizon slot;
- optional detached assumptions explicitly tagged `conservative` or `optimistic`.

It returns three scenarios:

- **Committed:** current cash plus every open binding commitment due inside the horizon.
- **Conservative:** committed movements plus conservative assumptions.
- **Optimistic:** committed, conservative and optimistic assumptions.

Each scenario returns ordered movements, ending cash, lowest cash, the slot of that minimum, reserve breach and reserve gap. An overdue open commitment appears at the forecast start while retaining its original due slot.

An unsigned sponsor offer, hypothetical prize or other optimistic assumption cannot improve committed or conservative cash. Refreshing or changing assumptions does not alter the economy digest.

## Worked fixture

The registered fixture implements the GDD's eight-week example:

- opening cash: `150,000`;
- settled receipts through week eight: `112,000`;
- settled payments through week eight: `180,000`;
- closing week-eight cash: `82,000`;
- week-nine facility/fixed obligation: `28,000`;
- committed week-nine minimum: `54,000`;
- reserve policy: `60,000`;
- visible reserve gap: `6,000`.

An additional optimistic `50,000` sponsor assumption raises only the optimistic ending cash. It does not become a posting, commitment or guaranteed balance.

## Registered contracts

The mandatory campaign suite covers:

- the complete worked fixture and integer reconciliation;
- exact-once due settlement;
- duplicate commitment rejection and unchanged input;
- dated cancellation;
- reserve-policy persistence;
- committed/conservative/optimistic separation;
- detached forecast non-mutation;
- invalid-assumption rejection;
- terms tamper detection after outer digest recomputation;
- explicit legacy authority migration;
- prevention of settlement beyond campaign time;
- complete checkpoint/storage round-trip;
- obligations due during a weekend publishing atomically at their due slots;
- duplicate weekend import not paying commitments or event rewards twice.

## Deliberate next work

This milestone does not yet implement payroll contracts, recurring commitment templates, receivable earning rules, operating-result recognition, assets/liabilities, loans, distress remedies, season-prize schedules, sponsor agreements, budgets/envelopes, UI or autonomous spending mandates. TM-05 adds people, roles, contracts and availability over this dated commitment boundary. Recurring payroll must create explicit dated commitments rather than bypassing the ledger.
