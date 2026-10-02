# Campaign mandates and bounded delegation

TM-10 makes automation an explicit organization capability rather than a hidden difficulty modifier.

A mandate names its owner, scope, review/expiry dates, per-decision spending ceiling, total future-obligation ceiling, minimum liquidity floor, permitted cash categories, protected resources and risk posture. Taking authority back is an explicit revocation; signed obligations remain in the normal ledger.

The first executable seam is delegated financial commitment creation. It uses the same `CampaignEconomy` and forecast path as manual finance. The guard rejects wrong scopes, unavailable owners, protected resources, disallowed categories, spending-limit breaches, future-obligation breaches and reserve breaches. Rejection returns the source checkpoint unchanged.

Every successful autonomous commitment is linked to an immutable decision record containing the mandate, subject, slot, amount, explanation and the exact commitment terms digest.

Delegated execution never calls `CampaignState.command`; it therefore consumes no founder energy and does not advance campaign time.
