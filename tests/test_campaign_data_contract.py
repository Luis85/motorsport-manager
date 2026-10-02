"""Regression checks for the authored campaign/content boundary."""
from __future__ import annotations

import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
CAMPAIGN = ROOT / "content/packs/core/campaigns/team-principal.json"
PACK = ROOT / "content/packs/core/pack.json"
STARTER = ROOT / "scripts/application/campaign/starter.gd"
RIVALS = ROOT / "scripts/domain/campaign/rivals.gd"
SCREENS = ROOT / "scripts/composition/campaign_screens.gd"
INVENTORY = ROOT / "docs/content/consumer-inventory.json"


class CampaignDataContractTests(unittest.TestCase):
    def test_core_campaign_owns_starter_content_and_tuning(self):
        campaign = json.loads(CAMPAIGN.read_text(encoding="utf-8"))
        self.assertEqual("campaign", campaign["kind"])
        self.assertTrue(campaign["default"])
        self.assertEqual("core.weekend.campaign-starter", campaign["weekend_id"])
        self.assertEqual(1950, campaign["career"]["start"]["year"])
        self.assertEqual(150000, campaign["career"]["opening_cash_minor"])
        self.assertEqual(60000, campaign["career"]["reserve_minor"])
        self.assertEqual(4, len(campaign["calendar"]))
        self.assertEqual(["core.circuit.hillside", "core.circuit.monza", "core.circuit.silverstone", "core.circuit.spa"],
                         [event["circuit_id"] for event in campaign["calendar"]])
        self.assertEqual(5, len(campaign["rivals"]))
        self.assertEqual("core.team.obsidian", campaign["player"]["roster_team_id"])
        self.assertEqual(5, len({row["roster_team_id"] for row in campaign["rivals"]}))
        self.assertEqual(8000, campaign["event_finance"]["departure_cost_minor"])
        self.assertIn("cash_preservation_threshold_minor", campaign["rival_policy"])
        self.assertEqual(8500, campaign["people_policy"]["counter_offer_ratio_bps"])
        self.assertEqual(2000, campaign["supply_policy"]["initial_confidence_bps"])

    def test_core_pack_publishes_campaign_and_its_weekend(self):
        manifest = json.loads(PACK.read_text(encoding="utf-8"))
        self.assertIn("campaigns/team-principal.json", manifest["files"])
        self.assertIn("weekends/campaign-starter.json", manifest["files"])

    def test_starter_interprets_data_instead_of_redeclaring_it(self):
        source = STARTER.read_text(encoding="utf-8")
        forbidden = [
            "const EVENT_COST_MINOR", "const CAMPAIGN_ID", "const ORGANIZATION_ID",
            "const SEASON_ID", "const SERIES_ID", '"opening_cash_minor": 150000',
            '"laps": 6', "9500 + index * 150", "App.library[mini(7",
        ]
        for token in forbidden:
            with self.subTest(token=token):
                self.assertNotIn(token, source)
        self.assertIn("CampaignDefinition.from_record", source)
        self.assertIn("CampaignContentSnapshot.build", source)
        self.assertIn("CampaignStarterLegacy", source)
        self.assertIn("entry_config.roster_team_id", source)
        self.assertNotIn("labels.sort()", source)
        self.assertNotIn("rival_index", source)

    def test_campaign_entry_uses_authored_circuits_not_library_order(self):
        source = SCREENS.read_text(encoding="utf-8")
        self.assertIn("_resolved_campaign_circuits", source)
        self.assertIn("CampaignStarter.circuits", source)
        self.assertNotIn("App.library[mini(7", source)

    def test_rival_algorithm_consumes_policy_instead_of_tuning_literals(self):
        source = RIVALS.read_text(encoding="utf-8")
        self.assertIn("CampaignRivalPolicy.normalized", source)
        self.assertNotIn("var target = 6000", source)
        self.assertNotIn("target = 10000", source)
        self.assertNotIn("float(spend) / 200.0", source)

    def test_people_and_supply_algorithms_consume_policy(self):
        people = (ROOT / "scripts/domain/campaign/people_development.gd").read_text(encoding="utf-8")
        supply = (ROOT / "scripts/domain/campaign/supply_network.gd").read_text(encoding="utf-8")
        people_tx = (ROOT / "scripts/application/campaign/people_transaction.gd").read_text(encoding="utf-8")
        supply_tx = (ROOT / "scripts/application/campaign/supply_transaction.gd").read_text(encoding="utf-8")
        self.assertIn("CampaignPeoplePolicy.normalized", people)
        self.assertIn("_people_policy(restored)", people_tx)
        self.assertNotIn("ratio >= 0.85", people)
        self.assertNotIn("load >= 0.2 and load <= 0.8", people)
        self.assertIn("CampaignSupplyPolicy.normalized", supply)
        self.assertIn("_supply_policy(r)", supply_tx)
        self.assertNotIn('"confidence_bps":2000', supply)
        self.assertNotIn("mini(9500", supply)

    def test_legacy_literals_are_explicit_compatibility_not_new_content(self):
        inventory = json.loads(INVENTORY.read_text(encoding="utf-8"))
        retained = {(row["file"], row["symbol"]) for row in inventory["retained_literals"]}
        self.assertIn(("scripts/application/campaign/starter_legacy.gd", "DEFAULTS"), retained)
        self.assertIn(("scripts/domain/campaign/rival_policy.gd", "LEGACY"), retained)
        self.assertIn(("scripts/domain/campaign/people_policy.gd", "LEGACY"), retained)
        self.assertIn(("scripts/domain/campaign/supply_policy.gd", "LEGACY"), retained)


if __name__ == "__main__":
    unittest.main()
