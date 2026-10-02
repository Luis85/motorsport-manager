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
        self.assertEqual(5, len(campaign["rivals"]))
        self.assertEqual(8000, campaign["event_finance"]["departure_cost_minor"])
        self.assertIn("cash_preservation_threshold_minor", campaign["rival_policy"])

    def test_core_pack_publishes_campaign_and_its_weekend(self):
        manifest = json.loads(PACK.read_text(encoding="utf-8"))
        self.assertIn("campaigns/team-principal.json", manifest["files"])
        self.assertIn("weekends/campaign-starter.json", manifest["files"])

    def test_starter_interprets_data_instead_of_redeclaring_it(self):
        source = STARTER.read_text(encoding="utf-8")
        forbidden = [
            "const EVENT_COST_MINOR", "const CAMPAIGN_ID", "const ORGANIZATION_ID",
            "const SEASON_ID", "const SERIES_ID", '"opening_cash_minor": 150000',
            '"laps": 6', "9500 + index * 150",
        ]
        for token in forbidden:
            with self.subTest(token=token):
                self.assertNotIn(token, source)
        self.assertIn("CampaignDefinition.from_record", source)
        self.assertIn("CampaignContentSnapshot.build", source)
        self.assertIn("CampaignStarterLegacy", source)

    def test_rival_algorithm_consumes_policy_instead_of_tuning_literals(self):
        source = RIVALS.read_text(encoding="utf-8")
        self.assertIn("CampaignRivalPolicy.normalized", source)
        self.assertNotIn("var target = 6000", source)
        self.assertNotIn("target = 10000", source)
        self.assertNotIn("float(spend) / 200.0", source)

    def test_legacy_literals_are_explicit_compatibility_not_new_content(self):
        inventory = json.loads(INVENTORY.read_text(encoding="utf-8"))
        retained = {(row["file"], row["symbol"]) for row in inventory["retained_literals"]}
        self.assertIn(("scripts/application/campaign/starter_legacy.gd", "DEFAULTS"), retained)
        self.assertIn(("scripts/domain/campaign/rival_policy.gd", "LEGACY"), retained)


if __name__ == "__main__":
    unittest.main()
