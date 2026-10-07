# v0.6 delivery record

Verified on 2026-10-05 with Node.js v24.19.0 and Linux Chromium.

## Repository placement

This standalone concept is stacked on [PR #25](https://github.com/Luis85/motorsport-manager/pull/25), branch `concept/littlewild-v15-world-ui`, at commit `fe7e1c51432ff800d13b605fdf782a10042824d7`.

Source, schemas, tests, developer guides, build output, editable examples, offline previews, GLB exports and review screenshots are contained in this concept folder. The repository documentation index has one navigation entry. The native game runtime is unchanged.

## Scene Forge verification

- Formatting, dependency boundaries, type checking and build passed.
- 61 core tests and 14 end-to-end tests passed in the repository copy.
- All eight showcase scenes passed Khronos glTF validation with zero errors and zero warnings.
- Five six-view reviews produced 30 rendered frames and contact sheets.
- The offline workshop was checked at desktop 1600 × 1050 and mobile 390 × 844, with no runtime errors, HTTP requests or horizontal overflow.
- Rig export tests compare deformed vertex positions after a Three.js GLTFLoader round trip, including transformed model instances.

Machine-readable release evidence: [checks](checks.json) and [showcase verification](showcase-verification.json). The earlier v0.5 verification and refactor records remain historical evidence.

## Host repository checks

- Documentation links and architecture checks passed.
- Pinned advisory quality analysis completed for 698 Python/GDScript files with zero warnings.
- The Python suite ran 339 tests with 19 skips and one error: `ProcessLookupError` in the existing timeout cleanup fixture in `tests/test_verify_runner.py`. A focused rerun of that module passed (seven tests, one skip). The broader suite therefore remains a qualified result, not a green gate.
- The complete native Godot verification suite was unavailable because the pinned Godot executable is not installed.

The host quality policy covers Python and GDScript. This independent TypeScript concept retains its own 800-line module cap, dependency-boundary checks and runtime-cycle detection; several existing concept modules exceed the host's 400-line source guideline. The host policy and exclusions were not changed. Further decomposition can follow the explicit tool, compiler and transaction seams described in the [architecture](ARCHITECTURE.md) and [extension guide](EDITOR_EXTENSIONS.md).

## Scope and limits

Native Blender/Godot imports, macOS and Windows were not tested. GLB validation and Three.js round trips establish format and renderer evidence, not native-application certification.

Rigging includes joint hierarchies, automatic or explicit part skinning, poses, rotation keyframes and playback. It does not include inverse kinematics, constraints, vertex weight painting, retargeting, morph targets or skeletal translation/scale animation tracks. Materials provide PBR/unlit shading; arbitrary GLSL and image texture authoring are not implemented. Preview tone mapping and studio lighting are recipe features; authored punctual lights export to glTF.

See [rigging](RIGGING.md), [examples](EXAMPLES.md) and [the agent workflow](AGENT_WORKFLOW.md) for operational details.
