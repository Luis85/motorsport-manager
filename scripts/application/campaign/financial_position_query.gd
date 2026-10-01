class_name CampaignFinancialPositionQuery
extends RefCounted
## Game-defined operational position; not a claim of real-world accounting compliance.
static func snapshot(checkpoint:Dictionary)->Dictionary:
	var r=CampaignCheckpoint.restore(checkpoint);if not r.ok:return {"ok":false,"error":r.error}
	var account:Dictionary=r.economy.accounts[r.state.organization_id]
	var operating=0;var receivable=0;var payable=0;var debt=0
	for posting in account.postings.values():
		if posting.category not in ["financing","owner_transfer"]:operating+=int(posting.amount_minor)
	for commitment in r.economy.commitments.values():
		if commitment.account_id!=r.state.organization_id or commitment.status!="open":continue
		if int(commitment.amount_minor)>0:receivable+=int(commitment.amount_minor)
		else:
			payable+=-int(commitment.amount_minor)
			if commitment.category=="financing":debt+=-int(commitment.amount_minor)
	var cash=int(account.cash_minor)
	return {"ok":true,"error":"","cash_minor":cash,"operating_result_minor":operating,
		"receivables_minor":receivable,"payables_minor":payable,"debt_minor":debt,
		"assets_minor":maxi(0,cash)+receivable,"liabilities_minor":maxi(0,-cash)+payable,
		"physical_parts":r.engineering.parts.size(),"material_types":r.management.supply.materials.size(),
		"facility_resources":r.operations.resources.size(),
		"note":"Game-defined operating view; financing and owner transfers are excluded from operating result."}
