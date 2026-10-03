"""Machine-check published content fields against their declared production owners."""

from __future__ import annotations

import json
import unittest
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "docs/content/consumer-inventory.json"
SCHEMAS = ROOT / "content/schemas/v1"
ALLOWED = {
    "contract",
    "identity",
    "presentation",
    "reference",
    "authoring",
    "sporting",
    "simulation",
    "safety",
}


def leaves(node: dict, path: str = "") -> list[str]:
    if isinstance(node.get("properties"), dict):
        result: list[str] = []
        for key, child in node["properties"].items():
            result.extend(leaves(child, path + "/" + key))
        return result
    if node.get("type") == "array" and isinstance(node.get("items"), dict):
        return leaves(node["items"], path + "/*")
    return [path or "/"]


def covers(prefix: str, leaf: str) -> bool:
    return (
        leaf == prefix
        or leaf.startswith(prefix + "/")
        or ("/*" in leaf and leaf.split("/*", 1)[0] == prefix)
    )


class ContentConsumerInventoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(INVENTORY.read_text(encoding="utf-8"))

    def test_inventory_is_versioned_and_classifications_are_explicit(self):
        self.assertEqual(1, self.data["version"])
        self.assertEqual(ALLOWED, set(self.data["classifications"]))

    def test_every_published_schema_family_is_inventoried_once(self):
        schemas = {path.stem.removesuffix(".schema") for path in SCHEMAS.glob("*.schema.json")}
        self.assertEqual(schemas, set(self.data["families"]))

    def test_every_schema_leaf_has_a_declared_owner(self):
        for family, spec in self.data["families"].items():
            with self.subTest(family=family):
                schema_path = ROOT / spec["schema"]
                self.assertTrue(schema_path.is_file(), schema_path)
                schema = json.loads(schema_path.read_text(encoding="utf-8"))
                leaf_paths = leaves(schema)
                self.assertEqual(
                    sorted(set(leaf_paths)),
                    spec["expected_leaves"],
                    f"published {family} schema leaf paths changed; review each nested field before updating ownership",
                )
                prefixes = [entry["prefix"] for entry in spec["coverage"]]
                self.assertEqual(len(prefixes), len(set(prefixes)), "duplicate inventory prefix")
                for leaf in leaf_paths:
                    matches = [entry for entry in spec["coverage"] if covers(entry["prefix"], leaf)]
                    self.assertTrue(matches, f"{family} has no consumer classification for {leaf}")
                    longest = max(len(entry["prefix"]) for entry in matches)
                    self.assertEqual(
                        1,
                        sum(len(entry["prefix"]) == longest for entry in matches),
                        f"ambiguous owner for {family}{leaf}",
                    )
                for entry in spec["coverage"]:
                    self.assertTrue(
                        any(covers(entry["prefix"], leaf) for leaf in leaf_paths),
                        f"stale inventory prefix {family}{entry['prefix']}",
                    )

    def test_nested_schema_addition_requires_explicit_inventory_review(self):
        spec = self.data["families"]["tyre_thermal"]
        schema = json.loads((ROOT / spec["schema"]).read_text(encoding="utf-8"))
        changed = deepcopy(schema)
        changed["properties"]["operating"]["properties"]["new_limit"] = {"type": "number"}
        self.assertNotEqual(sorted(set(leaves(changed))), spec["expected_leaves"])
        self.assertIn("/operating/new_limit", leaves(changed))

    def test_every_inventory_entry_has_valid_classification_and_live_production_consumer(self):
        for family, spec in self.data["families"].items():
            for entry in spec["coverage"]:
                with self.subTest(family=family, prefix=entry["prefix"]):
                    self.assertIn(entry["classification"], ALLOWED)
                    self.assertTrue(entry.get("note", "").strip())
                    consumers = entry.get("consumers")
                    self.assertIsInstance(consumers, list)
                    self.assertTrue(consumers)
                    for consumer in consumers:
                        self.assertTrue(consumer.startswith("scripts/"), consumer)
                        self.assertTrue((ROOT / consumer).is_file(), consumer)

    def test_no_catch_all_prefix_can_hide_future_fields(self):
        for family, spec in self.data["families"].items():
            self.assertNotIn("/", [entry["prefix"] for entry in spec["coverage"]], family)

    def test_retained_literal_tables_and_bounds_are_explicitly_classified(self):
        retained = self.data.get("retained_literals")
        self.assertIsInstance(retained, list)
        self.assertTrue(retained)
        identities = set()
        for entry in retained:
            identity = (entry["file"], entry["symbol"])
            self.assertNotIn(identity, identities)
            identities.add(identity)
            self.assertIn(entry["classification"], ALLOWED)
            self.assertTrue(entry.get("note", "").strip())
            path = ROOT / entry["file"]
            self.assertTrue(path.is_file(), entry["file"])
            source = path.read_text(encoding="utf-8")
            self.assertIn("const " + entry["symbol"], source, f"missing retained symbol {identity}")


if __name__ == "__main__":
    unittest.main()
