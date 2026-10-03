"""File-only circuit/brief acceptance against an already-built native executable."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any, Callable


def exercise_scenario(
    source: Path,
    executable: Path,
    pack: Path,
    cwd: Path,
    environment: dict[str, str],
    runtime_uid: int | None,
    probe: Callable[..., dict[str, Any]],
) -> dict[str, Any]:
    """Use a fresh pack; edits never rebuild the executable or repair an authored grid."""
    shutil.copytree(source / "content/examples/club-racing", pack)
    arguments = [
        "--content-pack=" + str(pack),
        "--content-probe=local.club.vehicle.sport",
        "--content-probe-scenario_id=local.club.scenario.first-weekend",
    ]
    first = probe(executable, arguments, cwd, environment, runtime_uid=runtime_uid)
    if (
        first["track_id"] != "local.club.training"
        or first["field_size"] != 14
        or first["time"] < 70
        or first["track_visual"]["season"] != "autumn"
        or first["scenario_context"]["scenario"]["title"] != "Your first club weekend"
    ):
        raise RuntimeError("The exported runtime did not run the external circuit and scenario.")

    def change(relative: str, update: Callable[[dict[str, Any]], None]) -> None:
        path = pack / relative
        value = json.loads(path.read_text(encoding="utf-8"))
        update(value)
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    change(
        "circuits/training.json", lambda data: data["document"].update(name="Edited Club Circuit")
    )
    change(
        "styles/autumn.json",
        lambda data: data["visual"].update(environment="coastal", season="summer"),
    )
    change(
        "scenarios/first-weekend.json",
        lambda data: data["brief"].update(title="The edited club brief"),
    )
    edited = probe(executable, arguments, cwd, environment, runtime_uid=runtime_uid)
    if (
        edited["track_name"] != "Edited Club Circuit"
        or edited["track_visual"]["environment"] != "coastal"
        or edited["scenario_context"]["scenario"]["title"] != "The edited club brief"
        or edited["track_hash"] == first["track_hash"]
    ):
        raise RuntimeError(
            "The unchanged executable did not observe circuit, style and brief edits."
        )
    change("circuits/training.json", lambda data: data["document"]["grid"].update(count=12))
    rejected = probe(
        executable,
        ["--content-pack=" + str(pack), "--content-validate"],
        cwd,
        environment,
        False,
        runtime_uid,
    )
    if rejected["diagnostics"][0]["code"] != "CONTENT_SCENARIO_CAPACITY":
        raise RuntimeError("A scenario with an undersized grid was not rejected before activation.")
    shutil.rmtree(pack)
    restored = probe(
        executable, ["--content-probe-restore"], cwd, environment, runtime_uid=runtime_uid
    )
    if restored != edited:
        raise RuntimeError("Removing a pack changed the saved circuit, brief, or moving state.")
    return {
        "passed": True,
        "first": first,
        "edited": edited,
        "capacity_rejection": rejected,
        "restored_without_pack": restored,
    }
