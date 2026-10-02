# Campaign sponsorship and commercial obligations

TM-09 treats sponsorship as a dated exchange rather than a passive revenue multiplier.

A signed agreement records guaranteed payments, optional result bonuses, and named appearance obligations. Guaranteed payments create positive `sponsor` commitments immediately but do not change cash until their contractual due date. Conditional bonuses create no commitment until a settled competition event proves the stated finishing condition.

Appearance obligations reserve the same personnel availability used by factory work, training and event duty. A person cannot be promised to a sponsor and simultaneously scheduled elsewhere.

`CampaignCommercialQuery` reports guaranteed open value and already-earned bonus value separately. Unsigned offers and unearned bonus terms never appear as spendable cash.

All sign/claim operations publish one campaign checkpoint atomically; rejected terms, capacity conflicts or missing sporting evidence return the caller checkpoint unchanged.
