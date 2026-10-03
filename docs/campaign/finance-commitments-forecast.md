# Campaign commitments, due dates and cash forecast

Status: implemented TM-04 domain/application foundation on PR #27, extended by TM-05 employment-backed payroll and TM-06 rented facility/service commitments. This is not a complete accounting system, commercial model or playable Finance screen.

## Authority and separation

`CampaignEconomy` remains the factual integer-minor-unit cash authority. Version 2 adds binding future cash commitments and current reserve policy without treating either as cash.

The implementation separates four concepts:

1. **Cash** is opening balance plus settled postings.
2. **Commitments** are signed future receipts or payments with one due slot.
3. **Reserve policy** is a planning floor; it is not a second account and does not reserve or create cash by itself.
4. **Forecast assumptions** are detached conservative/optimistic inputs. They are never persisted as commitments or posted as cash.

[Operational depth](operational-depth.md) adds a game-defined financial-position query for cash, operating result, receivables and payables/debt. Eligible-series accounting and full accrual reporting remain outside the model; the game does not claim real-world accounting compliance.

## Economy version 2

The version-two economy contains:

- stable campaign identity;
- `authority_from_slot`, identifying when commitment history became authoritative;
- one or more integer-minor-unit accounts;
- immutable weekend financial event indexes;
- binding commitments;
- current per-account reserve policies; and
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
- dated resolution and settlement-posting identity; and
- immutable terms digest.

Positive amounts are contracted receipts; negative amounts are contracted payments. Supported first-slice categories include fixed/event operations, development, training, facilities, payroll, suppliers, sponsorship, participation, financing and a bounded other category.

An open commitment creates no posting. Settlement creates one posting at the contractual due slot and changes the commitment to `settled`. Re-running the same settlement boundary finds no open due record and is an exact no-op. Cancellation is possible only while open and no later than the due slot; it creates no cash movement.

Changing amount, date, category, source or account after recomputing only the outer economy digest still fails the commitment terms check.

## Employment-backed payroll

TM-05 uses the same commitment ledger for payroll; it does not introduce a second personnel cash balance.

Signing or renewing a `CampaignEmploymentContract` creates one explicit payroll commitment for every complete installment in its immutable schedule. The contract identity is the commitment source. Account, signing slot, due slot, amount and `payroll` category must match the contract exactly.

The version-four campaign checkpoint cross-validates personnel, operations and economy:

- every new payroll commitment belongs to one recorded contract schedule;
- every new `facility` commitment created after TM-06 authority belongs to one rented-service work order;
- one contract installment cannot have zero or multiple commitments;
- payroll cannot be cancelled while employment remains binding;
- payroll cannot settle before its due slot;
- termination settles installments already due and cancels future installments; and
- future payroll cancellation uses the same dated termination evidence.

Existing payroll found while migrating a version-two checkpoint is retained through an explicit legacy index instead of being assigned fabricated employment terms.

Project, department or eligible-expenditure summaries must not create another salary posting. Later internal allocation can analyze paid time without charging cash twice.

## Time and checkpoint rules

`CampaignEconomyTimeline` validates finance against the authoritative campaign clock:

- commitment authority cannot begin in the future;
- creation, cancellation, settlement, reserve policy and cash postings cannot be dated after the checkpoint state; and
- open due dates may be in the future.

`CampaignFinanceTransaction` restores the complete checkpoint, stages one finance change and publishes a complete replacement checkpoint or the exact caller value. It supports adding/cancelling ordinary commitments, changing reserve policy and settling due items up to current campaign time.

A generic finance mutation that would violate personnel payroll or operations facility-commitment authority fails complete-checkpoint publication. Employment payroll creation, renewal, cancellation and replacement enter through `CampaignPersonnelTransaction` so personnel terms and economy commitments publish together.

New planning changes are frozen while a campaign weekend manifest is active. Existing obligations still continue: `CampaignWeekendTransaction` settles commitments due between departure and return at their own due slots, then publishes them atomically with elapsed campaign time, standings, returned inventory, event cash, personnel, operations and the exactly-once receipt. Failure in any sub-step publishes none of them.

## Legacy compatibility

Version-one economy data remains valid. On the first new finance/event mutation it upgrades losslessly:

- opening cash and current cash are unchanged;
- event postings keep identity, date, amount, category and result digest;
- `event_id` becomes the generic version-two event source reference;
- commitments and reserve policy start empty; and
- `authority_from_slot` is the explicit migration/current campaign slot.

Migration therefore does not claim knowledge of unrecorded historical obligations. A version-one economy can remain inside a valid checkpoint until a version-two operation is required.

When checkpoint version 2 migrates forward, recorded payroll commitments remain authoritative through the personnel legacy-payroll index. When version 3 migrates to version 4, recorded facility commitments remain authoritative through the operations legacy-facility index. Migration invents neither employees/contracts nor facilities/work orders.

## Cash forecast and commitment preview

`CampaignFinanceQuery.cash_forecast()` restores a validated checkpoint and calls the pure `CampaignCashForecast`. It issues no campaign command, advances no clock, writes no file and mutates no caller value.

The forecast requires:

- account identity;
- current authoritative slot;
- horizon slot; and
- optional detached assumptions explicitly tagged `conservative` or `optimistic`.

It returns three scenarios:

- **Committed:** current cash plus every open binding commitment due inside the horizon.
- **Conservative:** committed movements plus conservative assumptions.
- **Optimistic:** committed, conservative and optimistic assumptions.

Each scenario returns ordered movements, ending cash, lowest cash, the slot of that minimum, reserve breach and reserve gap. An overdue open commitment appears at the forecast start while retaining its original due slot.

`CampaignFinanceQuery.commitment_preview()` stages one proposed ordinary commitment only inside a detached economy copy, forecasts the resulting minimum cash, and returns the proposed record plus source checkpoint digest. It does not add that commitment to the checkpoint.

`CampaignPersonnelQuery.contract_preview()` uses the same forecast authority for proposed employment. It stages the complete payroll schedule on detached values and reports installment count, total committed pay and resulting cash forecast without signing the contract.

An unsigned sponsor offer, hypothetical prize or other optimistic assumption cannot improve committed or conservative cash. Refreshing a forecast, changing assumptions or previewing a proposed commitment does not alter the economy digest.

## Worked fixture

The registered fixture implements the GDD's eight-week example:

- opening cash: `150,000`;
- settled receipts through week eight: `112,000`;
- settled payments through week eight: `180,000`;
- closing week-eight cash: `82,000`;
- week-nine facility/fixed obligation: `28,000`;
- committed week-nine minimum: `54,000`;
- reserve policy: `60,000`; and
- visible reserve gap: `6,000`.

An additional optimistic `50,000` sponsor assumption raises only the optimistic ending cash. It does not become a posting, commitment or guaranteed balance. A proposed additional `10,000` development payment previews a `44,000` minimum and `16,000` reserve gap without becoming binding.

The personnel contracts add a separate fixture in which a proposed four-installment employment term exposes `40,000` total committed payroll before signing. Previewing it leaves both cash and personnel unchanged.

## Registered contracts

The mandatory campaign suite covers:

- the complete worked fixture and integer reconciliation;
- exact-once due settlement;
- duplicate commitment rejection and unchanged input;
- dated cancellation;
- reserve-policy persistence;
- committed/conservative/optimistic separation;
- detached forecast and pre-commitment preview non-mutation;
- invalid-assumption rejection;
- terms tamper detection after outer digest recomputation;
- explicit legacy authority migration;
- prevention of settlement and finance history beyond campaign time;
- complete checkpoint/storage round-trip;
- obligations due during a weekend publishing atomically at their due slots;
- duplicate weekend import not paying commitments or event rewards twice;
- exact payroll generation from employment terms;
- rejection of generic payroll cancellation during binding employment;
- renewal payroll creation;
- termination/replacement settlement and future-payroll cancellation; and
- legacy payroll preservation without invented contracts.

## Implemented consumers and remaining limits

The payroll model remains fixed complete installments; prorating, contractual buyouts, notice pay and release clauses are not inferred. [Engineering](engineering-parts-race-profile.md) and facilities use explicit commitments rather than hidden project-summary costs. [Commercial agreements](sponsorship-commercial.md), [delegation mandates](delegation-mandates.md), [season prizes](multi-season-progression.md), [procurement/financial pressure](operational-depth.md) and [founder transfers](group-era-dynasty.md) now use the same ledger.

The game-defined position view and bridge financing remain bounded. Full accrual accounting, tax/depreciation, a lending market, insolvency proceedings and dedicated specialist Finance UI remain separate work. Forecast assumptions never become spendable cash.
