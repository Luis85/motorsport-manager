"""Real native nested-document rejection and large bounded response transport."""

import json
import unittest

import test_toolbox_native as native
from toolbox import ToolboxClient, ToolboxDomainError
from toolbox_protocol import request


class ToolboxNativeBoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        native.ToolboxNativeTests.setUpClass()

    def client(self, **options):
        return ToolboxClient(godot=native.ENGINE, root=native.SOURCE, timeout=180, **options)

    def test_nested_campaign_documents_reject_without_engine_errors_or_mutation(self):
        fields = [
            ("personnel.register_person", "eligible_roles"),
            ("people.register_candidate", "eligible_roles"),
            ("people.register_candidate", "attributes"),
            ("people.register_candidate", "preferences"),
            ("engineering.create_project", "profile_delta"),
            ("delegation.create_mandate", "allowed_categories"),
            ("delegation.create_mandate", "protected_ids"),
            ("commercial.sign_agreement", "guaranteed_payments"),
            ("commercial.sign_agreement", "appearances"),
            ("commercial.sign_agreement", "bonus_terms"),
            ("rival.register_team", "person_ids"),
            ("rival.register_team", "car_ids"),
            ("rival.register_team", "policy"),
            ("group.initialize", "capabilities"),
        ]
        with self.client() as tools:
            tools.campaigns.create("nested", "core.campaign.team-principal")
            initial = tools.campaigns.snapshot("nested")
            person = next(iter(initial["checkpoint"]["personnel"]["people"]))
            for action, field in fields:
                for scalar in (1, None):
                    payload = {"input": {"id": "nested.invalid", "owner_person_id": person}}
                    payload["input"][field] = scalar
                    if action == "group.initialize":
                        payload = {"parent_cash_minor": 0, "era": {"capabilities": scalar}}
                    with self.subTest(action=action, field=field, scalar=scalar):
                        with self.assertRaises(ToolboxDomainError) as rejected:
                            tools.campaigns.command("nested", action, payload)
                        self.assertEqual(rejected.exception.code, "DOMAIN_REJECTED")
                        self.assertEqual(tools.campaigns.snapshot("nested"), initial)
                        self.assertIsNone(tools.process.process.poll())
            for scalar in (1, None, "invalid"):
                malformed = json.loads(json.dumps(initial["checkpoint"]))
                season = next(iter(malformed["competition"]["seasons"].values()))
                season["entries"][next(iter(season["entries"]))] = scalar
                with self.subTest(entry=scalar):
                    with self.assertRaises(ToolboxDomainError) as rejected:
                        tools.campaigns.restore("nested", malformed)
                    self.assertEqual(rejected.exception.code, "DOMAIN_REJECTED")
                    self.assertEqual(tools.campaigns.snapshot("nested"), initial)
            tools.process.check()
            self.assertFalse(tools.process.failure)
            native.evidence(
                "nested-campaign-rejection",
                tools.metadata,
                {"malformed_commands": 28, "malformed_restores": 3, "nonmutation": True},
            )

    def test_stdio_128_snapshots_exceed_request_limit_without_truncation(self):
        with self.client() as tools:
            tools.weekends.create("large", native.CONFIGURATION)
            expected = tools.weekends.snapshot("large")
            sent = [request("weekend.snapshot", "large", {}, f"snapshot.{i}") for i in range(128)]
            result = tools.batch(sent)
            self.assertFalse(result["stopped"])
            self.assertIs(result["atomic"], False)
            self.assertEqual(len(result["responses"]), 128)
            for response, original in zip(result["responses"], sent, strict=True):
                self.assertTrue(response["ok"])
                self.assertEqual(response["request_id"], original["request_id"])
                self.assertEqual(response["result"], expected)
                self.assertEqual(response["metadata"], tools.metadata)
            size = len(json.dumps(result, separators=(",", ":")).encode("utf-8"))
            self.assertGreater(size, 8 * 1024 * 1024)
            self.assertLess(size, 64 * 1024 * 1024)
            self.assertEqual(tools.weekends.snapshot("large"), expected)
            self.assertIsNone(tools.process.process.poll())
            native.evidence(
                "large-stdio-snapshot-batch",
                tools.metadata,
                {"snapshots": 128, "response_bytes": size, "exact_snapshot_parity": True},
            )

    def test_file_mode_create_plus_127_snapshots_preserves_complete_response(self):
        with self.client() as tools:
            created = tools.weekends.create("large", native.CONFIGURATION)
            expected = tools.weekends.snapshot("large")
        sent = [
            request("weekend.create", "large", {"configuration": native.CONFIGURATION}, "create")
        ]
        sent.extend(request("weekend.snapshot", "large", {}, f"snapshot.{i}") for i in range(127))
        with self.client(file_mode=True) as tools:
            result = tools.batch(sent)
            self.assertFalse(result["stopped"])
            self.assertIs(result["atomic"], False)
            self.assertEqual(len(result["responses"]), 128)
            self.assertEqual(result["responses"][0]["result"], created)
            for response, original in zip(result["responses"][1:], sent[1:], strict=True):
                self.assertTrue(response["ok"])
                self.assertEqual(response["request_id"], original["request_id"])
                self.assertEqual(response["result"], expected)
            size = len(json.dumps(result, separators=(",", ":")).encode("utf-8"))
            self.assertGreater(size, 8 * 1024 * 1024)
            self.assertLess(size, 64 * 1024 * 1024)
            native.evidence(
                "large-file-snapshot-batch",
                result["responses"][0]["metadata"],
                {"snapshots": 127, "response_bytes": size, "exact_snapshot_parity": True},
            )


if __name__ == "__main__":
    unittest.main()
