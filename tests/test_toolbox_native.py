"""Real pinned-engine SDK continuation and CLI batch parity, never a Python game model."""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from toolbox import ToolboxClient, ToolboxDomainError
from toolbox_protocol import request

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(os.environ.get("TOOLBOX_TEST_ROOT", ROOT))
ENGINE = (
    os.environ.get("VERIFICATION_TEST_GODOT")
    or os.environ.get("GODOT_BINARY")
    or shutil.which("godot")
)
CONFIGURATION = {
    "circuit_id": "core.circuit.hillside",
    "weekend_id": "core.weekend.quick",
    "overrides": {"laps": 2, "seed": 7314},
}


def evidence(name, metadata, result):
    directory = os.environ.get("TOOLBOX_EVIDENCE_ROOT")
    if directory:
        folder = Path(directory)
        folder.mkdir(parents=True, exist_ok=True)
        (folder / (name + ".json")).write_text(
            json.dumps(
                {"passed": True, "metadata": metadata, "result": result}, indent=2, allow_nan=False
            ),
            encoding="utf-8",
        )


def player_files():
    base = (
        Path(os.environ["APPDATA"]) / "Godot/app_userdata/Motorsport Manager"
        if os.name == "nt"
        else Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share"))
        / "godot/app_userdata/Motorsport Manager"
    )
    return {
        str(path.relative_to(base)): path.read_bytes() for path in base.rglob("*") if path.is_file()
    }


class ToolboxNativeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        available = ENGINE and (SOURCE / "scripts/services/toolbox/cli.gd").is_file()
        if not available:
            if os.environ.get("TOOLBOX_NATIVE_REQUIRED") == "1":
                raise AssertionError("Required native toolbox engine/source is unavailable")
            raise unittest.SkipTest(
                "Native toolbox integration requires Godot and the production runner"
            )

    def client(self, **options):
        return ToolboxClient(godot=ENGINE, root=SOURCE, timeout=90, **options)

    def test_json_snapshot_restores_identical_fingerprint_and_fixed_tick_continuation(self):
        prior_files = player_files()
        with self.client() as tools:
            created = tools.weekends.create("original", CONFIGURATION)
            tools.weekends.create("same-seed", CONFIGURATION)
            self.assertEqual(created["phase"], "briefing")
            self.assertEqual(
                tools.weekends.snapshot("original"), tools.weekends.snapshot("same-seed")
            )
            self.assertEqual(tools.weekends.step_ticks("original", 3)["completed"], 0)
            tools.weekends.command("original", "practice_start")
            player = created["player_ids"][0]
            garage = tools.weekends.query("original", "car", {"id": player})
            plan = {
                "objective": "tyre_life",
                "set_id": garage["tyre_sets"][0]["id"],
                "laps": 1,
                "baseline": "balanced",
            }
            preview = tools.weekends.query(
                "original", "practice_preview", {"id": player, "plan": plan}
            )
            self.assertTrue(preview["available"])
            tools.weekends.command(
                "original",
                "practice_run",
                {
                    "id": player,
                    "plan": plan,
                    "revision": preview["revision"],
                    "key": preview["key"],
                    "time": preview["time"],
                },
            )
            tools.weekends.command("original", "speed", {"value": 2})
            tools.weekends.advance_elapsed("original", 0.02)
            self.assertEqual(tools.weekends.step_ticks("original", 13)["completed"], 13)
            moving = tools.weekends.query("original", "car", {"id": player})
            self.assertTrue(
                moving["pit_d"] != garage["pit_d"] or moving["distance"] != garage["distance"]
            )
            exported = tools.weekends.snapshot("original")
            # Round-trip actual JSON doubles/integers through the production reader.
            portable = json.loads(json.dumps(exported["snapshot"], allow_nan=False))
            tools.weekends.restore("restored", portable)
            self.assertEqual(tools.weekends.snapshot("restored"), exported)
            for session in ("original", "restored"):
                self.assertEqual(tools.weekends.step_ticks(session, 37)["completed"], 37)
            self.assertEqual(
                tools.weekends.snapshot("original"), tools.weekends.snapshot("restored")
            )
            before = tools.weekends.snapshot("original")
            with self.assertRaises(ToolboxDomainError) as rejected:
                tools.weekends.command("original", "unsupported_action")
            self.assertEqual(rejected.exception.code, "DOMAIN_REJECTED")
            self.assertEqual(tools.weekends.snapshot("original"), before)
            tools.weekends.command("original", "pause")
            paused = tools.weekends.snapshot("original")
            self.assertEqual(tools.weekends.step_ticks("original", 9)["completed"], 0)
            self.assertEqual(tools.weekends.snapshot("original"), paused)
            home, process = tools.project.home, tools.process.process
            self.assertIs(tools.metadata["engine_executed"], True)
            self.assertEqual(len(tools.metadata["source_digest"]), 64)
            metadata = tools.metadata
        self.assertFalse(home.exists())
        self.assertIsNotNone(process.poll())
        self.assertEqual(player_files(), prior_files)
        evidence(
            "snapshot-continuation",
            metadata,
            {
                "snapshot_fingerprint": exported["fingerprint"],
                "continued_fingerprint": before["fingerprint"],
                "requested_ticks": [13, 37],
                "completed_ticks": [13, 37],
                "player_id": player,
                "rejected_input_nonmutation": True,
                "paused_nonmutation": True,
                "player_files_unchanged": True,
            },
        )

    def test_cli_file_batch_matches_incremental_sdk_results_and_rejected_prefix(self):
        operations = [
            ("weekend.create", {"configuration": CONFIGURATION}),
            ("weekend.snapshot", {}),
            ("weekend.command", {"action": "practice_start"}),
            ("weekend.command", {"action": "speed", "payload": {"value": 2}}),
            ("weekend.advance_elapsed", {"seconds": 0.02}),
            ("weekend.step_ticks", {"count": 17}),
            ("weekend.snapshot", {}),
            ("weekend.command", {"action": "unsupported_action"}),
            ("weekend.snapshot", {}),
        ]
        requests = [
            request(operation, "parity", args, f"p{index}")
            for index, (operation, args) in enumerate(operations)
        ]
        with self.client() as tools:
            sdk = [tools.request(sent) for sent in requests]
        with tempfile.TemporaryDirectory(prefix="toolbox-json-parity-") as temporary:
            batch = Path(temporary) / "ordered requests – Ω.json"
            batch.write_text(
                json.dumps({"requests": requests, "stop_on_error": False}), encoding="utf-8"
            )
            completed = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "scripts/toolbox.py"),
                    "batch",
                    str(batch),
                    "--file-mode",
                    "--godot",
                    str(ENGINE),
                    "--root",
                    str(SOURCE),
                    "--timeout",
                    "90",
                ],
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=120,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr + completed.stdout)
            wire = json.loads(completed.stdout)
        self.assertIs(wire["ok"], True)
        actual = wire["result"]["responses"]
        self.assertEqual(len(actual), len(sdk))
        for native, python in zip(actual, sdk, strict=True):
            # Source metadata independently identifies each actual staged startup;
            # gameplay and correlated response fields must be exactly equal.
            self.assertEqual(
                {k: v for k, v in native.items() if k != "metadata"},
                {k: v for k, v in python.items() if k != "metadata"},
            )
            self.assertIs(native["metadata"]["engine_executed"], True)
        self.assertIs(actual[7]["ok"], False)
        self.assertEqual(actual[6]["result"], actual[8]["result"])
        evidence(
            "json-batch-parity",
            wire["metadata"],
            {
                "requests": len(requests),
                "exact_gameplay_response_parity": True,
                "rejected_response_index": 7,
                "accepted_prefix_fingerprint": actual[6]["result"]["fingerprint"],
            },
        )

    def test_native_document_diagnostics_text_remains_detached_data(self):
        configuration = (SOURCE / "project.godot").read_bytes()
        cache_existed = (SOURCE / ".godot").exists()
        with self.client() as tools:
            current = tools.tracks.create("document")
            current["document"]["name"] = (
                "SCRIPT ERROR: Authored track; Parse Error: notes; ERROR: label"
            )
            committed = tools.tracks.commit("document", current["document"], current["revision"])
            self.assertEqual(committed["document"]["name"], current["document"]["name"])
            self.assertEqual(tools.tracks.read("document")["document"], committed["document"])
            metadata = tools.metadata
        self.assertEqual((SOURCE / "project.godot").read_bytes(), configuration)
        self.assertEqual((SOURCE / ".godot").exists(), cache_existed)
        evidence(
            "detached-document",
            metadata,
            {
                "name": committed["document"]["name"],
                "revision": committed["revision"],
                "source_configuration_unchanged": True,
                "checkout_import_cache_unchanged": True,
            },
        )


if __name__ == "__main__":
    unittest.main()
