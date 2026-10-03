# Littlewild v15 — publication record

> **Historical publication record.** The active Littlewild source/build/verification workflow is now TypeScript-based. Files in this directory document the earlier one-time payload installation and are not the current release gate.

## Status

**Published and runnable.** The checksum-pinned v15 payload is installed under
`docs/concepts/littlewild/`, including the standalone `littlewild.html`,
authored `source/`, bundled `vendor/`, configuration/scenario content, tests,
verification records, and documentation.

The one-time GitHub Actions publisher reassembled all 72 transfer chunks,
verified the transport checksum, safely extracted the authored payload, reproduced
the pinned Three.js vendor, rebuilt the standalone HTML, verified the final HTML
checksum, and then removed its temporary workflow and transfer staging.

## Artifact identity

- Source archive SHA-256: `8793552fbf1776823018e61913d2b6641856480d0f4c4c4c343c8145f8b82b77`
- Transfer SHA-256: `cba1683fbbeefbd471d7d4b8016d6d69c068f9efc6ac92b7e15ea1a72146c484`
- Standalone HTML SHA-256: `acaf00f6163cb8ca3539370ed8b89e2afd844491ae7ee1c1bb70a321b0543032`
- Pinned vendor SHA-256: `a998daec49b9df4d7fbb55eb23cf7c908479d3983ff92d165ea403361b7c2bd2`
- Installation commit: `a5436ecbe7d140579fc83efb254fad28b58e6f11`
- Publication workflow run: `36643462040` — success

`STATUS.json` records the installer result. `payload-manifest.json` pins the
supplied archive, and `VERIFICATION.md` records the current product gate.

## Scope

This publication adds the Littlewild concept only. It does not alter the native
Motorsport Manager Godot runtime or gameplay. The reusable configuration contract,
scenario packs, and compiled-engine boundaries are documented in
`../CONFIGURATION.md` and `../CONTENT-INTEGRATION.md`.

## Verification

The supplied v15 source was rebuilt independently and passed **871 / 871 checks
across 17 suites**, including **105 browser checks**. Publisher safety/integration
coverage also passed before remote publication.

The native Godot six-shard gate was not rerun as part of the concept publisher.
Hardware WebGL, physical devices, screen readers, native local-file persistence,
and human usability remain outside the recorded verification evidence.
